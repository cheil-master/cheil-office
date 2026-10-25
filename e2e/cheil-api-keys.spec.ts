import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (2026-10-25): the deployed app runs on the person's own API key.
 * Settings → AI and the first-run guide offer Claude, GPT and Solar first; a
 * saved key is the AI in use. The template fill runs on an OpenAI-compatible
 * API the same way it runs on Ollama: here a stand-in server on this PC
 * answers like GPT or Solar would (the same openai-compatible route), so no
 * real key or account is used.
 */

test('Cheil: Settings → AI offers Claude, GPT and Solar keys first, and a saved key is in use', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-api-keys',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, userDataDir } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await page.locator('.set-nav-item').filter({ hasText: 'AI' }).first().click()
    const keys = page.getByTestId('cheil-api-keys')
    await expect(keys).toBeVisible()
    await expect(keys.locator('.cheil-api-card .cheil-api-name')).toHaveText([
      'Claude',
      'GPT',
      'Solar',
    ])
    // the cards come before the subscription logins
    const order = await page.evaluate(() => {
      const api = document.querySelector('[data-testid="cheil-api-keys"]')
      const subs = document.querySelector('.set-sub-cards')
      return (
        !!api && !!subs && !!(api.compareDocumentPosition(subs) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    })
    expect(order).toBe(true)

    const solar = keys.locator('.cheil-api-card[data-provider="upstage"]')
    await expect(page.getByTestId('cheil-api-save-upstage')).toBeDisabled()
    await solar.locator('input.cheil-api-input').fill('up_e2e_dummy_key_1234')
    await page.getByTestId('cheil-api-save-upstage').click()
    await expect(solar.locator('.cheil-api-badge')).toHaveText('사용 중')
    await expect(solar.locator('.cheil-api-saved')).toHaveText('up_…1234')
    await page.screenshot({ path: screenshotPath('cheil-api-keys-settings') })

    // saved where the editors read it, as the AI in use
    const stored = JSON.parse(await readFile(join(userDataDir, 'ai-settings.json'), 'utf8'))
    expect(stored.provider).toBe('upstage')
    expect(stored.providers.upstage).toMatchObject({
      apiKey: 'up_e2e_dummy_key_1234',
      model: 'solar-pro3',
    })

    // the home's engine line names it
    await page.keyboard.press('Escape')
    await expect(page.locator('.account-btn .account-name')).toHaveText('Solar API')
    await expect(page.locator('.account-btn .account-sub')).toHaveText('solar-pro3')

    // removing it goes back to auto, never to another key
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await page.locator('.set-nav-item').filter({ hasText: 'AI' }).first().click()
    await page.getByTestId('cheil-api-remove-upstage').click()
    await expect(solar.locator('input.cheil-api-input')).toBeVisible()
    const after = JSON.parse(await readFile(join(userDataDir, 'ai-settings.json'), 'utf8'))
    expect(after.provider).toBe('auto')
    expect(after.providers.upstage.apiKey).toBe('')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-api-keys')
  }
})

