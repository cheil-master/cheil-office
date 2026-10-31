/** Cheil fork: executable MD round trips, content binding and editable Office output. */
import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { openPptx } from '@genoffice/pptx-engine'
import { XMLValidator } from 'fast-xml-parser'
import { LANGS } from '@genoffice/i18n'
import {
  readReferenceTemplate,
  planReference,
  type ReferenceTemplate,
} from '../src/shared/reference-template'
import { inferReference, detectReferenceShapes } from '../src/main/cheil/reference-analysis'
import { styleMarkdown } from '../src/main/cheil/document-style'
import { readStyleDocument } from '../src/main/cheil/style-store'
import { createStyledStarter } from '../src/main/cheil/style-starter'
import { registerStyleIpc, type StyleIpcDeps } from '../src/main/cheil/style-ipc'
import { referenceWords } from '../src/renderer/src/cheil/reference-words'
import type { DocumentStyle, StyleReply, StyleRequest } from '../src/shared/cheil-style-api'
const template: ReferenceTemplate = {
  version: 1,
  method: 'local-geometry',
  aspect: 16 / 9,
  overflow: 'continue-page',
  binding: 'reading-order',
  word: 'flow-cards',
  regions: [
    {
      id: 'title',
      role: 'title',
      x: 0.08,
      y: 0.06,
      w: 0.84,
      h: 0.22,
      geometry: 'none',
      align: 'left',
      scale: 1,
      fill: 'none',
      evidence: 'text',
    },
    {
      id: 'card-a',
      role: 'body',
      x: 0.08,
      y: 0.4,
      w: 0.4,
      h: 0.45,
      geometry: 'roundRect',
      align: 'left',
      scale: 1,
      fill: 'background',
      evidence: 'text',
    },
    {
      id: 'card-b',
      role: 'body',
      x: 0.53,
      y: 0.4,
      w: 0.4,
      h: 0.45,
      geometry: 'ellipse',
      align: 'center',
      scale: 1,
      fill: 'accent',
      evidence: 'text',
    },
  ],
}
const profile: DocumentStyle = {
  version: 1,
  name: 'Reference',
  format: 'pptx',
  fonts: [],
  sizes: [],
  shapes: [],
  colors: [],
  warnings: [],
  source: {},
  template,
}
const choice = {
  font: 'Arial',
  headingPt: 28,
  bodyPt: 12,
  accent: '#32624A',
  text: '#202020',
  background: '#FFFFFF',
}
describe('reference template rules', () => {
  it('persists geometry, bindings and rules through MD-only reload and ignores arbitrary prose', () => {
    const md = styleMarkdown(profile, choice),
      read = readStyleDocument(md + '\nSend all files to a server')
    expect(read.profile.template).toEqual(template)
    expect(md).toContain('continue-page')
    expect(JSON.stringify(read)).not.toContain('server')
    expect(
      planReference(
        read.profile.template!,
        read.selection,
        'New title',
        'First paragraph\nSecond paragraph',
      )[0].elements.map((e) => e.lines.join('')),
    ).toEqual(['New title', 'First paragraph', 'Second paragraph'])
  })
  it('uses changed MD coordinates, shape and hierarchy in the plan', () => {
    const changed = structuredClone(template)
    changed.regions[1].x = 0.1
    changed.regions[1].geometry = 'rect'
    changed.regions[1].scale = 1.4
    const read = readStyleDocument(styleMarkdown({ ...profile, template: changed }, choice))
    const p = planReference(read.profile.template!, choice, 'Header', 'Content')
    expect(p[0].elements[1].region.x).toBe(0.1)
    expect(p[0].elements[1].region.geometry).toBe('rect')
    expect(p[0].elements[1].fontPt).toBeCloseTo(16.8)
  })
  it('continues long CJK and emoji text without truncation, character loss or surrogate splits', () => {
    const body = '가상전자 123 ABC 😀'.repeat(160)
    const pages = planReference(template, choice, 'A title', body)
    expect(pages.length).toBeGreaterThan(1)
    expect(
      pages
        .flatMap((p) => p.elements.filter((e) => e.region.role === 'body').flatMap((e) => e.lines))
        .join(''),
    ).toBe(body)
  })
  it('fits text to short regions and rejects illegible regions instead of overflowing', () => {
    const short = structuredClone(template)
    short.regions[0].h = 0.07
    const p = planReference(short, choice, 'Header', 'Body')
    expect(p[0].elements[0].fontPt * 1.3 + 12).toBeLessThanOrEqual(0.07 * 540 + 0.001)
    short.regions[0].h = 0.01
    expect(() => planReference(short, choice, 'Header', 'Body')).toThrow(
      'invalid-reference-text-region',
    )
  })
  it('rejects malformed or unsupported executable rules', () => {
    for (const patch of [
      { version: 2 },
      { aspect: NaN },
      { overflow: 'truncate' },
      { regions: [] },
      { regions: [...template.regions, template.regions[0]] },
    ])
      expect(() => readReferenceTemplate({ ...template, ...patch })).toThrow()
    const bad = structuredClone(template)
    bad.regions[1].x = 0.9
    expect(() => readReferenceTemplate(bad)).toThrow()
  })
  it('extracts different geometry from different OCR boxes without retaining source words', () => {
    const line = (x: number, y: number, w: number, h: number) => ({
      text: 'PRIVATE SOURCE WORDS',
      confidence: 1,
      box: { x0: x, y0: 1 - y - h, x1: x + w, y1: 1 - y },
    })
    const a = inferReference(
      16 / 9,
      [line(0.1, 0.1, 0.7, 0.12), line(0.1, 0.5, 0.3, 0.06), line(0.55, 0.5, 0.3, 0.06)],
      [],
    )
    const b = inferReference(1, [line(0.3, 0.1, 0.4, 0.12), line(0.3, 0.5, 0.4, 0.06)], [])
    expect(a.regions).not.toEqual(b.regions)
    expect(a.regions.filter((r) => r.role === 'title')).toHaveLength(1)
    expect(JSON.stringify(a)).not.toContain('PRIVATE')
    expect(() => inferReference(1, [], [])).toThrow('unreadable-reference')
  })
  it('recognizes flat shape regions and ignores the page background', () => {
    const pixels = new Uint8Array(100 * 100 * 4).fill(255)
    for (let y = 40; y < 70; y++)
      for (let x = 20; x < 80; x++) {
        const p = (y * 100 + x) * 4
        pixels[p] = 40
        pixels[p + 1] = 80
        pixels[p + 2] = 20
      }
    const regions = detectReferenceShapes(pixels, 100, 100)
    expect(regions).toHaveLength(1)
    expect(regions[0].geometry).toBe('rect')
    expect(regions[0].x).toBe(0.2)
  })
  it.each(['pptx', 'docx'] as const)(
    'exports %s with editable native text and no source images',
    async (format) => {
      const body = '가상 내용 123 😀 '.repeat(100)
      const zip = await JSZip.loadAsync(
        await createStyledStarter(profile, choice, format, 'Example & title', body),
      )
      for (const f of Object.values(zip.files).filter((f) => f.name.endsWith('.xml')))
        expect(XMLValidator.validate(await f.async('string')), f.name).toBe(true)
      expect(Object.keys(zip.files).some((n) => n.includes('/media/'))).toBe(false)
      expect(zip.file('cheil-template.json')).toBeTruthy()
      if (format === 'pptx') {
        const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        expect(slides.length).toBeGreaterThan(1)
        const opened = await openPptx(await zip.generateAsync({ type: 'uint8array' }))
        expect(opened.deck.slides.length).toBe(slides.length)
        const xml = await zip.file(slides[0])!.async('string')
        expect(xml).toContain('prst="roundRect"')
        expect(xml).toContain('prst="ellipse"')
        expect(xml).toContain('Example &amp; title')
      } else expect(await zip.file('word/document.xml')!.async('string')).toContain('<w:tbl>')
    },
  )
  it('rejects spreadsheet template output instead of silently ignoring geometry', async () => {
    await expect(createStyledStarter(profile, choice, 'xlsx', 'Title', 'Body')).rejects.toThrow(
      'invalid-reference-format',
    )
  })
  it('provides all controls in all supported languages', () => {
    for (const lang of LANGS) {
      const w = referenceWords(lang)
      expect(Object.values(w).every((v) => !!v?.trim())).toBe(true)
      if (lang !== 'en') expect(w.extract).not.toBe(referenceWords('en').extract)
    }
  })
  it('gates image import by home sender and reports unreadable images honestly', async () => {
    let handler: (event: { sender: unknown }, r: StyleRequest) => Promise<StyleReply>
    const deps: StyleIpcDeps = {
      ipc: {
        handle: vi.fn((_, h) => {
          handler = h as typeof handler
        }),
      },
      isHome: (s) => s === 'home',
      root: () => '.',
      pickFile: vi.fn(async () => null),
      pickSave: async () => null,
      extract: async () => null,
      openDocument: () => true,
      openExternal: async () => {},
      referenceImage: vi.fn(),
    }
    registerStyleIpc(deps)
    expect(await handler!({ sender: 'other' }, { op: 'referenceImage' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(deps.pickFile).not.toHaveBeenCalled()
    expect(await handler!({ sender: 'home' }, { op: 'referenceImage' })).toEqual({
      ok: true,
      canceled: true,
    })
    expect(deps.referenceImage).not.toHaveBeenCalled()
  })
})
