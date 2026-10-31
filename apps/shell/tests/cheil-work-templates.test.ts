/** Cheil fork: real local copies, persistence and home-only work-template requests. */
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  truncate,
  mkdir,
  rename,
  utimes,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rmSync } from 'node:fs'
import {
  registerWorkTemplatesIpc,
  WORK_TEMPLATE_MAX_BYTES,
  workTemplateName,
} from '../src/main/cheil/work-templates-ipc'
import { createMyTemplates } from '../src/main/cheil/my-templates'
import {
  WORK_TEMPLATE_CHANNEL,
  type WorkTemplateReply,
} from '../src/shared/cheil-work-template-api'
import { LANGS } from '@genoffice/i18n'
import { workTemplateWords } from '../src/renderer/src/cheil/work-template-words'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cheil-work-template-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function wire(picked: string | null, text: string | null = '') {
  let handler: (event: { sender: unknown }, input: unknown) => Promise<WorkTemplateReply>
  const pickDocument = vi.fn(async () => picked)
  const readText = vi.fn(async () => text)
  const openCopy = vi.fn(async () => true)
  const trashFile = vi.fn(async (path: string) => {
    const trash = join(dir, 'trash')
    await mkdir(trash, { recursive: true })
    await rename(path, join(trash, path.split(/[\\/]/).pop()!))
  })
  registerWorkTemplatesIpc({
    ipc: {
      handle: (channel, fn) => {
        expect(channel).toBe(WORK_TEMPLATE_CHANNEL)
        handler = fn as typeof handler
      },
    },
    root: () => join(dir, 'work-templates'),
    isHome: (sender) => sender === 'home',
    pickDocument,
    readText,
    openCopy,
    trashFile,
  })
  return {
    call: (input: unknown, sender: unknown = 'home') => handler({ sender }, input),
    pickDocument,
    readText,
    openCopy,
    trashFile,
  }
}

