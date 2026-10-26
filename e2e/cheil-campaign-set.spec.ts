import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (plan item 4): a document set opened from a campaign. The
 * chosen templates open in new tabs with the card's values already in their
 * common blanks (no model is called: no AI connection is set up here), the
 * request with the card's lines waits unsent, and the timeline records it.
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
const SIDECAR = resolve(
  __dirname,
  '..',
  'apps',
  'sheets',
  'native',
  'xlsx-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar',
)

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** a scratch profile holding one campaign */
async function profileWithCampaign(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cheil-set-'))
  const folder = join(dir, 'Cheil 캠페인', FOLDER)
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
  return dir
}

/** open the campaign and its set with exactly these templates */
async function openSet(page: Page, skills: string[]) {
  await page.locator('[data-testid="cheil-campaign-card"]').first().click()
  const set = page.getByTestId('cheil-campaign-set')
  await expect(set).toBeVisible()
  for (const box of await set.locator('input[type="checkbox"]').all()) {
    const want = skills.includes((await box.getAttribute('data-skill')) ?? '')
    if ((await box.isChecked()) !== want) await box.click()
  }
  await page.getByTestId('cheil-campaign-open-set').click()
}

test('Cheil: a campaign opens a contact report and the campaign OT with the card in their common blanks', async () => {
  const userDataDir = await profileWithCampaign()
  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-campaign-set',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
    await openSet(page, ['cheil-meeting-notes', 'cheil-brief'])

    // the contact report: its header table carries the card, no common blank is left
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const docText = () =>
      docs.evaluate(
        () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
      )
    await expect.poll(docText, { timeout: 60_000 }).toContain('가상전자')
    const brief = await docText()
    for (const value of ['가상전자 · 에어린 봄 런칭', '비즈니스13팀', `홍길동 · ${today()}`]) {
      expect(brief).toContain(value)
    }
    expect(brief).not.toMatch(/\[(광고주|캠페인명|팀명|작성자|작성일)\]/)
    // the other blanks wait for the quick fill
    expect(brief).toContain('[회의명]')
    await expect(docs.getByText(/카드로 공통 칸 5개를 채웠습니다/)).toBeVisible()
    await expect(docs.locator('.ai-input-box textarea').first()).toHaveValue(/\[캠페인 카드\]/)
    await expect(docs.locator('.ai-message.user, .msg-user')).toHaveCount(0)
    await docs.screenshot({ path: screenshotPath('cheil-campaign-set-brief') })

    // the campaign OT: the deck's text runs carry the card too
    const slides = await waitForPageWithUrl(app, '://slides/', 60_000)
    const deckText = () =>
      slides.evaluate(async () => {
        const api = (window as unknown as { slidesApi: { getRenderSlides(): Promise<unknown> } })
          .slidesApi
        const out: string[] = []
        const walk = (value: unknown, key: string): void => {
          if (typeof value === 'string') {
            if (key === 'text') out.push(value)
          } else if (Array.isArray(value)) {
            for (const item of value) walk(item, key)
          } else if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) walk(v, k)
          }
        }
        walk(await api.getRenderSlides(), '')
        return out.join('')
      })
    await expect.poll(deckText, { timeout: 60_000 }).toContain('가상전자')
    // the runs come a word at a time: compare without whitespace
    const deck = (await deckText()).replace(/\s+/g, '')
    for (const value of [
      '에어린봄런칭',
      '2027-03-01~2027-04-30',
      '500,000,000원',
      '25~34세1인가구직장인',
      '브랜드인지도30%',
      '비즈니스13팀',
    ]) {
      expect(deck).toContain(value)
    }
    expect(deck).not.toMatch(/\[(광고주|캠페인명|캠페인기간|총예산|타깃|KPI|팀명|작성일)\]/)
    await expect(slides.getByText(/카드로 공통 칸 9개를 채웠습니다/)).toBeVisible()
    await slides.screenshot({ path: screenshotPath('cheil-campaign-set-ot') })

    // back home: the view says what opened and the timeline has the set
    await page.getByText('Cheil 기획 오피스', { exact: true }).first().click()
    const view = page.getByTestId('cheil-campaign-view')
    await expect(view.locator('.cheil-set-done')).toContainText(
      '양식 2개를 캠페인 폴더에 만들어 열었습니다',
    )
    // plan item 5: each is a file in the campaign's folder, and its tab shows that file
    const folder = join(userDataDir, 'Cheil 캠페인', FOLDER)
    expect(existsSync(join(folder, '컨택 리포트.docx'))).toBe(true)
    expect(existsSync(join(folder, '캠페인 OT.pptx'))).toBe(true)
    await expect(page.locator('.tab-bar .tab-item:not(.tab-home)')).toContainText([
      '캠페인 OT.pptx',
      '컨택 리포트.docx',
    ])
    // the set's line, then each tab's own card fill (plan item 3), picked up while the view is open
    const timeline = page.getByTestId('cheil-campaign-timeline')
    await expect(timeline).toContainText(
      '문서 세트를 캠페인 폴더에 만들어 엽니다: 캠페인 OT, 컨택 리포트',
    )
    await expect(timeline).toContainText('컨택 리포트: 캠페인 카드로 공통 칸 5개를 채움', {
      timeout: 15_000,
    })
    await expect(timeline).toContainText('캠페인 OT: 캠페인 카드로 공통 칸 9개를 채움', {
      timeout: 15_000,
    })
    await page.screenshot({ path: screenshotPath('cheil-campaign-set-home') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-campaign-set')
  }
})

