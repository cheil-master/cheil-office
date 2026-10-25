import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'

/**
 * Cheil fork (plan items 6, 7): a mail draft from a campaign. The person
 * picks the situation, reader and tone; the model gets the names of the facts
 * and the history with its numbers taken out, never the values; the app puts
 * them back into the draft; copying it records a timeline line. A stand-in
 * OpenAI-compatible server on this PC answers (no real key or account).
 */
const CARD = {
  campaign: '에어린 봄 런칭',
  client: '가상전자',
  brand: '에어린',
  start: '2027-03-01',
  end: '2027-04-30',
  budget: '600000000',
  target: '25~34세 1인 가구 직장인',
  kpi: '브랜드 인지도 30%',
  team: '비즈니스13팀',
  author: '홍길동',
}
const FOLDER = '가상전자 - 에어린 봄 런칭'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: a mail draft is written from the campaign without sending its facts', async () => {
  const asked: Array<{ system: string; user: string }> = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      const body = JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
      asked.push({ system, user })
      // the model names the facts; the date in the person's points comes back as {값N}
      const value = /\{(값\d+)\}/.exec(user.slice(user.indexOf('꼭 넣을 말')))?.[1] ?? '값1'
      const content = JSON.stringify({
        subject: '[{캠페인명}] 캠페인 제안서 송부',
        body: [
          '{받는분}께,',
          '{광고주} {캠페인명} 제안서를 보내 드립니다. 첨부: {첨부문서}',
          '총예산은 {총예산}, 목표는 {KPI}입니다.',
          `회신은 {${value}}까지 꼭 부탁드립니다. 미팅은 {미팅일}에 하겠습니다.`,
          '{작성자} 드림 ({팀명})',
        ].join('\n'),
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port

  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-mail-'))
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
    [
      { at, kind: 'created', text: '캠페인을 만들었습니다: 에어린 봄 런칭' },
      { at, kind: 'fill', text: '캠페인 제안서: 캠페인 카드로 공통 칸 8개를 채움' },
    ]
      .map((e) => `${JSON.stringify(e)}\n`)
      .join(''),
  )
  // a document in the folder, for the "attached" line
  await writeFile(join(folder, '캠페인 제안서.pptx'), 'stand-in')
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
    videoDir: 'cheil-mail-draft',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1100 }).catch(() => {})
    await page.locator('[data-testid="cheil-campaign-card"]').first().click()
    const panel = page.getByTestId('cheil-mail-draft')
    await expect(panel).toBeVisible()
    // the last thing was a fill, so "sending material" is suggested
    await expect(panel.locator('input[data-choice="send"]')).toBeChecked()
    await panel.locator('input[data-choice="firm"]').check()
    await page.getByTestId('cheil-mail-recipient').fill('김가상 프로님')
    await page.getByTestId('cheil-mail-points').fill('수정안은 2027-02-05까지 회신 부탁')
    await page.getByTestId('cheil-mail-write').click()

    const bodyBox = page.getByTestId('cheil-mail-body')
    await expect(bodyBox).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('cheil-mail-subject')).toHaveValue(
      '[에어린 봄 런칭] 캠페인 제안서 송부',
    )
    const body = await bodyBox.inputValue()
    expect(body).toContain('김가상 프로님께,')
    expect(body).toContain(
      '가상전자 에어린 봄 런칭 제안서를 보내 드립니다. 첨부: 캠페인 제안서.pptx',
    )
    expect(body).toContain('총예산은 600,000,000원, 목표는 브랜드 인지도 30%입니다.')
    expect(body).toContain(
      '회신은 2027-02-05까지 꼭 부탁드립니다. 미팅은 [확인 필요]에 하겠습니다.',
    )
    expect(body).toContain('홍길동 드림 (비즈니스13팀)')
    await expect(panel.locator('.cheil-mail-warn')).toContainText('[확인 필요] 1곳')

    // what left for the model: the tone and the names, not the facts
    expect(asked).toHaveLength(1)
    const { system, user } = asked[0]!
    expect(system).toContain('자료 송부')
    expect(system).toContain('단호하게')
    for (const secret of ['600,000,000', '가상전자', '홍길동', '김가상', '2027-02-05', '30%']) {
      expect(user).not.toContain(secret)
    }
    await page.screenshot({ path: screenshotPath('cheil-mail-draft') })

    // copy: the clipboard has it, the timeline records it
    await page.getByTestId('cheil-mail-copy').click()
    await expect(panel.getByRole('status')).toContainText('복사했습니다')
    // Windows hands the text back with \r\n line ends
    const copied = (await app.evaluate(({ clipboard }) => clipboard.readText())).replace(
      /\r\n/g,
      '\n',
    )
    expect(copied, copied.slice(0, 80)).toBeTruthy()
    expect(copied.startsWith('[에어린 봄 런칭] 캠페인 제안서 송부\n\n김가상 프로님께,')).toBe(true)
    await expect(page.getByTestId('cheil-campaign-timeline')).toContainText(
      '메일 초안(광고주용 · 자료 송부 · 단호하게): [에어린 봄 런칭] 캠페인 제안서 송부',
    )
    const lines = (await readFile(join(folder, 'timeline.jsonl'), 'utf8')).trim().split('\n')
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({ kind: 'mail' })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-mail-draft')
    server.close()
  }
})