describe('work document templates', () => {
  // Cheil fork: names and deletion affect only the exact library version the person reviewed.
  it.each(['docx', 'pptx', 'xlsx'])(
    'renames %s without changing bytes or the extension and persists after restart',
    async (ext) => {
      const source = join(dir, `가상전자.${ext}`)
      await writeFile(source, 'original bytes')
      const w = wire(source)
      const added = await w.call({ action: 'add' })
      if (!added.ok) throw Error('import failed')
      const template = added.templates[0]!
      const result = await w.call({
        action: 'rename',
        name: template.name,
        updatedAt: template.updatedAt,
        title: '에어린 업무 양식',
      })
      expect(result).toMatchObject({
        ok: true,
        templates: [{ name: `에어린 업무 양식.${ext}`, title: '에어린 업무 양식' }],
      })
      expect(await readFile(join(dir, 'work-templates', `에어린 업무 양식.${ext}`), 'utf8')).toBe(
        'original bytes',
      )
      expect(await readdir(join(dir, 'work-templates'))).toEqual([`에어린 업무 양식.${ext}`])
      expect(await wire(null).call({ action: 'list' })).toMatchObject({
        ok: true,
        templates: [{ title: '에어린 업무 양식' }],
      })
      expect(await readFile(source, 'utf8')).toBe('original bytes')
    },
  )

  it('preserves a conflicting name and supports casing-only and unchanged names', async () => {
    const source = join(dir, 'Report.docx')
    await writeFile(source, 'original')
    const w = wire(source)
    const added = await w.call({ action: 'add' })
    if (!added.ok) throw Error('import failed')
    const { name, updatedAt } = added.templates[0]!
    await writeFile(join(dir, 'work-templates', 'Other.docx'), 'other')
    expect(await w.call({ action: 'rename', name, updatedAt, title: 'other' })).toEqual({
      ok: false,
      reason: 'exists',
    })
    expect(await readFile(join(dir, 'work-templates', 'Other.docx'), 'utf8')).toBe('other')
    expect(await w.call({ action: 'rename', name, updatedAt, title: 'report' })).toMatchObject({
      ok: true,
    })
    expect((await readdir(join(dir, 'work-templates'))).sort()).toEqual(
      ['Other.docx', 'report.docx'].sort(),
    )
    expect(
      await w.call({ action: 'rename', name: 'report.docx', updatedAt, title: 'report' }),
    ).toMatchObject({ ok: true })
  })

  it('moves only the registered copy to trash and preserves the original and generated documents', async () => {
    const source = join(dir, 'Original.docx')
    const generated = join(dir, 'Generated.docx')
    await writeFile(source, 'original')
    await writeFile(generated, 'a separate document')
    const w = wire(source)
    const added = await w.call({ action: 'add' })
    if (!added.ok) throw Error('import failed')
    const { name, updatedAt } = added.templates[0]!
    expect(await w.call({ action: 'delete', name, updatedAt })).toMatchObject({
      ok: true,
      templates: [],
    })
    expect(w.trashFile).toHaveBeenCalledWith(join(dir, 'work-templates', name))
    expect(await readFile(join(dir, 'trash', name), 'utf8')).toBe('original')
    expect(await readFile(source, 'utf8')).toBe('original')
    expect(await readFile(generated, 'utf8')).toBe('a separate document')
    expect(await wire(null).call({ action: 'list' })).toMatchObject({ ok: true, templates: [] })
  })

  it('leaves the library intact if trash fails and rejects stale cards for both mutations', async () => {
    const source = join(dir, 'Report.docx')
    await writeFile(source, 'original')
    const w = wire(source)
    const added = await w.call({ action: 'add' })
    if (!added.ok) throw Error('import failed')
    const { name, updatedAt } = added.templates[0]!
    w.trashFile.mockRejectedValueOnce(Error('trash unavailable'))
    expect(await w.call({ action: 'delete', name, updatedAt })).toEqual({
      ok: false,
      reason: 'failed',
    })
    const saved = join(dir, 'work-templates', name)
    expect(await readFile(saved, 'utf8')).toBe('original')
    await utimes(saved, new Date(), new Date(Date.now() + 10_000))
    expect(await w.call({ action: 'rename', name, updatedAt, title: 'New' })).toEqual({
      ok: false,
      reason: 'changed',
    })
    expect(await w.call({ action: 'delete', name, updatedAt })).toEqual({
      ok: false,
      reason: 'changed',
    })
    expect(w.trashFile).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid titles, paths and non-home management requests', async () => {
    for (const title of [
      '',
      ' ',
      '..',
      '../escape',
      'C:\\outside',
      'CON',
      'nul.txt',
      'LPT1',
      'tail.',
      'a?b',
      'a'.repeat(151),
      null,
    ]) {
      expect(workTemplateName(title, 'Report.docx')).toBeNull()
    }
    expect(workTemplateName('  에어린 제안서  ', 'Report.PPTX')).toBe('에어린 제안서.PPTX')
    const w = wire(null)
    for (const action of ['rename', 'delete']) {
      expect(await w.call({ action, name: '../Report.docx', title: 'New', updatedAt: '' })).toEqual(
        { ok: false, reason: 'invalid' },
      )
      expect(
        await w.call({ action, name: 'Report.docx', title: 'New', updatedAt: '' }, 'editor'),
      ).toEqual({ ok: false, reason: 'not-found' })
    }
    expect(w.trashFile).not.toHaveBeenCalled()
  })

  it.each(['docx', 'pptx', 'xlsx'])(
    'imports %s byte for byte and reuses it after restarting the service',
    async (ext) => {
      const source = join(dir, `업무 양식.${ext}`)
      const bytes = Buffer.from([0x50, 0x4b, 3, 4, 0, 255, 12])
      await writeFile(source, bytes)
      const first = wire(source)
      const added = await first.call({ action: 'add' })
      expect(added).toMatchObject({
        ok: true,
        added: `업무 양식.${ext}`,
        templates: [{ title: '업무 양식' }],
      })
      const saved = join(dir, 'work-templates', `업무 양식.${ext}`)
      expect(await readFile(saved)).toEqual(bytes)
      const restarted = wire(null)
      expect(await restarted.call({ action: 'list' })).toMatchObject({
        ok: true,
        templates: [{ name: `업무 양식.${ext}` }],
      })
      expect(await restarted.call({ action: 'use', name: `업무 양식.${ext}` })).toMatchObject({
        ok: true,
      })
      expect(restarted.openCopy).toHaveBeenCalledWith({ path: saved, fileName: `업무 양식.${ext}` })
      expect(await readFile(source)).toEqual(bytes)
      expect(await readFile(saved)).toEqual(bytes)
    },
  )

  it('preserves duplicate names, including concurrent and differently cased imports', async () => {
    const source = join(dir, 'Report.docx')
    await writeFile(source, 'first')
    const store = createMyTemplates({ root: () => join(dir, 'work-templates') })
    const copies = await Promise.all([store.add(source), store.add(source), store.add(source)])
    expect(new Set(copies.map((copy) => copy!.name)).size).toBe(3)
    const lower = join(dir, 'report.DOCX')
    await writeFile(lower, 'second')
    await store.add(lower)
    expect(await store.list()).toHaveLength(4)
    expect(await readFile(join(dir, 'work-templates', 'Report.docx'), 'utf8')).toBe('first')
  })

  it('keeps cancellation and unreadable files out of the library; accepts an empty document', async () => {
    const canceled = wire(null)
    expect(await canceled.call({ action: 'add' })).toEqual({ ok: false, reason: 'canceled' })
    expect(canceled.readText).not.toHaveBeenCalled()
    const source = join(dir, 'locked.docx')
    await writeFile(source, 'locked bytes')
    expect(await wire(source, null).call({ action: 'add' })).toEqual({
      ok: false,
      reason: 'unreadable',
    })
    expect(await readdir(join(dir, 'work-templates')).catch(() => [])).toEqual([])
    expect(await wire(source, '').call({ action: 'add' })).toMatchObject({ ok: true })
  })

  it('refuses oversized or unsupported files before reading their contents', async () => {
    const source = join(dir, 'large.docx')
    await writeFile(source, '')
    await truncate(source, WORK_TEMPLATE_MAX_BYTES + 1)
    const large = wire(source)
    expect(await large.call({ action: 'add' })).toEqual({ ok: false, reason: 'too-large' })
    expect(large.readText).not.toHaveBeenCalled()
    expect(await wire(join(dir, 'script.exe')).call({ action: 'add' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('rejects editor senders, malformed requests, traversal and missing files', async () => {
    const w = wire(null)
    expect(await w.call({ action: 'add' }, 'editor')).toEqual({ ok: false, reason: 'not-found' })
    expect(w.pickDocument).not.toHaveBeenCalled()
    for (const raw of [
      null,
      'list',
      {},
      { action: 'remove' },
      { action: 'use', name: '../secret.docx' },
      { action: 'use', name: 'C:\\secret.docx' },
    ]) {
      expect(await w.call(raw)).toEqual({ ok: false, reason: 'invalid' })
    }
    expect(await w.call({ action: 'use', name: 'gone.docx' })).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(w.openCopy).not.toHaveBeenCalled()
  })

  it('reports an opener failure and does not alter the saved template', async () => {
    const source = join(dir, 'report.docx')
    await writeFile(source, 'original')
    const w = wire(source)
    await w.call({ action: 'add' })
    w.openCopy.mockResolvedValueOnce(false)
    expect(await w.call({ action: 'use', name: 'report.docx' })).toEqual({
      ok: false,
      reason: 'failed',
    })
    expect(await readFile(join(dir, 'work-templates', 'report.docx'), 'utf8')).toBe('original')
  })

  it('provides all catalog messages in each supported language', () => {
    const english = workTemplateWords('en')
    for (const lang of LANGS) {
      const words = workTemplateWords(lang)
      expect(Object.keys(words).sort()).toEqual(Object.keys(english).sort())
      expect(Object.values(words).every((text) => text.trim().length > 0)).toBe(true)
      if (lang !== 'en') expect(words.label).not.toBe(english.label)
    }
    expect(workTemplateWords('ko').label).toBe('업무 관련 문서 양식')
  })
})
