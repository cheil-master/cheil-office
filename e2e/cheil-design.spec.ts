/** Cheil fork: real launcher/navigation/theme regression checks, no AI calls. */
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

test('approved home retains eight app actions, two rows, tools and theme switching', async () => {
  const launched = await launchShell({ videoDir: 'cheil-design', lang: 'ko', onboardingSeen: true })
  const { page, app } = launched
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
    const folders = page.locator('.cheil-office-folder')
    await expect(folders).toHaveCount(8)
    const layout = await folders.evaluateAll((nodes) => ({
      rows: new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))).size,
      labels: nodes.map((n) => n.textContent),
    }))
    expect(layout.rows).toBe(2)
    const appsBox = await page.locator('.cheil-office-apps').boundingBox()
    const recentsBox = await page.locator('.recents').boundingBox()
    expect(recentsBox!.x).toBeGreaterThan(appsBox!.x + appsBox!.width)
    await expect(page.locator('.cheil-app-heading')).not.toContainText('PDF')
    await page.getByTestId('cheil-tools-toggle').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(page.getByTestId('cheil-tools-toggle')).toBeFocused()
    expect(layout.labels).toEqual(expect.arrayContaining(['Word', 'Excel', 'PPT', 'PDF']))
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.fonts.check('14px "Pretendard Variable"'))).toBe(true)
    await expect(page.locator('.tab-home .tab-title')).toHaveText('홈')
    for (const mode of ['light', 'dark', 'system'] as const) {
      await page.evaluate((theme) => window.aiOffice.setTheme(theme), mode)
      await expect.poll(() => page.evaluate(() => window.aiOffice.getTheme())).toBe(mode)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
        .toBe(mode === 'system' ? null : mode)
      if (mode !== 'system') {
        const logo = page.locator(mode === 'light' ? '.cheil-brand-light' : '.cheil-brand-dark')
        await expect(logo).toBeVisible()
        expect(await logo.evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
        if (mode === 'dark') {
          await folders.first().hover()
          const colors = await folders.first().evaluate((n) => ({
            bg: getComputedStyle(n, '::after').backgroundColor,
            expected: getComputedStyle(document.querySelector('.cheil-tools-edge')!)
              .backgroundColor,
          }))
          expect(colors.bg).toBe(colors.expected)
          await page.mouse.move(0, 0)
        }
        await page.screenshot({ path: screenshotPath(`cheil-design-${mode}`) })
      }
    }
    await page.getByTestId('cheil-tools-toggle').click()
    await expect(page.locator('dialog[open]')).toBeVisible()
    await expect(page.locator('.cheil-tools-nav [data-tool]')).toHaveCount(7)
    await page.locator('[data-tool="formula"]').click()
    await expect(page.getByTestId('cheil-tool-formula')).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await page.getByTestId('cheil-tools-toggle').click()
    await page.locator('[data-tool="money"]').click()
    await expect(page.getByTestId('cheil-tool-money')).toBeVisible()
    await page.getByTestId('cheil-nav-knowledge').click()
    await expect(page.locator('.cheil-tool-page')).toBeVisible()
    await expect(page.getByTestId('cheil-tools-nav')).toBeHidden()
    await expect(page.getByTestId('cheil-tools-toggle')).toHaveCount(0)
    await page.getByTestId('cheil-nav-files').click()
    await expect(page.locator('.recents')).toBeVisible()
    await expect(page.locator('.cheil-office-apps')).toBeHidden()
    await page.getByTestId('cheil-nav-home').click()
    await page.locator('[data-app="docx"]').click()
    const docs = await waitForPageWithUrl(app, '://docs/', 60_000)
    await docs.evaluate(() => document.fonts.ready)
    expect(await docs.evaluate(() => document.fonts.check('14px "Pretendard Variable"'))).toBe(true)
    await expect(page.locator('.tab-item:not(.tab-home)')).toHaveCount(1)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-design')
  }
})

test('campaign document box opens the existing campaign card and timeline', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-design-campaign',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page } = launched
  try {
    await page.getByTestId('cheil-nav-campaigns').click()
    await page.locator('.cheil-campaign-empty-box').click()
    await page.locator('input[name="campaign"]').fill('에어린 디자인 검증')
    await page.locator('input[name="client"]').fill('가상전자')
    await page.getByTestId('cheil-campaign-submit').click()
    await expect(page.getByTestId('cheil-campaign-view')).toBeVisible()
    await expect(page.getByTestId('cheil-campaign-card')).toContainText('에어린 디자인 검증')
    await expect(page.locator('.cheil-box-paper')).toHaveCount(2)
    await page
      .getByTestId('cheil-campaign-view')
      .getByRole('button', { name: '닫기', exact: true })
      .click()
    await page.screenshot({ path: screenshotPath('cheil-design-campaign-box') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-design-campaign')
  }
})
