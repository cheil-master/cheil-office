/** Cheil fork: own wiki and campaign integration in the real application; no real AI. */
import { test, expect } from '@playwright/test'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'
import type { CheilCampaignApi } from '../apps/shell/src/shared/cheil-campaign-api'

test('own wiki saves, searches, edits and restores without Obsidian', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-own-wiki',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, app, userDataDir } = launched
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1440, 960))
    await page.getByTestId('cheil-nav-knowledge').click()
    const wiki = page.getByTestId('cheil-wiki')
    await expect(wiki).toContainText('My Wiki')
    await expect(wiki).not.toContainText('먼저 옵시디언')
    await wiki.locator('.cheil-wiki-head').getByRole('button', { name: '자료 넣기', exact: true }).click()
    await wiki.getByRole('textbox', { name: '제목', exact: true }).fill('오로라7 회의 메모')
    await wiki
      .getByRole('textbox', { name: '내용을 붙여넣으세요', exact: true })
      .fill('# 오로라7\n\n발표 일정은 다음 주에 확정합니다.')
    await wiki.getByRole('button', { name: 'MD로 저장', exact: true }).click()
    await wiki.locator('.cheil-wiki-row').filter({ hasText: '오로라7 회의 메모' }).click()
    await expect(wiki.locator('.cheil-wiki-body').first()).toContainText('발표 일정')
    await wiki.getByRole('textbox', { name: '제목·본문 검색' }).fill('발표 일정')
    await expect(wiki.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(1)
    await wiki.getByRole('button', { name: '편집', exact: true }).click()
    await wiki.getByRole('textbox', { name: '본문 편집' }).fill('오로라7 발표 일정 확정')
    await wiki.getByRole('button', { name: 'MD로 저장', exact: true }).last().click()
    await expect(wiki.locator('.cheil-wiki-body').first()).toContainText('일정 확정')
    const notes = await readdir(join(userDataDir, 'Cheil 위키', 'sources'))
    expect(notes).toHaveLength(1)
    const raw = await readFile(join(userDataDir, 'Cheil 위키', 'sources', notes[0]!), 'utf8')
    expect(raw).toContain('오로라7 발표 일정 확정')
    await wiki.getByText('변경 이력', { exact: true }).click()
    await wiki
      .locator('.cheil-wiki-reader details')
      .first()
      .getByRole('button', { name: '새로고침' })
      .click()
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await wiki
      .getByRole('button', { name: /복원 ·/ })
      .first()
      .click()
    await expect(wiki.locator('.cheil-wiki-body').first()).toContainText('다음 주')
    await wiki.getByText('변경 이력', { exact: true }).click()
    await wiki.locator('.cheil-wiki-head').scrollIntoViewIfNeeded()
    for (const mode of ['dark', 'light'] as const) {
      await page.evaluate((theme) => window.aiOffice.setTheme(theme), mode)
      await page.screenshot({ path: screenshotPath(`cheil-wiki-${mode}`) })
    }
  } finally {
    await closeAndSaveVideo(launched, 'cheil-own-wiki')
  }
})

