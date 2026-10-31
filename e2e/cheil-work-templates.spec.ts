/** Cheil fork: the home catalog imports a real Office file and opens an untitled copy. */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import {
  launchShell,
  closeAndSaveVideo,
  waitForPageWithUrl,
  SHELL_DIR,
  screenshotPath,
} from './helpers'

// Cheil fork: managing a library copy never opens it or changes its original file.
test('work templates: rename, reject a duplicate, cancel deletion and trash the registered copy', async () => {
  test.setTimeout(150_000)
  const first = await launchShell({
    onboardingSeen: true,
    lang: 'ko',
    videoDir: 'work-template-management',
  })
  const source = join(
    SHELL_DIR,
    'resources/builtin-skills/cheil-meeting-notes/assets/컨택리포트.docx',
  )
  const original = await readFile(source)
  try {
    await first.app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as never
    }, source)
    await first.page.getByTestId('cheil-work-template-add').click()
    await expect(first.page.getByTestId('cheil-work-template-item')).toHaveCount(1)
    const item = first.page.getByTestId('cheil-work-template-item').first()
    await item.getByTestId('cheil-work-template-rename').click()
    let renameDialog = first.page.getByRole('dialog', { name: '문서 양식 이름 변경', exact: true })
    await expect(renameDialog).toBeVisible()
    await expect(renameDialog.getByTestId('cheil-work-template-name')).toBeFocused()
    await renameDialog.getByTestId('cheil-work-template-name').fill('바꾸지 않을 이름')
    await renameDialog.getByRole('button', { name: '취소', exact: true }).click()
    await expect(item.getByTestId('cheil-work-template-card')).toContainText('컨택리포트')
    await item.getByTestId('cheil-work-template-rename').click()
    renameDialog = first.page.getByRole('dialog', { name: '문서 양식 이름 변경', exact: true })
    await renameDialog.getByTestId('cheil-work-template-name').fill('CON')
    await renameDialog.getByTestId('cheil-work-template-confirm').click()
    await expect(renameDialog.getByRole('alert')).toContainText('사용할 수 없는 이름')
    await renameDialog.getByTestId('cheil-work-template-name').fill('에어린 컨택 양식')
    await first.page.screenshot({ path: screenshotPath('work-template-rename') })
    await renameDialog.getByTestId('cheil-work-template-confirm').click()
    await expect(first.page.getByTestId('cheil-work-template-card')).toContainText(
      '에어린 컨택 양식',
    )
    expect(await readdir(join(first.userDataDir, 'work-templates'))).toEqual([
      '에어린 컨택 양식.docx',
    ])
    expect(
      await readFile(join(first.userDataDir, 'work-templates', '에어린 컨택 양식.docx')),
    ).toEqual(original)
    await first.page.getByTestId('cheil-work-template-add').click()
    await expect(first.page.getByTestId('cheil-work-template-item')).toHaveCount(2)
    const other = first.page
      .getByTestId('cheil-work-template-item')
      .filter({
        has: first.page.getByTestId('cheil-work-template-card').filter({ hasText: '컨택리포트' }),
      })
    await other.getByTestId('cheil-work-template-rename').click()
    renameDialog = first.page.getByRole('dialog', { name: '문서 양식 이름 변경', exact: true })
    await renameDialog.getByTestId('cheil-work-template-name').fill('에어린 컨택 양식')
    await renameDialog.getByTestId('cheil-work-template-confirm').click()
    await expect(renameDialog.getByRole('alert')).toContainText('같은 이름')
    await first.page.keyboard.press('Escape')
    await expect(renameDialog).not.toBeVisible()
    await other.getByTestId('cheil-work-template-delete').click()
    let deleteDialog = first.page.getByRole('dialog', {
      name: '문서 양식을 삭제할까요?',
      exact: true,
    })
    await expect(deleteDialog).toContainText('원본 파일과 이 양식으로 만든 문서는 유지됩니다')
    await first.page.screenshot({ path: screenshotPath('work-template-delete') })
    await deleteDialog.getByRole('button', { name: '취소', exact: true }).click()
    await expect(first.page.getByTestId('cheil-work-template-card')).toHaveCount(2)
    await other.getByTestId('cheil-work-template-delete').click()
    deleteDialog = first.page.getByRole('dialog', { name: '문서 양식을 삭제할까요?', exact: true })
    await deleteDialog.getByTestId('cheil-work-template-confirm').click()
    await expect(first.page.getByTestId('cheil-work-template-card')).toHaveCount(1)
    expect(await readFile(source)).toEqual(original)
    expect(first.app.windows().filter((page) => page.url().includes('://docs/'))).toHaveLength(0)
  } finally {
    await closeAndSaveVideo(first, 'work-template-management')
  }
  const restarted = await launchShell({
    userDataDir: first.userDataDir,
    onboardingSeen: true,
    lang: 'ko',
    videoDir: 'work-template-management-restart',
  })
  try {
    await expect(restarted.page.getByTestId('cheil-work-template-card')).toHaveCount(1)
    await expect(restarted.page.getByTestId('cheil-work-template-card')).toContainText(
      '에어린 컨택 양식',
    )
    await restarted.page.getByTestId('cheil-work-template-delete').click()
    await restarted.page.getByTestId('cheil-work-template-confirm').click()
    await expect(restarted.page.getByTestId('cheil-work-template-card')).toHaveCount(0)
    expect(await readdir(join(first.userDataDir, 'work-templates'))).toEqual([])
    expect(await readFile(source)).toEqual(original)
  } finally {
    await closeAndSaveVideo(restarted, 'work-template-management-restart')
  }
})

