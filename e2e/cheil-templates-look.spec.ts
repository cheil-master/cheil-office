import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (10-26): the four field templates (campaign OT, result report,
 * media plan, contact report), rebuilt after the agency's own documents, open
 * in their editors. Each deck is photographed slide by slide
 * (e2e/artifacts/screenshots/cheil-look-*), so a person can see the layout.
 * Nothing is sent to any model.
 */
const SIDECAR = join(
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

async function slideCount(slides: Page): Promise<number> {
  return slides.evaluate(async () => {
    const api = (
      window as unknown as { slidesApi: { getRenderSlides(): Promise<unknown[] | null> } }
    ).slidesApi
    // null while the deck is still loading
    return (await api.getRenderSlides())?.length ?? 0
  })
}

for (const deck of [
  { skill: 'cheil-brief', name: 'ot', slides: 14, first: '캠페인 OT' },
  { skill: 'cheil-monthly-report', name: 'result', slides: 12, first: '캠페인 결과 보고' },
]) {
  test(`Cheil: the ${deck.name} deck opens with its ${deck.slides} slides`, async () => {
    test.setTimeout(180_000)
    const launched = await launchShell({
      videoDir: `cheil-look-${deck.name}`,
      lang: 'ko',
      onboardingSeen: true,
    })
    const { app, page } = launched
    try {
      await page.getByTestId(`cheil-template-${deck.skill}`).click()
      const slides = await waitForPageWithUrl(app, '://slides/', 60_000)
      await slides.setViewportSize({ width: 1600, height: 1000 }).catch(() => {})
      await expect.poll(() => slideCount(slides), { timeout: 60_000 }).toBe(deck.slides)
      await expect(slides.locator('.slide-list .thumb')).toHaveCount(deck.slides, {
        timeout: 30_000,
      })
      for (let i = 0; i < deck.slides; i++) {
        await slides.locator(`.slide-list .thumb[data-index="${i}"]`).click()
        await slides.waitForTimeout(400)
        await slides.screenshot({
          path: screenshotPath(`cheil-look-${deck.name}-${String(i + 1).padStart(2, '0')}`),
        })
      }
      // the slides are drawn, not text: read the deck's runs (a word at a time)
      const deckText = await slides.evaluate(async () => {
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
      expect(deckText).toContain(deck.first.replace(/\s+/g, ''))
    } finally {
      await closeAndSaveVideo(launched, `cheil-look-${deck.name}`)
    }
  })
}

test('Cheil: the contact report opens in the Word editor', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-look-contact',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.getByTestId('cheil-template-cheil-meeting-notes').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    await docs.setViewportSize({ width: 1400, height: 1600 }).catch(() => {})
    const docText = () =>
      docs.evaluate(
        () => (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
      )
    await expect.poll(docText, { timeout: 60_000 }).toContain('CONTACT REPORT')
    const text = await docText()
    for (const part of ['[회의명]', '요약', '상세 피드백', 'AE 의견', 'NEXT', '- END -']) {
      expect(text).toContain(part)
    }
    await docs.waitForTimeout(1_000)
    await docs.screenshot({ path: screenshotPath('cheil-look-contact'), fullPage: true })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-look-contact')
  }
})

test('Cheil: the media plan opens in the sheets editor', async () => {
  test.skip(!existsSync(SIDECAR), 'the xlsx engine is not built on this PC (npm run native:build)')
  const launched = await launchShell({
    videoDir: 'cheil-look-media',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.getByTestId('cheil-template-cheil-media-plan').click()
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    await sheets.setViewportSize({ width: 1800, height: 1200 }).catch(() => {})
    // the grid is a canvas: copy the overview and the plan's header through the name box
    const nameBox = sheets
      .locator('input[class*="univer"]')
      .filter({ hasNot: sheets.locator('[aria-label]') })
      .first()
    await expect(nameBox).toBeVisible({ timeout: 60_000 })
    await sheets.waitForTimeout(2_000)
    await nameBox.click()
    await nameBox.fill('A1:O13')
    await nameBox.press('Enter')
    await sheets.waitForTimeout(500)
    await sheets.keyboard.press('Control+C')
    await sheets.waitForTimeout(800)
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    for (const part of [
      '미디어 플랜',
      '1. 캠페인 개요',
      '배경 및 목적',
      '2. 매체별 집행 계획',
      'CPV(원)',
    ]) {
      expect(copied).toContain(part)
    }
    await nameBox.click()
    await nameBox.fill('A1')
    await nameBox.press('Enter')
    await sheets.waitForTimeout(800)
    await sheets.screenshot({ path: screenshotPath('cheil-look-media-1') })
    await nameBox.click()
    await nameBox.fill('A40')
    await nameBox.press('Enter')
    await sheets.waitForTimeout(800)
    await sheets.screenshot({ path: screenshotPath('cheil-look-media-2') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-look-media')
  }
})