test('campaign shares one source and AI receives only linked excerpts', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-wiki-campaign',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, app } = launched
  try {
    const created = await page.evaluate(async () => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      const card = {
        campaign: '오로라7',
        client: '가상전자',
        brand: '',
        start: '',
        end: '',
        budget: '',
        target: '',
        kpi: '',
        team: '',
        author: '',
      }
      const a = await api.create(card),
        b = await api.create({ ...card, campaign: '에어린' })
      if (!a.ok || !b.ok) throw new Error('campaigns')
      const x = await api.wiki({
        op: 'addText',
        title: '오로라7 자료',
        body: '오로라7 발표 일정은 목요일입니다.',
        campaignId: a.campaign.id,
      })
      await api.wiki({
        op: 'addText',
        title: '외부 자료',
        body: '오로라7 비공개범위 비둘기',
        campaignId: b.campaign.id,
      })
      if (!x.ok || !x.page) throw new Error('source')
      await api.wiki({ op: 'link', id: x.page.id, campaignId: b.campaign.id, linked: true })
      return { a: a.campaign.id, b: b.campaign.id, id: x.page.id }
    })
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('ai:chat')
      ipcMain.handle('ai:chat', (_event, request) => {
        ;(globalThis as unknown as { wikiRequests: string[] }).wikiRequests = [request.user]
        return { ok: true, content: '발표 일정은 목요일입니다. [1]' }
      })
    })
    await page.getByTestId('cheil-nav-knowledge').click()
    const wiki = page.getByTestId('cheil-wiki')
    await wiki.getByRole('combobox', { name: '자료 범위' }).selectOption(created.a)
    await expect(wiki.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(1)
    await wiki.getByRole('textbox', { name: '자료에서 확인할 질문' }).fill('오로라7 발표 일정')
    await wiki.getByRole('button', { name: '위키에 질문', exact: true }).click()
    await expect(wiki.locator('.cheil-wiki-answer')).toContainText('목요일')
    const sent = await app.evaluate(
      () => (globalThis as unknown as { wikiRequests: string[] }).wikiRequests,
    )
    expect(sent.join('\n')).toContain('목요일')
    expect(sent.join('\n')).not.toContain('비둘기')
    await wiki.getByRole('button', { name: '검토 후 위키로 저장' }).click()
    await expect(wiki.locator('.cheil-wiki-reader')).toContainText('검토 필요')
    await page.getByTestId('cheil-nav-home').click()
    await page.locator('.cheil-campaign-card').filter({ hasText: '오로라7' }).click()
    const view = page.getByTestId('cheil-campaign-view')
    await view.locator('.cheil-campaign-materials > summary').click()
    const embedded = view.getByTestId('cheil-wiki')
    await expect(embedded).toContainText('캠페인 자료')
    await expect(embedded.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(2)
    await embedded.locator('.cheil-wiki-row').filter({ hasText: '오로라7 자료' }).first().click()
    await embedded.getByText('캠페인 연결·삭제', { exact: true }).click()
    await embedded.getByLabel('오로라7', { exact: true }).click()
    await expect(embedded.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(1)
    const retained = await page.evaluate(async (id) => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      return api.wiki({ op: 'read', id })
    }, created.id)
    expect(retained.ok && retained.page?.campaignIds).toEqual([created.b])
    await page.screenshot({ path: screenshotPath('cheil-wiki-campaign') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-wiki-campaign')
  }
})

test('real document conversion reports failures and preserves original files', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-wiki-import',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, userDataDir } = launched
  try {
    const broken = join(userDataDir, 'broken.docx')
    await writeFile(broken, 'not a zip')
    const empty = join(userDataDir, 'empty.txt')
    await writeFile(empty, '')
    const source = join(userDataDir, 'inbox')
    await mkdir(source)
    const md = join(source, '한국어 노트.md')
    await writeFile(md, '# 블루윈드\n로컬 검색 자료')
    const base = join(__dirname, '..', 'apps', 'shell', 'resources', 'builtin-skills')
    const paths = [
      md,
      join(base, 'cheil-meeting-notes', 'assets', '컨택리포트.docx'),
      join(base, 'cheil-brief', 'assets', 'OT 및 킥오프.pptx'),
      join(base, 'cheil-media-plan', 'assets', '미디어브리프.xlsx'),
      broken,
      empty,
    ]
    const reply = await page.evaluate(async (paths) => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      return api.wiki({ op: 'addFiles', paths })
    }, paths)
    expect(reply.ok && reply.results?.map((r) => r.ok)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ])
    expect(await readFile(md, 'utf8')).toContain('블루윈드')
    expect(await readdir(join(userDataDir, 'Cheil 위키', 'sources'))).toHaveLength(4)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-wiki-import')
  }
})

test('native folder choice persists, existing Markdown stays, and unsaved edits block navigation', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-wiki-options',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, app, userDataDir } = launched
  const newRoot = join(userDataDir, '별도 위키')
  try {
    await page.getByTestId('cheil-nav-knowledge').click()
    const wiki = page.getByTestId('cheil-wiki')
    await expect(wiki).toBeVisible()
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as never
    }, newRoot)
    await wiki.locator('.cheil-wiki-head details > summary').click()
    await wiki.getByRole('button', { name: '저장 폴더 변경 (기존 자료는 이동 안 함)' }).click()
    await expect(wiki.locator('.cheil-wiki-options')).toContainText(newRoot)
    const created = await page.evaluate(async () => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      return api.wiki({ op: 'addText', title: '블루윈드', body: '저장한 내용' })
    })
    expect(created.ok).toBe(true)
    await wiki
      .locator('.cheil-wiki-head')
      .getByRole('button', { name: '새로고침', exact: true })
      .click()
    await wiki.locator('.cheil-wiki-row').filter({ hasText: '블루윈드' }).click()
    await wiki.getByRole('button', { name: '편집', exact: true }).click()
    await wiki.getByRole('textbox', { name: '본문 편집' }).fill('아직 저장하지 않은 내용')
    await page.evaluate(() => {
      window.confirm = () => false
    })
    await page.getByTestId('cheil-nav-home').click()
    await expect(wiki.getByRole('textbox', { name: '본문 편집' })).toHaveValue(
      '아직 저장하지 않은 내용',
    )
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByTestId('cheil-nav-home').click()
    await expect(wiki).toBeHidden()
    expect(await readdir(join(newRoot, 'sources'))).toHaveLength(1)
    expect(
      JSON.parse(await readFile(join(userDataDir, 'app-settings.json'), 'utf8')).cheilWikiRoot,
    ).toBe(newRoot)
    expect(await readdir(join(userDataDir, 'Cheil 위키', 'sources'))).toHaveLength(0)
  } finally {
    await closeAndSaveVideo(launched, 'cheil-wiki-options')
  }
  const restarted = await launchShell({ userDataDir, videoDir: 'cheil-wiki-restart', lang: 'ko' })
  try {
    await restarted.page.getByTestId('cheil-nav-knowledge').click()
    const wiki = restarted.page.getByTestId('cheil-wiki')
    await wiki.locator('.cheil-wiki-row').filter({ hasText: '블루윈드' }).click()
    await expect(wiki.locator('.cheil-wiki-body').first()).toContainText('저장한 내용')
    await expect(wiki.locator('.cheil-wiki-body').first()).not.toContainText(
      '아직 저장하지 않은 내용',
    )
  } finally {
    await closeAndSaveVideo(restarted, 'cheil-wiki-restart')
  }
})
