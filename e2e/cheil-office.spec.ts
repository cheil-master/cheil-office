import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork: the branded home, its agency template row, and a card opening
 * its template as a new document with the request waiting in the AI panel.
 * Nothing is sent to any model here.
 */
test('Cheil: home shows the agency templates and a card prefills a new document', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-office',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 860 }).catch(() => {})
    const row = page.locator('section.cheil-templates')
    await expect(row).toBeVisible()
    await expect(row.locator('.section-label')).toHaveText('광고 문서 양식')
    await expect(row.locator('.quick-card')).toHaveCount(6)
    expect(await page.title()).toContain('Cheil 기획 오피스')
    await page.screenshot({ path: screenshotPath('cheil-home') })

    await page.getByTestId('cheil-template-cheil-brief').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    const composer = docs.locator('.ai-input-box textarea').first()
    await expect(composer).toHaveValue(/OT 자료와 회의 메모로 이 브리프를 채워 줘/, {
      timeout: 60_000,
    })
    // the skill rides along as a chip and nothing has been sent
    await expect(docs.getByText('크리에이티브 브리프', { exact: false }).first()).toBeVisible()
    await expect(docs.locator('.ai-message.user, .msg-user')).toHaveCount(0)
    await docs.screenshot({ path: screenshotPath('cheil-brief-prefilled') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-office')
  }
})

test('Cheil: the media plan card opens its workbook in the sheets editor', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-office-sheets',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.getByTestId('cheil-template-cheil-media-plan').click()
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    // the workbook opened through the xlsx engine: its title cell is on screen
    await expect
      .poll(async () => sheets.evaluate(() => document.body.innerText), { timeout: 60_000 })
      .toContain('미디어 플랜')
    await sheets.waitForTimeout(3_000)
    await sheets.screenshot({ path: screenshotPath('cheil-media-plan-open') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-office-sheets')
  }
})
