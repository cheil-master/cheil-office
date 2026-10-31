/** Cheil fork: isolated installer regression; opt-in only, preserves the real profile. */
import { test, expect, _electron as electron } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CheilCampaignApi } from '../apps/shell/src/shared/cheil-campaign-api'
test('isolated installed payload retains campaign and optional vault through replacement', async () => {
  const phase = process.env.CHEIL_INSTALL_PHASE
  test.skip(
    phase !== 'old' && phase !== 'new',
    'Run only for an explicitly authorized isolated install',
  )
  test.setTimeout(90000)
  const base = 'C:/Users/CHEIL/Documents/CheilOffice'
  const profile = join(base, 'wiki-qa-user-data')
  const vault = join(profile, 'legacy-vault')
  if (phase === 'old') {
    await mkdir(vault, { recursive: true })
    await writeFile(join(profile, 'app-settings.json'), JSON.stringify({ onboardingSeen: true }))
    await writeFile(
      join(profile, 'ai-settings.json'),
      JSON.stringify({ providers: {}, subscriptionNoticeSeen: true }),
    )
    await writeFile(join(profile, 'cheil-settings.json'), JSON.stringify({ obsidianVault: vault }))
    await writeFile(join(profile, '문서보존확인.txt'), '오로라7 보존 확인')
  }
  const { ELECTRON_RUN_AS_NODE: _drop, ...env } = process.env
  const app = await electron.launch({
    executablePath: join(base, 'qa-install-wiki', 'CheilOffice.exe'),
    args: [`--user-data-dir=${profile}`, '--disable-backgrounding-occluded-windows'],
    env: {
      ...env,
      GENOFFICE_USER_DATA: profile,
      GENOFFICE_LANG: 'ko',
      GENOFFICE_NO_SPARE_VIEW: '1',
      APPIMAGE: 'cheil-install-qa',
    },
  })
  try {
    const page = await app.firstWindow()
    await expect(page.locator('.cheil-office-folder')).toHaveCount(8, { timeout: 60000 })
    if (phase === 'old') {
      const result = await page.evaluate(async () => {
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
        const campaign = await api.create(card)
        const note = await api.knowledgeAddText(
          '제목: 오로라7 이전 자료\n업데이트 이후에도 남아야 하는 메모',
        )
        return { campaign, note }
      })
      expect(result.campaign.ok).toBe(true)
      expect(result.note.ok && result.note.added[0]?.ok).toBe(true)
      if (!result.note.ok) throw new Error('note')
      await writeFile(join(profile, 'expected-legacy-note.txt'), result.note.added[0]!.note!)
    } else {
      await expect(page.locator('.cheil-campaign-card')).toContainText('오로라7')
      const previous = await readFile(join(profile, 'expected-legacy-note.txt'), 'utf8')
      expect(await readFile(join(vault, previous), 'utf8')).toContain('남아야 하는 메모')
      const added = await page.evaluate(async () => {
        const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
          .aiOfficeCheilCampaigns
        return api.wiki({
          op: 'addText',
          title: '블루윈드 새 위키',
          body: '재설치 후 자체 위키 검증',
        })
      })
      expect(added.ok && added.page?.body).toBe('재설치 후 자체 위키 검증')
      await page.getByTestId('cheil-nav-knowledge').click()
      await expect(page.getByTestId('cheil-wiki')).toContainText('블루윈드 새 위키')
      expect(await readFile(join(profile, '문서보존확인.txt'), 'utf8')).toBe('오로라7 보존 확인')
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
