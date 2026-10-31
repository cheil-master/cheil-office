import type { CheilCampaignApi } from '../apps/shell/src/shared/cheil-campaign-api'
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
const EXE =
  process.env.CHEIL_PACKAGED_EXE ||
  resolve(__dirname, '../apps/shell/release/win-unpacked/CheilOffice.exe')

test('Cheil: the packaged app opens its home and an Excel template', async () => {
  test.skip(
    process.env.CHEIL_PACKAGED !== '1' || !existsSync(EXE),
    'set CHEIL_PACKAGED=1 after dist:win',
  )
  test.setTimeout(300_000)
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
    args: [`--user-data-dir=${userData}`, '--disable-backgrounding-occluded-windows'],
    env: {
      ...env,
      GENOFFICE_LANG: 'ko',
      GENOFFICE_NO_SPARE_VIEW: '1',
      GENOFFICE_USER_DATA: userData,
      CHEIL_WIKI_DIR: join(userData, 'wiki'),
      APPIMAGE: 'cheil-qa',
    },
  })
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.show()
      win.focus()
      win.setSize(1440, 960)
    })
    await expect(page.locator('section.cheil-templates')).toBeVisible({ timeout: 60_000 })
    expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true)
    await page.evaluate(() => window.aiOffice.setTheme('dark'))
    await expect(page.locator('.cheil-office-folder')).toHaveCount(8)
    await page.getByTestId('cheil-tools-toggle').click()
    await expect(page.locator('dialog[open] [data-tool]')).toHaveCount(7)
    await page.locator('[data-tool="dates"]').click()
    await expect(page.getByTestId('cheil-tool-target')).toBeVisible()
    await page.screenshot({ path: screenshotPath('cheil-packaged-dates') })
    await page.getByTestId('cheil-nav-home').click()
    await page.screenshot({ path: screenshotPath('cheil-packaged-home') })
    // Cheil fork: the release carries this product's support and manual-update notice.
    await page.locator('.account-btn').click()
    await expect(page.locator('.set-pane-title')).toHaveText('AI 연결')
    await page.locator('.set-nav > .set-nav-item').filter({ hasText: '정보' }).click()
    await expect(page.locator('.set-dialog')).toContainText('github.com/cheil-master/cheil-office')
    await expect(page.locator('.set-dialog')).not.toContainText('pblsketch@gmail.com')
    await expect(page.locator('.set-dialog')).toContainText('champ.lee@samsung.com')
    await expect(page.locator('.set-dialog')).not.toContainText('업데이트 채널')
    await page.locator('.set-close').click()
    const wikiCreated = await page.evaluate(async () => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      return api.wiki({
        op: 'addText',
        title: '오로라7 패키지 검수',
        body: '패키지의 위키 저장과 검색을 확인합니다.',
      })
    })
    expect(wikiCreated.ok).toBe(true)
    await page.getByTestId('cheil-nav-knowledge').click()
    await expect(page.getByTestId('cheil-wiki')).toContainText('오로라7 패키지 검수')
    await page.getByTestId('cheil-nav-home').click()
    await page.getByTestId('cheil-template-cheil-media-plan').click()
    const sheets = await waitForPageWithUrl(app, '://sheets/', 60_000)
    await expect
      .poll(async () => sheets.evaluate(() => document.body.innerText), { timeout: 60_000 })
      .toContain('미디어브리프')
    await sheets.waitForTimeout(3_000)
    // Embedded editor CDP screenshots can stall on Windows; verify its rendered DOM below.
    // Cheil fork: every packaged editor must actually open, without AI or real files.
    const editors = [
      ['docx', 'docs'],
      ['pptx', 'slides'],
      ['md', 'markdown'],
      ['html', 'html'],
      ['xmind', 'mindmap'],
      ['hwp', 'hwp'],
      ['pdf', 'pdf'],
    ]
    for (const [ext, protocol] of editors) {
      await page.locator('.tab-home').click()
      await page.locator(`[data-app="${ext}"]`).click()
      const editor = await waitForPageWithUrl(app, `://${protocol}/`, 60_000)
      await expect.poll(() => editor.locator('body').innerText(), { timeout: 30_000 }).not.toBe('')
      console.log(`Checking packaged editor: ${protocol}`)
      await expect
        .poll(
          async () =>
            editor.evaluate(async () => {
              const faces = await document.fonts.load('14px "Pretendard Variable"')
              return faces.length > 0 && document.fonts.check('14px "Pretendard Variable"')
            }),
          { timeout: 30000, message: `${protocol} must load the bundled Pretendard font` },
        )
        .toBe(true)
    }
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
