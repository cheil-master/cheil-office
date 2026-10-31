/** Cheil fork: onboarding and settings show this product's workflow and support. */
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'

test('Cheil onboarding and settings use one AI entry and product support', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-product-copy',
    lang: 'ko',
    onboardingSeen: false,
  })
  const { page, app } = launched
  try {
    const welcome = page.locator('.onb-slide.active')
    await expect(welcome).toContainText('캠페인 문서와 자료를 한곳에')
    await expect(welcome).not.toContainText('오픈소스 오피스 제품군')
    await page.locator('.onb-next').click()
    await expect(page.locator('.onb-slide.active')).toContainText('AI가 필요하면 설정에서 연결')
    await expect(page.locator('.onb-slide.active .cheil-extra-connections')).not.toHaveAttribute(
      'open',
    )
    const connectionSummary = page.locator('.onb-slide.active .cheil-extra-connections > summary')
    await connectionSummary.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.onb-slide.active')).toHaveAttribute('data-step', 'connect')
    await expect(page.locator('.onb-slide.active .cheil-extra-connections')).toHaveAttribute('open')
    await page.locator('.onb-skip').click()
    await page.locator('.account-btn').click()
    const settings = page.locator('.set-dialog')
    await expect(settings.locator('.set-pane-title')).toHaveText('AI 연결')
    await expect(settings.locator('.set-nav > .set-nav-item')).toHaveCount(3)
    await expect(settings.locator('.set-nav')).not.toContainText('계정')
    await expect(settings.locator('.cheil-extra-connections')).not.toHaveAttribute('open')
    await expect(settings.getByTestId('cheil-api-keys')).toBeHidden()
    await settings.locator('.cheil-extra-connections > summary').click()
    await expect(settings).toContainText('웹 로그인이나 대화·메모리 동기화가 아닙니다')
    await settings.locator('.set-nav > .set-nav-item').filter({ hasText: '정보' }).click()
    await expect(settings).toContainText('github.com/cheil-master/cheil-office')
    await expect(settings).not.toContainText('pblsketch@gmail.com')
    await expect(settings).not.toContainText('업데이트 채널')
    await expect(settings.getByTestId('cheil-manual-updates')).toContainText(
      '자동 업데이트는 사용하지 않습니다',
    )
    await expect(settings).toContainText('Apache')
    await expect(settings.locator('.cheil-legal-details')).not.toHaveAttribute('open')
    await settings.locator('.cheil-legal-details > summary').click()
    await expect(settings.locator('.cheil-legal-text')).toBeVisible()
    await settings.locator('.cheil-legal-details > summary').click()
    await app.evaluate(({ shell }) => {
      shell.openExternal = async () => {}
    })
    await page.screenshot({ path: screenshotPath('cheil-product-about') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-product-copy')
  }
})
