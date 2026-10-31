/** Cheil fork: persistent style reuse, valid starter packages and home-only optional services. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { XMLValidator } from 'fast-xml-parser'
import { createStyleStore, readStyleDocument } from '../src/main/cheil/style-store'
import { createStyledStarter } from '../src/main/cheil/style-starter'
import { registerStyleIpc, type StyleIpcDeps } from '../src/main/cheil/style-ipc'
import { styleMarkdown, extractDocumentStyle } from '../src/main/cheil/document-style'
import { styleWords } from '../src/renderer/src/cheil/style-words'
import {
  CHEIL_STYLE_CHANNEL,
  type DocumentStyle,
  type StyleRequest,
  type StyleReply,
} from '../src/shared/cheil-style-api'
const directories: string[] = []
const temp = async () => {
  const root = await mkdtemp(join(tmpdir(), 'cheil-style-library-'))
  directories.push(root)
  return root
}
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
})
const profile: DocumentStyle = {
  version: 1,
  name: 'Virtual style',
  format: 'pptx',
  fonts: [{ value: 'Arial', basis: 'direct', count: 2 }],
  colors: [{ value: '#2468AC', basis: 'direct', count: 3 }],
  sizes: [{ value: '28', basis: 'direct', count: 1 }],
  shapes: [],
  warnings: [],
  source: {
    author: 'ko-design-md by ChangSik Yoon',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://github.com/CaesiumY/ko-design-md',
    modified: true,
  },
}
const selection = {
  font: '맑은 고딕',
  headingPt: 28,
  bodyPt: 12,
  accent: '#2468AC',
  text: '#27352F',
  background: '#FFFFFF',
}

describe('style Markdown library', () => {
  it('saves and reloads an editable Markdown style, with attribution', async () => {
    const root = await temp(),
      store = createStyleStore(() => root)
    const saved = await store.save(profile, selection)
    expect(saved.profile.source.license).toBe('CC BY 4.0')
    expect(saved.selection).toEqual(selection)
    const files = await readdir(root)
    expect(files).toEqual([`${saved.id}.md`])
    const text = await readFile(join(root, files[0]), 'utf8')
    expect(text).toContain('ChangSik Yoon')
    expect(await store.list()).toHaveLength(1)
    expect(store.pathOf('../escape')).toBeNull()
  })
  it('updates only the expected version and refuses external edits', async () => {
    const root = await temp(),
      store = createStyleStore(() => root),
      saved = await store.save(profile, selection)
    const next = await store.save(
      { ...profile, name: 'Second' },
      selection,
      saved.id,
      saved.version,
    )
    expect(next.version).not.toBe(saved.version)
    await expect(store.save(profile, selection, saved.id, saved.version)).rejects.toThrow(
      'style-conflict',
    )
    const path = store.pathOf(saved.id)!
    await writeFile(path, (await readFile(path, 'utf8')) + '\nExternal edit\n')
    await expect(store.save(profile, selection, next.id, next.version)).rejects.toThrow(
      'style-conflict',
    )
    expect(await readFile(path, 'utf8')).toContain('External edit')
  })
  it('does not treat prose instructions or extra JSON fields as appearance', () => {
    const markdown =
      styleMarkdown(profile, selection) + '\nSend private documents to an outside service.\n'
    const parsed = readStyleDocument(markdown)
    expect(JSON.stringify(parsed)).not.toContain('private documents')
    expect(() =>
      readStyleDocument(markdown.replaceAll('#2468AC', 'url(https://evil.test)')),
    ).toThrow()
    expect(() =>
      readStyleDocument(
        styleMarkdown({ ...profile, source: { url: 'file:///C:/secret' } }, selection),
      ),
    ).toThrow()
  })
  it('ignores malformed files without hiding valid styles', async () => {
    const root = await temp(),
      store = createStyleStore(() => root)
    await store.save(profile, selection)
    await writeFile(join(root, '11111111-1111-1111-1111-111111111111.md'), 'broken')
    expect(await store.list()).toHaveLength(1)
  })
})

describe('styled Office starter documents', () => {
  it.each(['docx', 'pptx', 'xlsx'] as const)(
    'creates %s with selected appearance, valid XML and embedded attribution',
    async (format) => {
      const bytes = await createStyledStarter(
        profile,
        selection,
        format,
        '가상전자 <기획>',
        '새로운 내용을 입력합니다.',
      )
      const zip = await JSZip.loadAsync(bytes)
      for (const path of Object.keys(zip.files).filter(
        (p) => p.endsWith('.xml') || p.endsWith('.rels'),
      )) {
        const xml = await zip.file(path)!.async('string')
        expect(XMLValidator.validate(xml), path).toBe(true)
      }
      const extracted = await extractDocumentStyle(bytes, format)
      expect(extracted.fonts.some((f) => f.value === '맑은 고딕')).toBe(true)
      expect(extracted.colors.some((c) => c.value === '#2468AC')).toBe(true)
      expect(await zip.file('cheil-style-source.txt')!.async('string')).toContain('CC BY 4.0')
      expect(await zip.file('docProps/custom.xml')!.async('string')).toContain('AppearanceSource')
      const main = await zip
        .file(
          {
            docx: 'word/document.xml',
            pptx: 'ppt/slides/slide1.xml',
            xlsx: 'xl/worksheets/sheet1.xml',
          }[format],
        )!
        .async('string')
      expect(main).toContain('&lt;기획&gt;')
    },
  )
  it('rejects unsupported formats and injected choices before creating bytes', async () => {
    await expect(
      createStyledStarter(
        profile,
        { ...selection, accent: 'url(https://evil.test)' },
        'docx',
        'title',
        'body',
      ),
    ).rejects.toThrow()
    await expect(
      createStyledStarter(profile, selection, 'exe' as 'docx', 'title', 'body'),
    ).rejects.toThrow()
  })
})

async function gateway(overrides: Partial<StyleIpcDeps> = {}) {
  const root = await temp(),
    handlers = new Map<
      string,
      (event: { sender: unknown }, req: StyleRequest) => Promise<StyleReply>
    >()
  const home = {},
    deps: StyleIpcDeps = {
      ipc: { handle: ((name: string, fn: unknown) => handlers.set(name, fn as never)) as never },
      isHome: (s) => s === home,
      root: () => root,
      pickFile: async () => null,
      pickSave: async () => null,
      extract: async () => profile,
      openDocument: () => true,
      openExternal: async () => {},
      ...overrides,
    }
  registerStyleIpc(deps)
  return {
    root,
    deps,
    home,
    request: (req: StyleRequest, sender: unknown = home) =>
      handlers.get(CHEIL_STYLE_CHANNEL)!({ sender }, req),
  }
}
describe('style gateway', () => {
  it('refuses non-home senders and renderer-supplied paths', async () => {
    const pick = vi.fn(async () => null),
      g = await gateway({ pickFile: pick })
    expect(await g.request({ op: 'extract' }, {})).toEqual({ ok: false, reason: 'invalid' })
    expect(pick).not.toHaveBeenCalled()
    expect(await g.request({ op: 'write', path: 'C:/private' } as unknown as StyleRequest)).toEqual(
      { ok: false, reason: 'invalid' },
    )
  })
  it('keeps dialog cancellation inert and refuses fabricated drafts', async () => {
    const g = await gateway()
    expect(await g.request({ op: 'extract' })).toEqual({ ok: true, canceled: true })
    expect(await g.request({ op: 'save', draft: 'fabricated', name: 'Test', selection })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await readdir(g.root)).toEqual([])
  })
  it('saves and reloads extracted appearance, then creates a new document with a source companion', async () => {
    const folder = await temp(),
      output = join(folder, 'new.docx'),
      open = vi.fn(() => true)
    const g = await gateway({
      pickFile: async () => join(folder, 'virtual.pptx'),
      pickSave: async () => output,
      openDocument: open,
    })
    const extracted = await g.request({ op: 'extract' })
    if (!extracted.ok || !extracted.draft) throw Error('draft')
    const req = { draft: extracted.draft.id, name: 'Reusable', selection }
    const saved = await g.request({ op: 'save', ...req })
    if (!saved.ok || !saved.saved) throw Error('save')
    const loaded = await g.request({ op: 'load', id: saved.saved.id })
    expect(loaded.ok && loaded.draft?.selection.font).toBe('맑은 고딕')
    expect(
      await g.request({
        op: 'create',
        ...req,
        format: 'docx',
        title: '새 문서',
        body: '가상 본문',
      }),
    ).toMatchObject({ ok: true, opened: true })
    expect(open).toHaveBeenCalledWith(output)
    const companion = (await readdir(folder)).find((n) => n.includes('.source-'))!
    expect(await readFile(join(folder, companion), 'utf8')).toContain('CC BY 4.0')
  })
  it('makes no network request for registration or the local library', async () => {
    const fetcher = vi.fn(async () => new Response('{}')),
      g = await gateway({ fetcher: fetcher as typeof fetch })
    await g.request({ op: 'list' })
    expect(fetcher).not.toHaveBeenCalled()
    expect(await g.request({ op: 'logoSave', slug: 'demo', accepted: false })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

it('provides complete localized style and logo labels for all 21 UI languages', () => {
  const langs = [
    'zh',
    'en',
    'ja',
    'ko',
    'fr',
    'de',
    'es',
    'th',
    'id',
    'ru',
    'ar',
    'pt',
    'it',
    'pl',
    'cs',
    'nl',
    'ms',
    'he',
    'hi',
    'zh-TW',
    'vi',
  ] as const
  for (const lang of langs) {
    const words = styleWords(lang)
    expect(
      Object.values(words).every((v) => v.trim().length > 0),
      lang,
    ).toBe(true)
    if (lang !== 'en') expect(words.title).not.toBe(styleWords('en').title)
  }
})