test('Cheil: the first-run guide offers your own API key on its connect page', async () => {
  const launched = await launchShell({ videoDir: 'cheil-api-onboarding', lang: 'ko' })
  const { page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
    await expect(page.locator('.onb-overlay')).toBeVisible()
    await page.locator('.onb-next').click()
    const slide = page.locator('.onb-slide.active')
    await expect(slide.getByTestId('cheil-api-keys')).toBeVisible()
    await expect(slide.locator('.cheil-api-card .cheil-api-name')).toHaveText([
      'Claude',
      'GPT',
      'Solar',
    ])
    await expect(slide.locator('.onb-body-lead')).toContainText('Claude·GPT·Solar API 키')
    // once the slide has moved in, the cards take the page's width and push nothing sideways
    const widths = () =>
      page.evaluate(() => {
        const stage = document.querySelector('.onb-stage') as HTMLElement
        const cards = document.querySelector('.onb-slide.active [data-testid="cheil-api-keys"]')
        return {
          overflow: stage.scrollWidth - stage.clientWidth,
          ratio: (cards?.getBoundingClientRect().width ?? 0) / stage.clientWidth,
        }
      })
    await expect.poll(async () => (await widths()).overflow).toBeLessThanOrEqual(0)
    expect((await widths()).ratio).toBeGreaterThan(0.9)
    await page.screenshot({ path: screenshotPath('cheil-api-keys-onboarding') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-api-onboarding')
  }
})

/** what the stand-in API saw */
interface SeenRequest {
  auth: string
  model: string
  system: string
  user: string
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: a template is filled in one call through an OpenAI-compatible API', async () => {
  const seen: SeenRequest[] = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
        res.writeHead(404).end()
        return
      }
      const body = JSON.parse(raw) as {
        model: string
        messages: Array<{ role: string; content: string }>
      }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
      seen.push({ auth: req.headers.authorization ?? '', model: body.model, system, user })
      // answer every listed blank: the client from the notes, no budget (none was given)
      const answer: Record<string, string> = {}
      for (const m of user.matchAll(/^(S\d+): (\[[^\]\n]+\])/gm)) {
        const [, id, blank] = m
        answer[id!] =
          blank === '[광고주]'
            ? '가상전자'
            : blank === '[총예산]'
              ? '[확인 필요]'
              : `API 채움 ${id}`
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'stub',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify(answer) },
              finish_reason: 'stop',
            },
          ],
        }),
      )
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-api-fill-'))
  await writeFile(
    join(userDataDir, 'ai-settings.json'),
    JSON.stringify({
      provider: 'custom',
      providers: {
        custom: {
          apiKey: 'e2e-test-key',
          model: 'stub-model',
          baseUrl: `http://127.0.0.1:${port}/v1`,
        },
      },
      subscriptionNoticeSeen: true,
    }),
  )
  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-api-fill',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.getByTestId('cheil-template-cheil-brief').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const composer = docs.locator('.ai-input-box textarea').first()
    await expect(composer).toHaveValue(/브리프를 채워 줘/, { timeout: 60_000 })
    await composer.fill(
      '아래 OT 메모로 이 브리프를 채워 줘.\n가상전자 에어린 공기청정기 봄 캠페인 OT 메모',
    )
    await composer.press('Enter')
    await expect(docs.getByText(/양식 칸 \d+개 중 \d+개를 자료로 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
    const docText = await docs.evaluate(
      () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
    )
    await docs.screenshot({ path: screenshotPath('cheil-api-fill-done') })

    // one call, with the person's key and model, asking for one JSON object
    expect(seen).toHaveLength(1)
    expect(seen[0]!.auth).toBe('Bearer e2e-test-key')
    expect(seen[0]!.model).toBe('stub-model')
    expect(seen[0]!.system).toContain('빈칸을 채우는 도우미')
    expect(seen[0]!.user).toContain('[광고주]')
    // every blank written, the open one marked for a person
    expect(docText).toContain('가상전자')
    expect(docText).toContain('API 채움 S')
    expect(docText).not.toMatch(/\[(광고주|캠페인명|타깃|작성일)\]/)
    expect(await docs.evaluate(() => document.body.innerText)).toContain(
      '[확인 필요]로 둔 칸 1개: [총예산]',
    )
  } finally {
    await closeAndSaveVideo(launched, 'cheil-api-fill')
    server.close()
  }
})

test("Cheil: an editor's AI panel with nothing connected leads with adding an API key", async () => {
  const launched = await launchShell({
    videoDir: 'cheil-api-editor-prompt',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
    await page.getByTestId('cheil-template-cheil-brief').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const lead = docs.locator('[data-cheil="api-key"]')
    await expect(lead).toBeVisible({ timeout: 60_000 })
    await expect(lead).toContainText('Claude·GPT·Solar API 키를 넣으면 바로 씁니다')
    await expect(docs.locator('.ai-sub-prompt')).not.toContainText('API 키는 필요 없습니다')
    await docs.screenshot({ path: screenshotPath('cheil-api-editor-prompt') })

    // the button opens Settings → AI on the home, where the key cards are first
    await lead.getByRole('button', { name: 'API 키 넣기' }).click()
    await expect(page.getByTestId('cheil-api-keys')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.set-nav-item.active')).toHaveText('AI')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-api-editor-prompt')
  }
})
