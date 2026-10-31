/** Cheil fork: durable MD, validated rules and actual selected-style propagation. */
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fixture from './fixtures/design-reference.json'
import {
  readDesignReference,
  readDesignMarkdown,
  designMarkdown,
  designStyleText,
} from '../src/shared/design-reference'
import { designReferenceStore } from '../src/main/design-reference-store'
import { createSlidesSkill, type DeckAccess } from '../src/renderer/ai/slides-skill'
import { createTemplateSelectionState } from '../src/renderer/ai/template-selection-state'
describe('reusable design references', () => {
  it('preserves semantic recipes through MD-only restart and subsequent edits', () => {
    const root = mkdtempSync(join(tmpdir(), 'design-md-'))
    try {
      const store = designReferenceStore(root),
        saved = store.save(fixture)
      expect(store.list()[0].key).toBe(saved.key)
      const md = readFileSync(store.pathOf(saved.key), 'utf8')
      expect(readDesignMarkdown(md)).toEqual(readDesignReference(fixture))
      expect(designReferenceStore(root).load(saved.key).design.layouts.comparison).toContain(
        'criterion rows',
      )
      const revised = {
        ...fixture,
        composition:
          'Wide margins and a centered focal point for the cover; align all body content consistently.',
      }
      writeFileSync(store.pathOf(saved.key), designMarkdown(readDesignReference(revised)))
      expect(designStyleText(store.load(saved.key).design)).toContain('centered focal point')
      expect(() => store.load('../secrets')).toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('rejects palette-only profiles, oversized fields and unsafe provenance', () => {
    expect(() => readDesignReference({ ...fixture, layouts: {} })).toThrow()
    expect(() => readDesignReference({ ...fixture, shapes: 'x'.repeat(2500) })).toThrow()
    expect(() => readDesignReference({ ...fixture, sources: ['file:///secret'] })).toThrow()
    expect(() => readDesignMarkdown('x'.repeat(40001))).toThrow()
  })
  it('selects the saved rules before content-aware generation; does not regenerate style', async () => {
    const key = 'ref-11111111-1111-1111-1111-111111111111',
      styleSkill = designStyleText(readDesignReference(fixture))
    let current: import('../src/shared/ipc').TemplateSelection | null = null
    const selection = createTemplateSelectionState({
      getTemplateSelection: async () => current,
      setTemplateSelection: async (s) => {
        current = s ? { ...s, adjustments: [], updatedAt: Date.now() } : null
        return current
      },
      loadStyleTemplate: async () => ({ ok: true }),
    })
    const styles: string[] = [],
      briefs: string[] = []
    const access: DeckAccess = {
      getSlides: () => [],
      getCurrent: () => 0,
      getSelectedIds: () => [],
      applySlide: () => {},
      applyDeck: () => {},
      fitWidthPx: 1280,
      templateSelection: selection,
      saveDesignReference: async () => ({ ok: true, key }),
      loadStyleTemplate: async () => ({ ok: true, styleSkill }),
      generateStyleSkill: vi.fn(async () => {
        throw Error('must reuse MD')
      }),
      generatePageLocal: async (a) => {
        styles.push(a.style)
        briefs.push(a.brief)
        return { ok: true, marker: `localpptx:${styles.length}` }
      },
      landGeneratedPages: async () => ({ ok: true, count: styles.length }),
    }
    const skill = createSlidesSkill(access)
    const defined = await skill.executeTool({
      id: 'define',
      name: 'define_reference_style',
      input: fixture,
    })
    expect(defined.isError).not.toBe(true)
    expect(selection.current()?.key).toBe(key)
    const generated = await skill.executeTool({
      id: 'generate',
      name: 'generate_deck',
      input: {
        topic: 'A supplied campaign draft',
        pages: [
          {
            title: 'Campaign',
            type: 'cover',
            layout: 'cover_typography_hero',
            brief: 'Introduce the supplied campaign purpose.',
            image_queries: [],
          },
          {
            title: 'Choice',
            type: 'content',
            layout: 'two_column_comparison',
            brief: 'Compare acquisition and retention with supplied criteria.',
            image_queries: [],
          },
          {
            title: 'Sequence',
            type: 'content',
            layout: 'timeline_horizontal',
            brief: 'Explain prepare, test and improve as ordered steps.',
            image_queries: [],
          },
        ],
      },
    })
    expect(generated.isError).not.toBe(true)
    expect(styles).toHaveLength(3)
    expect(styles.every((s) => s.includes(fixture.composition))).toBe(true)
    expect(new Set(briefs).size).toBe(3)
    expect(access.generateStyleSkill).not.toHaveBeenCalled()
  })
})