test('Cheil: a campaign opens the media plan with the card in its header cells', async () => {
  test.skip(!existsSync(SIDECAR), 'the xlsx engine is not built on this PC (npm run native:build)')
  const launched = await launchShell({
    userDataDir: await profileWithCampaign(),
    videoDir: 'cheil-campaign-set-sheet',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await openSet(page, ['cheil-media-plan'])
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    await expect(sheets.getByText(/카드로 공통 칸 \d+개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
    // the grid is a canvas: select the header cells through the name box and copy them
    const nameBox = sheets
      .locator('input[class*="univer"]')
      .filter({ hasNot: sheets.locator('[aria-label]') })
      .first()
    await nameBox.click()
    await nameBox.fill('A1:H8')
    await nameBox.press('Enter')
    await sheets.waitForTimeout(500)
    await sheets.keyboard.press('Control+C')
    await sheets.waitForTimeout(800)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(copied).toContain('가상전자 에어린 봄 런칭 미디어 플랜')
    expect(copied).toContain('500,000,000원')
    expect(copied).toContain('25~34세 1인 가구 직장인')
    expect(copied).not.toContain('[광고주]')
    await sheets.screenshot({ path: screenshotPath('cheil-campaign-set-media-plan') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-campaign-set-sheet')
  }
})

/**
 * Cheil fork (plan item 5): a card change carried into the campaign's open
 * documents. With the pitch analysis and the campaign OT open, the budget changes on the
 * card; both documents change (no model), the view lists where, each panel
 * says so, and the timeline records it.
 */
test('Cheil: changing the budget on the card changes it in the open Word document and deck', async () => {
  const launched = await launchShell({
    userDataDir: await profileWithCampaign(),
    videoDir: 'cheil-campaign-propagate',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1000 }).catch(() => {})
    await openSet(page, ['cheil-pitch-analysis', 'cheil-brief'])
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const slides = await waitForPageWithUrl(app, '://slides/', 60_000)
    await expect(docs.getByText(/카드로 공통 칸 5개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
    await expect(slides.getByText(/카드로 공통 칸 9개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })

    // the card's budget changes on the home
    await page.getByText('Cheil 기획 오피스', { exact: true }).first().click()
    const view = page.getByTestId('cheil-campaign-view')
    await view.getByRole('button', { name: '카드 고치기' }).click()
    await page.locator('form.cheil-campaign-form input[name="budget"]').fill('600000000')
    await page.getByTestId('cheil-campaign-submit').click()

    const list = page.getByTestId('cheil-propagation')
    await expect(list).toBeVisible({ timeout: 20_000 })
    await expect(list).toContainText('경쟁 PT 분석 — 총예산 500,000,000원 → 600,000,000원 1곳')
    await expect(list).toContainText('캠페인 OT — 총예산 500,000,000원 → 600,000,000원 1곳')
    await expect(page.getByTestId('cheil-campaign-timeline')).toContainText(
      '카드 변경 반영: 경쟁 PT 분석 — 총예산 500,000,000원 → 600,000,000원 1곳',
    )
    await page.screenshot({ path: screenshotPath('cheil-campaign-propagate-home') })

    // the brief and the deck now carry the new budget, and their panels say so
    const docText = await docs.evaluate(
      () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
    )
    expect(docText).toContain('600,000,000원')
    expect(docText).not.toContain('500,000,000원')
    await expect(docs.getByText(/캠페인 카드가 바뀌어 이 문서를 고쳤습니다/)).toBeVisible()
    const deck = await slides.evaluate(async () => {
      const api = (window as unknown as { slidesApi: { getRenderSlides(): Promise<unknown> } })
        .slidesApi
      const out: string[] = []
      const walk = (value: unknown, key: string): void => {
        if (typeof value === 'string') {
          if (key === 'text') out.push(value)
        } else if (Array.isArray(value)) {
          for (const item of value) walk(item, key)
        } else if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) walk(v, k)
        }
      }
      walk(await api.getRenderSlides(), '')
      return out.join('').replace(/\s+/g, '')
    })
    expect(deck).toContain('600,000,000원')
    expect(deck).not.toContain('500,000,000원')
    await expect(slides.getByText(/캠페인 카드가 바뀌어 이 문서를 고쳤습니다/)).toBeVisible()
  } finally {
    await closeAndSaveVideo(launched, 'cheil-campaign-propagate')
  }
})

/**
 * Cheil fork (plan item 5): a card change reaches a closed document, after a
 * restart. The pitch analysis is saved in the campaign's folder and the app quits; in
 * the next run the budget changes on the card; the document, which holds the old
 * budget, opens again with the new one (not saved: the person checks and
 * saves it), and the home lists it as reopened.
 */
test('Cheil: after a restart, changing the budget opens the closed document again with it', async () => {
  const userDataDir = await profileWithCampaign()
  const brief = join(userDataDir, 'Cheil 캠페인', FOLDER, '경쟁 PT 분석.docx')
  const first = await launchShell({
    userDataDir,
    videoDir: 'cheil-campaign-reopen-1',
    lang: 'ko',
    onboardingSeen: true,
  })
  try {
    await first.app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = (async () => {
        throw new Error('a campaign document saves in place, never through Save As')
      }) as typeof dialog.showSaveDialog
    })
    await openSet(first.page, ['cheil-pitch-analysis'])
    const docs = await waitForPageWithUrl(first.app, '://docs/', 60_000)
    await expect(docs.getByText(/카드로 공통 칸 5개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
    // the filled brief saves in place
    const before = (await stat(brief)).mtimeMs
    await first.app.evaluate(({ webContents }) => {
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().includes('://docs/'))
        ?.send('menu:command', 'save')
    })
    await expect
      .poll(async () => (await stat(brief)).mtimeMs, { timeout: 15_000 })
      .toBeGreaterThan(before)
  } finally {
    await closeAndSaveVideo(first, 'cheil-campaign-reopen-1')
  }

  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-campaign-reopen-2',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1000 }).catch(() => {})
    await page.locator('[data-testid="cheil-campaign-card"]').first().click()
    const view = page.getByTestId('cheil-campaign-view')
    await view.getByRole('button', { name: '카드 고치기' }).click()
    await page.locator('form.cheil-campaign-form input[name="budget"]').fill('600000000')
    await page.getByTestId('cheil-campaign-submit').click()

    const list = page.getByTestId('cheil-propagation')
    await expect(list).toBeVisible({ timeout: 45_000 })
    await expect(list).toContainText(
      '경쟁 PT 분석 — 총예산 500,000,000원 → 600,000,000원 1곳 — 닫혀 있던 문서를 열어 바꿨습니다. 확인하고 저장하세요',
    )
    await expect(page.getByTestId('cheil-campaign-timeline')).toContainText(
      '카드 변경 반영: 경쟁 PT 분석 — 총예산 500,000,000원 → 600,000,000원 1곳 (닫혀 있던 문서를 열어 바꿈, 저장 전)',
    )
    await expect(page.locator('.tab-bar .tab-item:not(.tab-home)')).toContainText([
      '경쟁 PT 분석.docx',
    ])
    await page.screenshot({ path: screenshotPath('cheil-campaign-reopen-home') })

    // the brief is open again with the new budget, and its panel says so
    const reopened = await waitForPageWithUrl(app, '://docs/', 30_000)
    const docText = await reopened.evaluate(
      () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
    )
    expect(docText).toContain('600,000,000원')
    expect(docText).not.toContain('500,000,000원')
    await expect(reopened.getByText(/캠페인 카드가 바뀌어 이 문서를 고쳤습니다/)).toBeVisible()
    await reopened.screenshot({ path: screenshotPath('cheil-campaign-reopen-brief') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-campaign-reopen-2')
  }
})
