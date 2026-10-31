import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (plan item 3): the campaign's timeline fills itself. A brief
 * opened from a campaign records its card fill and its quick fill; to-dos read
 * out of a pasted mail are recorded with their due days once the person
 * confirms them. A stand-in OpenAI-compatible server on this PC answers both
 * model calls (no real key or account is used).
 */
const CARD = {
  campaign: '에어린 봄 런칭',
  client: '가상전자',
  brand: '에어린',
  start: '2027-03-01',
  end: '2027-04-30',
  budget: '500000000',
  target: '25~34세 1인 가구 직장인',
  kpi: '브랜드 인지도 30%',
  team: '비즈니스13팀',
  author: '홍길동',
}
const FOLDER = '가상전자 - 에어린 봄 런칭'
const MAIL = [
  '안녕하세요, 가상전자 마케팅팀입니다.',
  '어제 보내 주신 제안서 잘 받았습니다. 시안 2안을 11월 3일까지 기획 3팀에서 보내 주시고,',
  '견적서도 다시 한번 보내 주세요.',
].join('\n')

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: the campaign timeline records fills and the to-dos confirmed from a mail', async () => {
  const seen: string[] = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      const body = JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
      let content = '{}'
      if (system.includes('할 일과 마감을 뽑는 도우미')) {
        seen.push('tasks')
        content = JSON.stringify({
          tasks: [
            { task: '시안 2안 송부', owner: '기획 3팀', due: '2026-11-03' },
            { task: '견적서 재송부', owner: '', due: '' },
          ],
        })
      } else if (system.includes('빈칸을 채우는 도우미')) {
        seen.push('fill')
        const answer: Record<string, string> = {}
        for (const m of user.matchAll(/^(S\d+): \[/gm)) answer[m[1]!] = `API 채움 ${m[1]}`
        content = JSON.stringify(answer)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port

  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-record-'))
  const folder = join(userDataDir, 'Cheil 캠페인', FOLDER)
  await mkdir(folder, { recursive: true })
  const at = new Date().toISOString()
  await writeFile(
    join(folder, 'campaign.json'),
    JSON.stringify({
      format: 'cheil-campaign',
      version: 1,
      card: CARD,
      createdAt: at,
      updatedAt: at,
    }),
  )
  await writeFile(
    join(folder, 'timeline.jsonl'),
    `${JSON.stringify({ at, kind: 'created', text: '캠페인을 만들었습니다: 에어린 봄 런칭' })}\n`,
  )
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
    videoDir: 'cheil-auto-record',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1000 }).catch(() => {})
    // a Word document from the campaign: the card fills its common blanks
    await page.locator('[data-testid="cheil-campaign-card"]').first().click()
    const set = page.getByTestId('cheil-campaign-set')
    for (const box of await set.locator('input[type="checkbox"]').all()) {
      const want = (await box.getAttribute('data-skill')) === 'cheil-meeting-notes'
      if ((await box.isChecked()) !== want) await box.click()
    }
    await page.getByTestId('cheil-campaign-open-set').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    await expect(docs.getByText(/카드로 공통 칸 6개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })

    // the quick fill sends the waiting request; the rest of the blanks are written
    const composer = docs.locator('.ai-input-box textarea').first()
    await composer.press('Enter')
    await expect(docs.getByText(/양식 칸 \d+개 중 \d+개를 자료로 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })

    // back home: both fills are in the timeline without anyone writing them
    await page.getByText('Cheil 기획 오피스', { exact: true }).first().click()
    const timeline = page.getByTestId('cheil-campaign-timeline')
    await expect(timeline).toContainText('컨택리포트: 캠페인 카드로 공통 칸 6개를 채움', {
      timeout: 15_000,
    })
    await expect(timeline).toContainText(
      /컨택리포트: 빠른 채우기 — 양식 칸 \d+개 중 \d+개를 자료로 채움/,
      { timeout: 15_000 },
    )

    // a pasted mail: the model's to-dos wait for the person, who keeps one
    await page.getByTestId('cheil-mail-input').fill(MAIL)
    await page.getByTestId('cheil-mail-read').click()
    const review = page.getByTestId('cheil-mail-review')
    await expect(review.locator('li')).toHaveCount(2, { timeout: 30_000 })
    const before = (await readFile(join(folder, 'timeline.jsonl'), 'utf8')).trim().split('\n')
    expect(before.some((line) => line.includes('"task"'))).toBe(false)
    await review.locator('li').nth(1).locator('input[type="checkbox"]').click()
    await page.screenshot({ path: screenshotPath('cheil-auto-record-review') })
    await page.getByTestId('cheil-mail-add').click()
    await expect(timeline).toContainText('시안 2안 송부 (담당 기획 3팀)')
    await expect(timeline).toContainText('마감 2026-11-03')
    await expect(timeline).not.toContainText('견적서 재송부')
    await page.screenshot({ path: screenshotPath('cheil-auto-record-timeline') })

    expect(seen).toEqual(['fill', 'tasks'])
    const lines = (await readFile(join(folder, 'timeline.jsonl'), 'utf8')).trim().split('\n')
    const task = JSON.parse(lines.at(-1)!) as { kind: string; due?: string }
    expect(task).toMatchObject({ kind: 'task', due: '2026-11-03' })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-auto-record')
    server.close()
  }
})
