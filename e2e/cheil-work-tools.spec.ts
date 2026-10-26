import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'

/**
 * Cheil fork: the home's work tools, with no campaign needed. Counting, the
 * spelling rules, amounts and dates run on this PC; the closer spelling
 * check, translation and the mail draft ask a stand-in OpenAI-compatible
 * server on this PC (no real key or account), which never sees the numbers.
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

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: the work tools run from the left nav without a campaign', async () => {
  const asked: Array<{ kind: string; user: string }> = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      const body = JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
      let content = '{}'
      if (system.includes('교정자')) {
        asked.push({ kind: 'spelling', user })
        content = JSON.stringify({
          fixes: [{ find: '결재를 진행', fix: '결제를 진행', why: '돈을 치르는 일' }],
        })
      } else if (system.includes('번역가')) {
        asked.push({ kind: 'translate', user })
        content = JSON.stringify({ translation: 'The budget is {값1}, due {값2}.' })
      } else if (system.includes('메일 초안')) {
        asked.push({ kind: 'mail', user })
        content = JSON.stringify({
          subject: '[{캠페인명}] 자료 송부',
          body: '{받는분}께,\n자료를 보내 드립니다.\n{작성자} 드림',
        })
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const port = (server.address() as AddressInfo).port

  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-tools-'))
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
    videoDir: 'cheil-work-tools',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1000 }).catch(() => {})
    const nav = page.getByTestId('cheil-tools-nav')
    await expect(nav).toContainText('업무 도구')

    // spelling and counts: rules on this PC, then the AI for meaning
    await nav.locator('[data-tool="spelling"]').click()
    const text = page.getByTestId('cheil-tool-text')
    await text.fill('예산 500,000,000원으로 결재를 진행합니다. 검토후 몇일 안에 회신 드릴께요.')
    const counts = page.getByTestId('cheil-tool-counts')
    await expect(counts).toContainText('47자')
    await expect(counts).toContainText('39자')
    const issues = page.getByTestId('cheil-tool-issues')
    await expect(issues).toContainText('고칠 곳 3개')
    await page.getByTestId('cheil-tool-fix-all').click()
    await expect(text).toHaveValue(
      '예산 500,000,000원으로 결재를 진행합니다. 검토 후 며칠 안에 회신 드릴게요.',
    )
    await page.getByTestId('cheil-tool-ai-check').click()
    const aiFixes = page.getByTestId('cheil-tool-ai-fixes')
    await expect(aiFixes).toContainText('결재를 진행 → 결제를 진행', { timeout: 20_000 })
    await aiFixes.getByRole('button', { name: '고치기' }).click()
    await expect(text).toHaveValue(
      '예산 500,000,000원으로 결제를 진행합니다. 검토 후 며칠 안에 회신 드릴게요.',
    )
    await page.screenshot({ path: screenshotPath('cheil-tool-spelling') })

    // amounts and VAT
    await nav.locator('[data-tool="money"]').click()
    await page.getByTestId('cheil-tool-amount').fill('5억 2,000만원')
    await expect(page.getByTestId('cheil-tool-words')).toHaveText(
      '일금 오억이천만원정 (₩520,000,000)',
    )
    const vat = page.getByTestId('cheil-tool-vat')
    await expect(vat).toContainText('52,000,000원')
    await expect(vat).toContainText('572,000,000원')
    await page.locator('input[data-choice="total"]').check()
    await expect(vat).toContainText('472,727,273원')
    await expect(vat).toContainText('47,272,727원')

    // dates: working days with the 2026 holidays
    await nav.locator('[data-tool="dates"]').click()
    await page.getByTestId('cheil-tool-start').fill('2026-09-21')
    await page.getByTestId('cheil-tool-end').fill('2026-10-09')
    await expect(page.getByTestId('cheil-tool-span-result')).toHaveText('19일 · 영업일 11일')
    await expect(page.getByTestId('cheil-tool-span')).toContainText('09-25 추석')
    await page.getByTestId('cheil-tool-target').fill('2026-11-03')
    await expect(page.getByTestId('cheil-tool-dday-result')).toContainText(/^D-\d+ · 화$/)
    await page.screenshot({ path: screenshotPath('cheil-tool-dates') })

    // translation: numbers and dates stay on this PC
    await nav.locator('[data-tool="translate"]').click()
    await page
      .getByTestId('cheil-tool-translate-text')
      .fill('총예산은 5억 원, 마감은 2026-11-03입니다.')
    await page.getByTestId('cheil-tool-translate-run').click()
    await expect(page.getByTestId('cheil-tool-translate-result')).toHaveValue(
      'The budget is 5억 원, due 2026-11-03.',
      { timeout: 20_000 },
    )

    // mail draft without a campaign, then with one
    await nav.locator('[data-tool="mail"]').click()
    // the sender's stance, three steps, each with what it means
    const draft = page.getByTestId('cheil-mail-draft')
    await expect(draft.getByRole('radiogroup', { name: '발신자 태도' })).toContainText(
      '공손하게보통단호하게',
    )
    await draft.locator('input[data-choice="firm"]').check()
    await expect(page.getByTestId('cheil-mail-strength-hint')).toContainText('회신 날짜를 못 박음')
    await page.getByTestId('cheil-mail-sender').fill('홍길동')
    await page.getByTestId('cheil-mail-recipient').fill('김가상 프로님')
    await page.getByTestId('cheil-mail-write').click()
    await expect(page.getByTestId('cheil-mail-body')).toHaveValue(
      '김가상 프로님께,\n자료를 보내 드립니다.\n홍길동 드림',
      { timeout: 20_000 },
    )
    await page.getByTestId('cheil-mail-copy').click()
    await expect(page.getByTestId('cheil-mail-draft').getByRole('status')).toHaveText(
      '복사했습니다.',
    )
    await page
      .getByTestId('cheil-tool-mail-campaign')
      .selectOption({ label: '가상전자 · 에어린 봄 런칭' })
    await page.getByTestId('cheil-mail-write').click()
    await expect(page.getByTestId('cheil-mail-subject')).toHaveValue('[에어린 봄 런칭] 자료 송부', {
      timeout: 20_000,
    })
    await page.screenshot({ path: screenshotPath('cheil-tool-mail') })

    // what the model saw: no amounts, dates or names
    expect(asked.map((a) => a.kind)).toEqual(['spelling', 'translate', 'mail', 'mail'])
    for (const { user } of asked) {
      for (const secret of ['500,000,000', '5억', '2026-11-03', '홍길동', '김가상', '가상전자']) {
        expect(user).not.toContain(secret)
      }
    }

    // the PDF tools open their own window
    const before = app.windows().length
    await nav.locator('[data-tool="pdf"]').click()
    await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThan(before)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-work-tools')
    server.close()
  }
})
