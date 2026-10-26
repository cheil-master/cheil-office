import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'

/**
 * Cheil fork (10-26): "내 지식 베이스" from the home's left nav. Material put
 * in (a real Word file, a text file, a pasted mail) becomes Markdown notes
 * filed by themselves under Cheil/지식/<광고주>/<종류> in the vault; search
 * reads the vault on this PC; the AI summary asks a stand-in
 * OpenAI-compatible server on this PC (no real key or account).
 */
const MEETING_DOCX = join(
  __dirname,
  '..',
  'apps',
  'shell',
  'resources',
  'builtin-skills',
  'cheil-meeting-notes',
  'assets',
  '컨택 리포트.docx',
)
const MAIL = [
  '보낸 사람: 가상전자 마케팅팀',
  '제목: 오로라7 예산 조정 요청',
  '',
  '오로라7 디지털 예산을 2.0억에서 2.3억으로 늘려 주세요. 3/18 까지 수정안 부탁드립니다.',
].join('\n')

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: material put in becomes filed notes in the vault, searched there', async () => {
  const asked: string[] = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      const body = JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }
      asked.push(body.messages.find((m) => m.role === 'user')?.content ?? '')
      const content = '- 오로라7 디지털 예산은 2.3억으로 조정 요청 [[오로라7 예산 조정 요청]]'
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const port = (server.address() as AddressInfo).port

  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-knowledge-'))
  // a campaign whose client is 가상전자: the knowledge base knows that name
  const folder = join(userDataDir, 'Cheil 캠페인', '가상전자 - 오로라7 봄 출시')
  await mkdir(folder, { recursive: true })
  const at = new Date().toISOString()
  await writeFile(
    join(folder, 'campaign.json'),
    JSON.stringify({
      format: 'cheil-campaign',
      version: 1,
      card: { campaign: '오로라7 봄 출시', client: '가상전자' },
      createdAt: at,
      updatedAt: at,
    }),
  )
  await writeFile(join(folder, 'timeline.jsonl'), '')
  const vault = join(userDataDir, 'vault')
  await mkdir(vault, { recursive: true })
  await writeFile(
    join(userDataDir, 'cheil-settings.json'),
    JSON.stringify({ obsidianVault: vault }),
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
  const inbox = join(userDataDir, 'inbox')
  await mkdir(inbox)
  const docx = join(inbox, '가상전자 광고주 회의록.docx')
  await copyFile(MEETING_DOCX, docx)
  const memo = join(inbox, '견적 메모.txt')
  await writeFile(memo, '에어린 여름 미디어 견적. 유튜브 CPM 4,800원.', 'utf8')

  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-knowledge',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1000 }).catch(() => {})
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: paths })) as never
      },
      [docx, memo],
    )
    await page.getByTestId('cheil-tools-nav').locator('[data-tool="knowledge"]').click()
    const view = page.getByTestId('cheil-tool-knowledge')
    await expect(view).toContainText('관련 자료를 여기에 넣으세요')
    await expect(view).toContainText('볼트: vault')

    // files from the dialog: the Word file is read for real
    await view.getByRole('button', { name: '파일 고르기' }).click()
    await expect(view).toContainText('가상전자 광고주 회의록.docx → 가상전자 › 회의록', {
      timeout: 20_000,
    })
    await expect(view).toContainText('견적 메모.txt → 미분류 › 견적')

    // a mail pasted anywhere in the view
    await page.evaluate((text) => {
      const data = new DataTransfer()
      data.setData('text/plain', text)
      document.body.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    }, MAIL)
    await expect(view).toContainText('오로라7 예산 조정 요청 → 가상전자 › 메일')

    const tree = page.getByTestId('cheil-kb-tree')
    for (const text of ['가상전자', '회의록 (1)', '메일 (1)', '미분류', '견적 (1)']) {
      await expect(tree).toContainText(text)
    }
    const filed = join(vault, 'Cheil', '지식', '가상전자')
    expect((await readdir(join(filed, '회의록'))).sort()).toEqual(['가상전자 광고주 회의록.md'])
    const mailNote = await readFile(join(filed, '메일', '오로라7 예산 조정 요청.md'), 'utf8')
    expect(mailNote).toContain('kind: "메일"')
    expect(mailNote).toContain('2.3억')
    const meetingNote = await readFile(join(filed, '회의록', '가상전자 광고주 회의록.md'), 'utf8')
    expect(meetingNote.length).toBeGreaterThan(200)

    // search the vault, then one AI call over the excerpts found
    await page.getByTestId('cheil-kb-query').fill('오로라7 예산')
    await page.getByTestId('cheil-kb-query').press('Enter')
    const hits = page.getByTestId('cheil-kb-hits')
    await expect(hits).toContainText('오로라7 예산 조정 요청')
    await expect(view).toContainText('볼트 노트 3개 중 1개')
    await view.getByRole('button', { name: 'AI 요약' }).click()
    await expect(page.getByTestId('cheil-kb-summary')).toContainText('2.3억으로 조정 요청', {
      timeout: 20_000,
    })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('질문: 오로라7 예산')
    expect(asked[0]).toContain('2.3억')
    // only what search found went out: not the unrelated quote memo
    expect(asked[0]).not.toContain('CPM')
    await page.screenshot({ path: screenshotPath('cheil-knowledge') })

    // a found note opens in the Markdown editor
    await hits.getByRole('button').first().click()
    await expect
      .poll(
        () =>
          app.evaluate(({ webContents }) =>
            webContents.getAllWebContents().some((w) => /markdown/i.test(w.getURL())),
          ),
        { timeout: 15_000 },
      )
      .toBe(true)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-knowledge')
    server.close()
  }
})
