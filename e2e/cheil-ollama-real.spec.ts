import { test, expect } from '@playwright/test'
import { writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  ARTIFACTS_DIR,
  closeAndSaveVideo,
  launchShell,
  screenshotPath,
  waitForPageWithUrl,
} from './helpers'

/**
 * Cheil fork: one real run on this PC's Ollama. A brief template is opened
 * from the home card, fictional orientation notes go in, and the local model
 * fills the document through the docs editor's tools. Nothing leaves the PC.
 *
 * Opt-in (slow on a laptop CPU): CHEIL_REAL_OLLAMA=1 npx playwright test
 *   --config e2e/playwright.config.ts e2e/cheil-ollama-real.spec.ts
 */
const NOTES = [
  '가상전자 에어린 공기청정기 봄 캠페인 OT 메모(2026-10-20)',
  '- 과제: 봄 미세먼지 시즌 전에 2030 1인 가구의 제품 인지도를 올린다',
  '- 타깃: 원룸·오피스텔에 사는 25~34세 직장인',
  '- 제품 특징: 소형, 저소음 22dB, 필터 교체 알림 앱',
  '- 톤: 가볍고 위트 있게',
  "- 꼭 들어갈 것: 로고, '실내 공기질 측정 기준' 고지 문구",
  '- 산출물: 15초 영상 2편(유튜브), 인스타그램 카드뉴스 6장',
  '- 마감: 카드뉴스 11/21, 영상 11/28',
].join('\n')

/**
 * A scratch profile that chooses this PC's Ollama: fresh settings start on
 * `auto` since 2026-10-25 (the deployed app runs on the person's own API key).
 */
async function ollamaProfile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cheil-ollama-'))
  await writeFile(
    join(dir, 'ai-settings.json'),
    JSON.stringify({
      provider: 'ollama',
      providers: { ollama: { apiKey: '', model: 'gemma4:e4b', baseUrl: 'http://127.0.0.1:11434' } },
      subscriptionNoticeSeen: true,
    }),
  )
  return dir
}

/** a money amount ("3,000만 원", "5억", "50,000,000원"): the notes hold none, so any is made up */
const MONEY_RE = /\d[\d,.]*\s*(억|만\s*원|원)/

