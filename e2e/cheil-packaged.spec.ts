import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork: the packaged app (apps/shell/release/win-unpacked, the same
 * payload as the installer) starts on a scratch profile, shows its home with
 * the agency templates, and opens the media plan workbook through the bundled
 * xlsx engine. Opt-in after `npm run dist:win`: CHEIL_PACKAGED=1.
 */
const EXE = resolve(__dirname, '../apps/shell/release/win-unpacked/CheilOffice.exe')

test('Cheil: the packaged app opens its home and an Excel template', async () => {
  test.skip(
    process.env.CHEIL_PACKAGED !== '1' || !existsSync(EXE),
    'set CHEIL_PACKAGED=1 after dist:win',
  )
  test.setTimeout(180_000)
  const userData = await mkdtemp(join(tmpdir(), 'cheil-packaged-'))
  await writeFile(join(userData, 'app-settings.json'), JSON.stringify({ onboardingSeen: true }))
  await writeFile(
    join(userData, 'ai-settings.json'),
    JSON.stringify({ providers: {}, subscriptionNoticeSeen: true }),
  )
  const { ELECTRON_RUN_AS_NODE: _drop, ...env } = process.env
  // a packaged app ignores GENOFFICE_USER_DATA; the Chromium switch keeps it off the real profile
  const app = await electron.launch({
    executablePath: EXE,
    args: [`--user-data-dir=${userData}`],
    env: { ...env, GENOFFICE_LANG: 'ko', GENOFFICE_NO_SPARE_VIEW: '1' },
  })
  try {
    const page = await app.firstWindow()
    await expect(page.locator('section.cheil-templates')).toBeVisible({ timeout: 60_000 })
    expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true)
    await page.screenshot({ path: screenshotPath('cheil-packaged-home') })
    await page.getByTestId('cheil-template-cheil-media-plan').click()
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    await expect
      .poll(async () => sheets.evaluate(() => document.body.innerText), { timeout: 60_000 })
      .toContain('미디어 플랜')
    await sheets.waitForTimeout(3_000)
    await sheets.screenshot({ path: screenshotPath('cheil-packaged-media-plan') })
  } finally {
    await app
      .evaluate(({ dialog }) => {
        dialog.showMessageBox = (async () => ({
          response: 1,
          checkboxChecked: false,
        })) as typeof dialog.showMessageBox
      })
      .catch(() => {})
    await app.close().catch(() => {})
  }
})
