/** Cheil fork: old vault exports remain optional and separate from the own wiki. */
import { test, expect } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { closeAndSaveVideo, launchShell } from './helpers'
import type { CheilCampaignApi } from '../apps/shell/src/shared/cheil-campaign-api'
test('optional legacy vault notes stay in place and native import goes into the own wiki', async () => {
  const launched = await launchShell({
    videoDir: 'cheil-knowledge-legacy',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { page, app, userDataDir } = launched
  try {
    const vault = join(userDataDir, 'old-vault')
    await mkdir(vault)
    await writeFile(
      join(userDataDir, 'cheil-settings.json'),
      JSON.stringify({ obsidianVault: vault }),
    )
    const old = await page.evaluate(async () => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      return api.knowledgeAddText('제목: 오로라7 기존 메모\n오로라7 이전 자료')
    })
    expect(old.ok && old.added[0]?.ok).toBe(true)
    if (!old.ok) throw new Error('legacy')
    const oldPath = join(vault, old.added[0]!.note!)
    expect(await readFile(oldPath, 'utf8')).toContain('이전 자료')
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as never
    }, oldPath)
    await page.getByTestId('cheil-nav-knowledge').click()
    const wiki = page.getByTestId('cheil-wiki')
    await expect(wiki.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(0)
    await wiki.getByRole('button', { name: '자료 넣기', exact: true }).click()
    await wiki.getByRole('button', { name: '파일 고르기', exact: true }).click()
    await expect(wiki.locator('.cheil-wiki-list .cheil-wiki-row')).toHaveCount(1)
    expect(await readFile(oldPath, 'utf8')).toContain('이전 자료')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-knowledge-legacy')
  }
})
