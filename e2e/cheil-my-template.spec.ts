import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (plan item 13, step ①): a report becomes the person's own
 * template. A brief filled from one campaign is saved; in the next run it is
 * added under "내 양식": its campaign values are offered as blanks, the copy
 * opens with them turned into [blanks] (the original stays), and the
 * campaign's document set opens that template with the card filled in again.
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

async function profileWithCampaign(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cheil-mine-'))
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

async function chooseSet(page: Page, skills: string[]) {
  const set = page.getByTestId('cheil-campaign-set')
  await expect(set).toBeVisible()
  for (const box of await set.locator('input[type="checkbox"]').all()) {
    const want = skills.includes((await box.getAttribute('data-skill')) ?? '')
    if ((await box.isChecked()) !== want) await box.click()
  }
  await page.getByTestId('cheil-campaign-open-set').click()
}

/** the text of every open Word tab */
async function docTexts(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(async ({ webContents }) => {
    const out: string[] = []
    for (const w of webContents.getAllWebContents()) {
      if (!w.getURL().includes('://docs/')) continue
      out.push(
        String(
          await w
            .executeJavaScript(`document.querySelector('.ProseMirror')?.innerText ?? ''`)
            .catch(() => ''),
        ),
      )
    }
    return out
  })
}

test('Cheil: a saved brief becomes my template, and a campaign set fills it again', async () => {
  // two runs of the app
  test.setTimeout(240_000)
  const userDataDir = await profileWithCampaign()
  const brief = join(userDataDir, 'Cheil 캠페인', FOLDER, '크리에이티브 브리프.docx')

  // run 1: a brief filled from the campaign, saved in place
  const first = await launchShell({
    userDataDir,
    videoDir: 'cheil-my-template-1',
    lang: 'ko',
    onboardingSeen: true,
  })
  try {
    await first.page.locator('[data-testid="cheil-campaign-card"]').first().click()
    await chooseSet(first.page, ['cheil-brief'])
    const docs = await waitForPageWithUrl(first.app, '://docs/', 60_000)
    await expect(docs.getByText(/카드로 공통 칸 10개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
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
    await closeAndSaveVideo(first, 'cheil-my-template-1')
  }

  // run 2: an Obsidian vault is linked; the saved brief is added as my template
  const vault = join(userDataDir, 'vault')
  await writeFile(
    join(userDataDir, 'cheil-settings.json'),
    JSON.stringify({ obsidianVault: vault }),
  )
  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-my-template-2',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.setViewportSize({ width: 1280, height: 1100 }).catch(() => {})
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as never
    }, brief)
    const row = page.getByTestId('cheil-my-templates')
    await expect(row).toContainText('예전에 쓴 보고서')
    await page.getByTestId('cheil-my-template-add').click()
    const review = page.getByTestId('cheil-my-template-review')
    await expect(review).toBeVisible({ timeout: 20_000 })
    for (const value of ['가상전자', '에어린 봄 런칭', '500,000,000원', '브랜드 인지도 30%']) {
      await expect(review).toContainText(value)
    }
    // a blank of the person's own (not a common field: no card fills it)
    await page.getByTestId('cheil-my-template-extra-find').fill('25~34세 1인 가구 직장인')
    await page.getByTestId('cheil-my-template-extra-blank').fill('타깃 한 줄 정리')
    await page.getByTestId('cheil-my-template-extra-add').click()
    await page.screenshot({ path: screenshotPath('cheil-my-template-review') })
    await page.getByTestId('cheil-my-template-make').click()

    // the copy in "Cheil 양식" opens with the values turned into blanks
    const copy = join(userDataDir, 'Cheil 양식', '크리에이티브 브리프.docx')
    expect(existsSync(copy)).toBe(true)
    await expect
      .poll(async () => (await docTexts(app)).find((t) => t.includes('[광고주]')) ?? '', {
        timeout: 60_000,
      })
      .toContain('[캠페인명]')
    const template = (await docTexts(app)).find((t) => t.includes('[광고주]'))!
    expect(template).not.toContain('가상전자')
    expect(template).not.toContain('500,000,000원')
    expect(template).toContain('[타깃 한 줄 정리]')
    await page.getByText('Cheil 기획 오피스', { exact: true }).first().click()
    await expect(page.getByTestId('cheil-my-template-status')).toContainText(
      /곳을 \[칸\]으로 바꿨습니다/,
    )
    await expect(row.getByTestId('cheil-my-template-card')).toContainText('크리에이티브 브리프')

    // the template is saved in place, then a campaign's set opens it with the card in its blanks
    const savedBefore = (await stat(copy)).mtimeMs
    await app.evaluate(({ webContents }) => {
      for (const w of webContents.getAllWebContents()) {
        if (w.getURL().includes('://docs/')) w.send('menu:command', 'save')
      }
    })
    await expect
      .poll(async () => (await stat(copy)).mtimeMs, { timeout: 15_000 })
      .toBeGreaterThan(savedBefore)
    await page.locator('[data-testid="cheil-campaign-card"]').first().click()
    await chooseSet(page, ['mine:크리에이티브 브리프.docx'])
    // the card fills the common blanks; the person's own blank waits for the quick fill
    await expect
      .poll(
        async () =>
          (await docTexts(app)).some(
            (t) =>
              t.includes('가상전자') &&
              t.includes('25~34세 1인 가구 직장인') === false &&
              t.includes('[타깃 한 줄 정리]') &&
              !t.includes('[광고주]'),
          ),
        { timeout: 60_000 },
      )
      .toBe(true)
    await page.screenshot({ path: screenshotPath('cheil-my-template-set') })

    // Obsidian: the report as a note, and the campaign's notes after the set
    const source = join(vault, 'Cheil', '내 양식', '크리에이티브 브리프.md')
    expect(readFileSync(source, 'utf8')).toContain('| 광고주 | 가상전자 |')
    const campaignNote = join(vault, 'Cheil', FOLDER, `${FOLDER}.md`)
    await expect.poll(() => existsSync(campaignNote), { timeout: 15_000 }).toBe(true)
    const note = readFileSync(campaignNote, 'utf8')
    expect(note).toContain('# 가상전자 · 에어린 봄 런칭')
    expect(note).toContain('문서 세트를 캠페인 폴더에 만들어 엽니다')
    expect(note).toContain(`[[Cheil/${FOLDER}/문서/크리에이티브 브리프|크리에이티브 브리프]]`)
    expect(existsSync(join(vault, 'Cheil', FOLDER, '문서', '크리에이티브 브리프.md'))).toBe(true)
    await expect(page.getByTestId('cheil-obsidian')).toContainText('옵시디언: vault')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-my-template-2')
  }
})
