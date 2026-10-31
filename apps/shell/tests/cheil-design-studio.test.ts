/** Cheil fork: reference handoff boundaries and MD-only reuse without Pinterest. */
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LANGS } from '@genoffice/i18n'
import { prepareDesignHandoff, validateDesignStart } from '../src/main/cheil/design-studio'
import { designReferenceStore } from '../../slides/src/main/design-reference-store'
import fixture from '../../slides/tests/fixtures/design-reference.json'
import { studioWords } from '../src/renderer/src/cheil/studio-words'
describe('design studio handoff', () => {
  const request = {
    name: 'Reference',
    brief: 'An original draft with a purpose, two options and three ordered actions.',
    board: '111',
    pins: ['123'],
  }
  it('passes only selected bounded images and the draft to the existing editor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'design-handoff-'))
    try {
      const handoff = await prepareDesignHandoff(root, request, {
        board: {
          id: '111',
          name: 'Board',
          url: 'https://www.pinterest.com/example/board/',
          count: 2,
        },
        pins: [
          { id: '123', title: 'Untrusted text', image: 'data:image/png;base64,aGVsbG8=' },
          { id: '456', title: 'Not selected', image: 'data:image/png;base64,aGVsbG8=' },
        ],
      })
      expect(handoff.materials).toHaveLength(2)
      expect(handoff.designReference).toBe(true)
      expect(handoff.designInstructions).toContain('define_reference_style')
      expect(handoff.text).not.toContain('Untrusted text')
      expect(await readFile(handoff.materials[1].path, 'utf8')).toContain(request.brief)
      expect(await readdir(join(root, 'design-drafts', handoff.id))).toHaveLength(2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  it('reuses persisted MD with new draft and no account or images', async () => {
    const root = await mkdtemp(join(tmpdir(), 'design-reuse-'))
    try {
      const saved = designReferenceStore(join(root, 'style-templates')).save(fixture)
      const h = await prepareDesignHandoff(root, {
        name: saved.name,
        brief: request.brief,
        key: saved.key,
      })
      expect(h.designStyleKey).toBe(saved.key)
      expect(h.materials[0].path).toMatch(/\.design\.md$/)
      expect(h.materials).toHaveLength(2)
      expect(h.designInstructions).toContain('without redefining')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  it('rejects path traversal, empty drafts and extra references before any account call', () => {
    for (const req of [
      { ...request, key: '../private' },
      { ...request, brief: '' },
      { ...request, pins: ['1', '2', '3'] },
      { ...request, pins: ['1', '1'] },
    ])
      expect(() => validateDesignStart(req)).toThrow()
  })
  it('has complete copy in every language', () => {
    for (const lang of LANGS)
      expect(
        Object.values(studioWords(lang)).every((v) => typeof v === 'string' && v.length > 0),
      ).toBe(true)
  })
})
