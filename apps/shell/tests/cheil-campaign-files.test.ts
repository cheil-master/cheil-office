/**
 * Cheil fork (plan item 5): a campaign's documents are the files in its
 * folder. A set writes its templates' copies there under names never taken
 * yet and opens those files; the folder tells which campaign a tab belongs to.
 */
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  queuedSkillHandoffs,
  resetGenerateHandoffsForTest,
} from '@genoffice/electron-utils/generate-handoff'
import {
  campaignDocumentOf,
  campaignDocumentTitle,
  freeFileName,
  isCampaignDocumentName,
} from '../src/main/cheil/campaign-files'
import { createTemplateTabs, type TemplateTabsDeps } from '../src/main/user-skills/template-tabs'

const ROOT = join('/docs', 'Cheil 캠페인')
const FOLDER = join(ROOT, '가상전자 - 에어린 봄 런칭')

describe('Cheil fork: which campaign a document belongs to', () => {
  it('takes the Word, PowerPoint and Excel files right in a campaign folder', () => {
    expect(campaignDocumentOf(ROOT, join(FOLDER, '크리에이티브 브리프.docx'))).toEqual({
      id: '가상전자 - 에어린 봄 런칭',
      title: '크리에이티브 브리프',
    })
    expect(campaignDocumentOf(ROOT, join(FOLDER, '캠페인 제안서 (2).pptx'))?.title).toBe(
      '캠페인 제안서 (2)',
    )
    expect(campaignDocumentOf(ROOT, join(FOLDER, '미디어 플랜.XLSX'))?.title).toBe('미디어 플랜')
  })

  it('leaves out other files, lock files, nested folders and other places', () => {
    for (const path of [
      join(FOLDER, '캠페인 이력.md'),
      join(FOLDER, 'campaign.json'),
      join(FOLDER, '~$리에이티브 브리프.docx'),
      join(FOLDER, '참고', '경쟁사 분석.docx'),
      join(ROOT, '브리프.docx'),
      join('/elsewhere', '가상전자 - 에어린 봄 런칭', '브리프.docx'),
    ]) {
      expect(campaignDocumentOf(ROOT, path)).toBeNull()
    }
    expect(isCampaignDocumentName('.브리프.docx')).toBe(false)
    expect(campaignDocumentTitle('캠페인 제안서.pptx')).toBe('캠페인 제안서')
  })

  it('picks a name no file in the folder has yet', () => {
    const taken = new Set(['캠페인 제안서.pptx', '캠페인 제안서 (2).pptx'])
    expect(freeFileName('크리에이티브 브리프.docx', (n) => taken.has(n))).toBe(
      '크리에이티브 브리프.docx',
    )
    expect(freeFileName('캠페인 제안서.pptx', (n) => taken.has(n))).toBe('캠페인 제안서 (3).pptx')
  })
})

class FakeContents extends EventEmitter {
  constructor(readonly id: number) {
    super()
  }
  isDestroyed(): boolean {
    return false
  }
}

const TEMPLATE_BYTES = new Uint8Array([0x50, 0x4b, 3, 4, 7, 7])

function setup() {
  const files = new Map<string, Uint8Array>([['/skills/brief/brief.docx', TEMPLATE_BYTES]])
  const openedFiles: string[] = []
  const removed: string[] = []
  const deps: TemplateTabsDeps = {
    makeCopyDir: async () => '/tmp/copy',
    writeFile: async (path, bytes) => {
      files.set(path, new Uint8Array(bytes))
    },
    readFile: async (path) => {
      const bytes = files.get(path)
      if (!bytes) throw new Error('ENOENT')
      return bytes
    },
    removeDir: async (dir) => {
      removed.push(dir)
    },
    templateFileOf: async (id) =>
      id === 'builtin:cheil-brief'
        ? { ok: true, path: '/skills/brief/brief.docx', fileName: 'brief.docx', title: 'Brief' }
        : { ok: false, reason: 'not-found' },
    openCopy: async () => {
      throw new Error('a campaign set opens its file, never an untitled copy')
    },
    openFile: async (path) => {
      openedFiles.push(path)
      return {
        tabId: `t${openedFiles.length}`,
        contents: new FakeContents(200 + openedFiles.length),
      }
    },
    fileExists: (path) => files.has(path),
    focusTab: () => true,
    newId: () => 'id-1',
    now: () => 5,
  }
  return { files, openedFiles, removed, templates: createTemplateTabs(deps) }
}

afterEach(() => resetGenerateHandoffsForTest())

describe('Cheil fork: a campaign set opens files in the campaign folder', () => {
  const input = {
    skillId: 'builtin:cheil-brief',
    text: '브리프를 채워 줘.',
    chips: [{ id: 'builtin:cheil-brief', source: 'builtin', title: '크리에이티브 브리프' }],
    prefill: true,
  }
  const cheil = { campaign: '에어린 봄 런칭', values: { '[광고주]': '가상전자' } }

  it('writes the template under the title and opens that file with the card handed over', async () => {
    const { files, openedFiles, removed, templates } = setup()
    const result = await templates.openTemplateFile(
      input,
      { dir: FOLDER, title: '크리에이티브 브리프' },
      cheil,
    )
    const path = join(FOLDER, '크리에이티브 브리프.docx')
    expect(result).toEqual({ ok: true, tabId: 't1', path })
    expect(openedFiles).toEqual([path])
    expect([...files.get(path)!]).toEqual([...TEMPLATE_BYTES])
    expect(queuedSkillHandoffs()).toEqual([{ webContentsId: 201, target: 'docs', id: 'id-1' }])
    expect(templates.takeHandoff('docs', 201)).toMatchObject({
      mode: 'skill',
      text: '브리프를 채워 줘.',
      prefill: true,
      cheil,
    })
    // the file is the person's: nothing is cleaned up
    expect(removed).toEqual([])
  })

  it('never writes over a document already in the folder', async () => {
    const { files, openedFiles, templates } = setup()
    const first = join(FOLDER, '크리에이티브 브리프.docx')
    files.set(first, new Uint8Array([1, 2, 3]))
    const result = await templates.openTemplateFile(
      input,
      { dir: FOLDER, title: '크리에이티브 브리프' },
      cheil,
    )
    expect(result).toMatchObject({ ok: true, path: join(FOLDER, '크리에이티브 브리프 (2).docx') })
    expect([...files.get(first)!]).toEqual([1, 2, 3])
    expect(openedFiles).toEqual([join(FOLDER, '크리에이티브 브리프 (2).docx')])
  })

  it('says so when the template is unknown', async () => {
    const { openedFiles, templates } = setup()
    expect(
      await templates.openTemplateFile(
        { ...input, skillId: 'builtin:nothing' },
        { dir: FOLDER, title: 'x' },
      ),
    ).toEqual({ ok: false, reason: 'not-found' })
    expect(openedFiles).toEqual([])
    expect(queuedSkillHandoffs()).toEqual([])
  })
})
