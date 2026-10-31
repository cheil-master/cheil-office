/** Cheil fork: real platform OCR, MD-only restart and both native Office editors. */
import { test, expect } from '@playwright/test'
import { writeFile, readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { launchShell } from './helpers'
test('reference image becomes reusable MD and editable documents', async () => {
  test.skip(!['win32', 'darwin'].includes(process.platform), 'System OCR supported platforms')
  test.setTimeout(240000)
  const dir = await mkdtemp(join(tmpdir(), 'cheil-reference-')),
    png = join(dir, 'reference.png')
  let launched = await launchShell({ videoDir: 'reference', lang: 'ko', onboardingSeen: true })
  try {
    let { app, page } = launched
    console.log('stage: image fixture')
    const base64 = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 1200
      c.height = 800
      const g = c.getContext('2d')!
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, 1200, 800)
      g.fillStyle = '#202020'
      g.font = 'bold 64px Arial'
      g.fillText('REFERENCE STRUCTURE', 80, 140)
      g.fillStyle = '#d8ebdf'
      g.fillRect(80, 280, 480, 370)
      g.fillRect(640, 280, 480, 370)
      g.fillStyle = '#202020'
      g.font = '36px Arial'
      g.fillText('First reference card', 110, 350)
      g.fillText('Second reference card', 670, 350)
      return c.toDataURL('image/png').split(',')[1]
    })
    await writeFile(png, Buffer.from(base64, 'base64'))
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    }, png)
    await page.getByTestId('cheil-style-mode').click()
    await page.locator('[data-testid=cheil-styles] > details > summary').click()
    await page.getByTestId('reference-import').click()
    await expect(page.getByTestId('reference-preview')).toBeVisible({ timeout: 60000 })
    await page.getByTestId('style-name').fill('Reusable reference')
    await page.getByTestId('style-save').click()
    await expect(page.getByTestId('style-status')).toContainText('저장')
    const saved = await page.evaluate(async () => {
      const a = (window as any).aiOfficeCheilStyles
      return (await a.request({ op: 'list' })).styles[0]
    })
    expect(saved.profile.template.regions.filter((r: any) => r.role === 'title')).toHaveLength(1)
    const md = await readFile(
      join(launched.userDataDir, 'document-styles', `${saved.id}.md`),
      'utf8',
    )
    expect(md).not.toContain('REFERENCE STRUCTURE')
    expect(md).toContain('reading-order')
    await writeFile(join(dir, 'reference.md'), md)
    // Close and restart to prove the persisted MD is sufficient without an image cache.
    console.log('stage: MD persisted; restarting')
    await app.close()
    launched = await launchShell({
      userDataDir: launched.userDataDir,
      videoDir: 'reference-reload',
      lang: 'ko',
      onboardingSeen: true,
    })
    ;({ app, page } = launched)
    await page.getByTestId('cheil-style-mode').click()
    await page.locator('[data-testid=cheil-styles] > details > summary').click()
    await page.getByTestId('style-library').selectOption(saved.id)
    await expect(page.getByTestId('reference-preview')).toBeVisible()
    await page.getByTestId('reference-title').fill('가상전자 신규 캠페인')
    await page
      .getByTestId('reference-body')
      .fill(
        '고객 경험을 개선하는 첫 번째 제안입니다.\n새로운 구독 혜택을 소개하는 두 번째 제안입니다.',
      )
    await expect(page.getByTestId('reference-preview')).toContainText('고객 경험')
    await page.getByTestId('reference-preview').screenshot({ path: join(dir, 'preview.png') })
    console.log('stage: reload and preview verified')
    for (const format of ['pptx', 'docx'] as const) {
      console.log('stage: create', format)
      await page.locator('.tab-home').click()
      const path = join(dir, `applied.${format}`)
      await app.evaluate(({ dialog }, path) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
      }, path)
      const result = await page.evaluate(
        async ({ id, format }) => {
          const a = (window as any).aiOfficeCheilStyles
          const r = await a.request({ op: 'load', id })
          return a.request({
            op: 'create',
            draft: r.draft.id,
            name: r.draft.profile.name,
            selection: r.draft.selection,
            format,
            title: '가상전자 신규 캠페인',
            body: '고객 경험을 개선합니다.\n새로운 구독 혜택을 소개합니다.',
          })
        },
        { id: saved.id, format },
      )
      console.log('stage: created', format)
      expect(result).toMatchObject({ ok: true, opened: true })
      const zip = await JSZip.loadAsync(await readFile(path))
      const xml = await zip
        .file(format === 'pptx' ? 'ppt/slides/slide1.xml' : 'word/document.xml')!
        .async('string')
      expect(xml).toContain('가상전자')
      expect(Object.keys(zip.files).some((p) => p.includes('/media/'))).toBe(false)
      await expect(page.locator('.tab-item').filter({ hasText: `applied.${format}` })).toBeVisible()
    }
    await page.locator('.tab-home').click()
    console.log('Reference test artifacts:', dir)
  } finally {
    await launched.app.close()
  }
})
