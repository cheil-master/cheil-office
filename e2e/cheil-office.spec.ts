import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/**
 * Cheil fork (plan item 2): a campaign made from the home's "내 캠페인" opens
 * on its card and timeline; a note and a card change go into the timeline and
 * into the campaign's folder (here under the scratch userData).
 */
test('Cheil: a new campaign opens on its timeline, and notes and card changes are recorded', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-campaigns',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page, userDataDir } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 900 }).catch(() => {})
    const row = page.locator('section.cheil-campaigns')
    await expect(row.locator('.section-label')).toHaveText('내 캠페인')
    await expect(row.locator('.cheil-campaigns-empty')).toBeVisible()

    await page.getByTestId('cheil-campaign-add').click()
    const form = page.locator('form.cheil-campaign-form')
    await form.locator('input[name="campaign"]').fill('에어린 봄 런칭')
    await form.locator('input[name="client"]').fill('가상전자')
    await form.locator('input[name="brand"]').fill('에어린')
    await form.locator('input[name="budget"]').fill('500000000')
    await form.locator('input[name="start"]').fill('2027-03-01')
    await form.locator('input[name="end"]').fill('2027-04-30')
    await form.locator('textarea[name="target"]').fill('30대 1인 가구 직장인')
    await form.locator('textarea[name="kpi"]').fill('브랜드 인지도 30%')
    await form.locator('input[name="team"]').fill('비즈니스13팀')
    await page.screenshot({ path: screenshotPath('cheil-campaign-new') })
    await page.getByTestId('cheil-campaign-submit').click()

    const view = page.getByTestId('cheil-campaign-view')
    await expect(view).toBeVisible()
    await expect(view.locator('h3')).toHaveText('에어린 봄 런칭')
    await expect(view).toContainText('500,000,000원')
    const events = page.getByTestId('cheil-campaign-timeline').locator('li')
    await expect(events).toHaveCount(1)
    await expect(events.first()).toContainText('만듦')

    await page.getByTestId('cheil-campaign-note').fill('광고주 OT 완료, 다음 주 시안 공유')
    await page.getByTestId('cheil-campaign-note-add').click()
    await expect(events).toHaveCount(2)
    await expect(events.first()).toContainText('광고주 OT 완료')

    await view.getByRole('button', { name: '카드 고치기' }).click()
    await form.locator('input[name="budget"]').fill('600000000')
    await page.getByTestId('cheil-campaign-submit').click()
    await expect(view).toBeVisible()
    await expect(events).toHaveCount(3)
    await expect(events.first()).toContainText('총예산 500,000,000원 → 600,000,000원')
    await page.screenshot({ path: screenshotPath('cheil-campaign-timeline') })

    // the folder holds the card and the same three events
    const folder = join(userDataDir, 'Cheil 캠페인', '가상전자 - 에어린 봄 런칭')
    expect(JSON.parse(readFileSync(join(folder, 'campaign.json'), 'utf8')).card.budget).toBe(
      '600000000',
    )
    expect(readFileSync(join(folder, 'timeline.jsonl'), 'utf8').trim().split('\n')).toHaveLength(3)

    // the history document opens in a markdown tab
    await view.getByRole('button', { name: '이력 문서로 보기' }).click()
    const md = await waitForPageWithUrl(app, '://markdown/', 60_000)
    await expect
      .poll(async () => md.evaluate(() => document.body.innerText), { timeout: 60_000 })
      .toContain('타임라인 (3건)')
    expect(existsSync(join(folder, '캠페인 이력.md'))).toBe(true)

    // back home, the list shows the campaign with its latest event
    await page.bringToFront()
    await page.keyboard.press('Escape')
    await expect(row.locator('[data-testid="cheil-campaign-card"]')).toHaveCount(1)
    await expect(row.locator('[data-testid="cheil-campaign-card"]')).toContainText('가상전자')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-campaigns')
  }
})