for (const fixture of [
  { skill: 'cheil-brief', name: 'OT 및 킥오프.pptx', editor: 'slides' },
  { skill: 'cheil-media-plan', name: '미디어브리프.xlsx', editor: 'sheets' },
]) {
  test(`work templates: imports and opens a real ${fixture.editor} document`, async () => {
    test.setTimeout(120_000)
    const launched = await launchShell({
      onboardingSeen: true,
      lang: 'ko',
      videoDir: `work-${fixture.editor}`,
    })
    const source = join(
      SHELL_DIR,
      'resources/builtin-skills',
      fixture.skill,
      'assets',
      fixture.name,
    )
    const original = await readFile(source)
    try {
      await launched.app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as never
      }, source)
      await launched.page.getByTestId('cheil-work-template-add').click()
      const card = launched.page.getByTestId('cheil-work-template-card')
      await expect(card).toHaveCount(1)
      await card.click()
      const editor = await waitForPageWithUrl(launched.app, `://${fixture.editor}/`, 60_000)
      if (fixture.editor === 'slides') {
        await expect(editor.locator('.slide-list .thumb')).toHaveCount(12, { timeout: 60_000 })
      } else {
        await expect(editor.locator('input[class*="univer"]').first()).toBeVisible({
          timeout: 60_000,
        })
      }
      expect(await readFile(source)).toEqual(original)
      expect(await readFile(join(launched.userDataDir, 'work-templates', fixture.name))).toEqual(
        original,
      )
    } finally {
      await closeAndSaveVideo(launched, `work-${fixture.editor}`)
    }
  })
}

test('work templates: add, cancel, duplicate, restart and create an editable copy', async () => {
  test.setTimeout(150_000)
  const first = await launchShell({ onboardingSeen: true, lang: 'ko', videoDir: 'work-templates' })
  const source = join(
    SHELL_DIR,
    'resources/builtin-skills/cheil-meeting-notes/assets/컨택리포트.docx',
  )
  const original = await readFile(source)
  try {
    const section = first.page.getByRole('region', { name: '업무 관련 문서 양식', exact: true })
    await expect(section).toBeVisible()
    await expect(first.page.getByText('광고 문서 양식', { exact: true })).toHaveCount(0)
    await expect(first.page.getByTestId('cheil-my-template-add')).toBeDisabled()
    await expect(first.page.getByTestId('cheil-style-mode')).toBeDisabled()
    await first.app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = (async () => ({ canceled: true, filePaths: [] })) as never
    })
    await first.page.getByTestId('cheil-work-template-add').click()
    await expect(first.page.getByTestId('cheil-work-template-add')).toBeEnabled()
    await expect(section.getByTestId('cheil-work-template-card')).toHaveCount(0)
    await first.app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as never
    }, source)
    await first.page.getByTestId('cheil-work-template-add').click()
    await expect(section.getByTestId('cheil-work-template-card')).toHaveCount(1)
    await expect(first.page.getByTestId('cheil-work-template-status')).toContainText('추가했습니다')
    await first.page.getByTestId('cheil-work-template-add').click()
    await expect(section.getByTestId('cheil-work-template-card')).toHaveCount(2)
    const names = await readdir(join(first.userDataDir, 'work-templates'))
    expect(names.sort()).toEqual(['컨택리포트 (2).docx', '컨택리포트.docx'].sort())
    for (const name of names)
      expect(await readFile(join(first.userDataDir, 'work-templates', name))).toEqual(original)
  } finally {
    await closeAndSaveVideo(first, 'work-templates-first')
  }

  const restarted = await launchShell({
    userDataDir: first.userDataDir,
    onboardingSeen: true,
    lang: 'ko',
    videoDir: 'work-templates-restart',
  })
  try {
    await expect(restarted.page.getByTestId('cheil-work-template-card')).toHaveCount(2)
    await restarted.page
      .getByTestId('cheil-work-template-card')
      .filter({ hasText: '컨택리포트 (2)' })
      .click()
    const docs = await waitForPageWithUrl(restarted.app, '://docs/')
    await expect(docs.locator('.ProseMirror')).toBeVisible()
    await expect(docs.locator('.ProseMirror')).toContainText('CONTACT REPORT')
    await docs.locator('.ProseMirror').press('Control+End')
    await docs.locator('.ProseMirror').press('Enter')
    await docs.locator('.ProseMirror').pressSequentially('New work document')
    await expect(docs.locator('.ProseMirror')).toContainText('New work document')
    expect(await readFile(source)).toEqual(original)
    expect(
      await readFile(join(first.userDataDir, 'work-templates', '컨택리포트 (2).docx')),
    ).toEqual(original)
  } finally {
    await closeAndSaveVideo(restarted, 'work-templates-restart')
  }
})