test('Cheil: the local model fills a contact report template', async () => {
  test.skip(process.env.CHEIL_REAL_OLLAMA !== '1', 'set CHEIL_REAL_OLLAMA=1 to run on Ollama')
  test.setTimeout(30 * 60_000)
  const launched = await launchShell({
    userDataDir: await ollamaProfile(),
    videoDir: 'cheil-ollama',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  const started = Date.now()
  try {
    await page.getByTestId('cheil-template-cheil-meeting-notes').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const composer = docs.locator('.ai-input-box textarea').first()
    await expect(composer).toHaveValue(/컨택리포트를 채워 줘/, { timeout: 60_000 })
    await composer.fill(`아래 OT 메모로 이 컨택리포트를 채워 줘.\n${NOTES}`)
    await composer.press('Enter')
    // the run shows as busy, then ends
    await expect(docs.locator('.ai-input-box')).toBeVisible()
    await expect(docs.locator('.ai-stop-btn')).toBeVisible({ timeout: 30_000 })
    await docs.waitForTimeout(5_000)
    await docs.screenshot({ path: screenshotPath('cheil-ollama-running') })
    await expect
      .poll(async () => docs.evaluate(() => document.querySelector('.ai-stop-btn') === null), {
        timeout: 40 * 60_000,
        intervals: [10_000],
      })
      .toBe(true)
    await docs.screenshot({ path: screenshotPath('cheil-ollama-done') })
    const bodyText = await docs.evaluate(() => document.body.innerText)
    // the document alone, without the AI panel (which repeats the notes)
    const docText = await docs.evaluate(
      () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
    )
    const out = `${ARTIFACTS_DIR}/cheil-ollama-result.txt`
    await mkdir(dirname(out), { recursive: true })
    await writeFile(
      out,
      `elapsed ${Math.round((Date.now() - started) / 1000)}s\n\n--- document ---\n${docText}\n\n--- whole window ---\n${bodyText}`,
      'utf8',
    )
    expect(bodyText).not.toContain('시간 초과')
    expect(bodyText).toMatch(/양식 칸 \d+개 중 [1-9]\d*개를 자료로 채웠습니다/)
    // the client named in the notes reaches the header table
    expect(docText).toContain('가상전자')
    expect(docText).not.toContain('[광고주]')
    // no budget is invented
    expect(docText).not.toMatch(MONEY_RE)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-ollama')
  }
})

test('Cheil: the local model fills a kickoff deck in one call', async () => {
  test.skip(process.env.CHEIL_REAL_OLLAMA !== '1', 'set CHEIL_REAL_OLLAMA=1 to run on Ollama')
  test.setTimeout(30 * 60_000)
  const launched = await launchShell({
    userDataDir: await ollamaProfile(),
    videoDir: 'cheil-ollama-deck',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  const started = Date.now()
  const dumpEventsRef: { current: (() => Promise<unknown>) | null } = { current: null }
  try {
    await page.getByTestId('cheil-template-cheil-brief').click()
    const slides = await waitForPageWithUrl(app, '://slides/', 60_000)
    // diagnostics: why a slides view goes away mid-run
    const events: string[] = []
    const note = (line: string) =>
      events.push(`${Math.round((Date.now() - started) / 1000)}s ${line}`)
    slides.on('crash', () => note('page crash'))
    slides.on('close', () => note('page close'))
    slides.on('console', (msg) => {
      if (msg.type() === 'error') note(`console error: ${msg.text().slice(0, 300)}`)
    })
    slides.on('pageerror', (err) => note(`page error: ${String(err).slice(0, 300)}`))
    app.on('window', (w) => note(`new window ${w.url()}`))
    const dumpEvents = () =>
      writeFile(`${ARTIFACTS_DIR}/cheil-ollama-deck-events.txt`, events.join('\n'), 'utf8').catch(
        () => undefined,
      )
    dumpEventsRef.current = dumpEvents
    const composer = slides.locator('.ai-input-box textarea').first()
    await expect(composer).toHaveValue(/OT 및 킥오프 양식을 채워 줘/, { timeout: 60_000 })
    await composer.fill(`아래 OT 메모로 이 OT 및 킥오프 양식을 채워 줘. 팀명: 기획 3팀\n${NOTES}`)
    await composer.press('Enter')
    await expect(slides.locator('.ai-stop-btn')).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(async () => slides.evaluate(() => document.querySelector('.ai-stop-btn') === null), {
        timeout: 25 * 60_000,
        intervals: [5_000],
      })
      .toBe(true)
    await slides.screenshot({ path: screenshotPath('cheil-ollama-deck-done') })
    const bodyText = await slides.evaluate(() => document.body.innerText)
    // the slides are drawn on a canvas: read the deck's text runs from the editor
    const deckText = await slides.evaluate(async () => {
      const api = (window as unknown as { slidesApi: { getRenderSlides(): Promise<unknown> } })
        .slidesApi
      const out: string[] = []
      const walk = (value: unknown, key: string): void => {
        if (typeof value === 'string') {
          if (key === 'text' && value.trim()) out.push(value)
        } else if (Array.isArray(value)) {
          for (const item of value) walk(item, key)
        } else if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) walk(v, k)
        }
      }
      walk(await api.getRenderSlides(), '')
      return out.join('\n')
    })
    const out = `${ARTIFACTS_DIR}/cheil-ollama-deck-result.txt`
    await mkdir(dirname(out), { recursive: true })
    await writeFile(
      out,
      `elapsed ${Math.round((Date.now() - started) / 1000)}s\n\n--- deck ---\n${deckText}\n\n--- window ---\n${bodyText}`,
      'utf8',
    )
    expect(bodyText).toMatch(/양식 칸 \d+개 중 [1-9]\d*개를 자료로 채웠습니다/)
    expect(deckText).toContain('가상전자')
    // no budget is invented
    expect(deckText).not.toMatch(MONEY_RE)
  } finally {
    await mkdir(ARTIFACTS_DIR, { recursive: true }).catch(() => undefined)
    await dumpEventsRef.current?.()
    await closeAndSaveVideo(launched, 'cheil-ollama-deck')
  }
})

const QUOTE = [
  '가상전자 에어린 봄 캠페인 미디어브리프',
  '- 총예산: 55,000,000원, VAT 별도',
  '- 기간: 2026-11-01~2026-11-30',
  '- 핵심 타깃: 25~34세 1인 가구',
  '- 목적: 공기청정기 신제품 인지도 확대',
  '- 요청: 유튜브와 인스타그램 중심 매체 전략 제안',
].join('\n')

test('Cheil: the local model fills the media brief workbook in one call', async () => {
  test.skip(process.env.CHEIL_REAL_OLLAMA !== '1', 'set CHEIL_REAL_OLLAMA=1 to run on Ollama')
  test.setTimeout(30 * 60_000)
  const launched = await launchShell({
    userDataDir: await ollamaProfile(),
    videoDir: 'cheil-ollama-sheet',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  const started = Date.now()
  try {
    await page.getByTestId('cheil-template-cheil-media-plan').click()
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    const composer = sheets.locator('.ai-input-box textarea').first()
    await expect(composer).toHaveValue(/미디어브리프를 채워 줘/, { timeout: 60_000 })
    await composer.fill(`아래 매체 견적으로 이 미디어브리프를 채워 줘.\n${QUOTE}`)
    await composer.press('Enter')
    await expect(sheets.locator('.ai-stop-btn')).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(async () => sheets.evaluate(() => document.querySelector('.ai-stop-btn') === null), {
        timeout: 25 * 60_000,
        intervals: [5_000],
      })
      .toBe(true)
    await sheets.waitForTimeout(2_000)
    await sheets.screenshot({ path: screenshotPath('cheil-ollama-sheet-done') })
    const panelText = await sheets.evaluate(() => document.body.innerText)
    // the grid is a canvas: select the filled block through the name box and copy it
    const nameBox = sheets
      .locator('input[class*="univer"]')
      .filter({ hasNot: sheets.locator('[aria-label]') })
      .first()
    await nameBox.click()
    await nameBox.fill('A1:H46')
    await nameBox.press('Enter')
    await sheets.waitForTimeout(500)
    await sheets.keyboard.press('Control+C')
    await sheets.waitForTimeout(800)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    const out = `${ARTIFACTS_DIR}/cheil-ollama-sheet-result.txt`
    await mkdir(dirname(out), { recursive: true })
    await writeFile(
      out,
      `elapsed ${Math.round((Date.now() - started) / 1000)}s\n\n--- A1:H46 ---\n${copied}\n\n--- window ---\n${panelText}`,
      'utf8',
    )
    expect(panelText).toMatch(/양식 칸 \d+개 중 [1-9]\d*개/)
    expect(copied).toContain('가상전자')
    expect(copied).toMatch(/55,?000,?000/)
    expect(copied).not.toContain('[광고주]')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-ollama-sheet')
  }
})
