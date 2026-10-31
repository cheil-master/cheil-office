/** Cheil fork: palette provenance, readable recommendations and persistent MD roundtrip. */
import { it, expect } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import { moodboardStyle, contrast } from '../src/main/cheil/moodboard-style'
import { styleMarkdown } from '../src/main/cheil/document-style'
import { readStyleDocument } from '../src/main/cheil/style-store'
import { moodboardWords } from '../src/renderer/src/cheil/moodboard-words'
const board = { id: '1', name: 'Demo <board>', url: 'https://www.pinterest.com/demo/a/', count: 50 }
it('measures BGRA colors, separates typography, and records partial samples', () => {
  const s = moodboardStyle(board, [new Uint8Array([30, 80, 160, 255, 30, 80, 160, 255])], 2)
  expect(s.profile.colors[0].value).toBe('#A0501E')
  expect(s.profile.fonts).toEqual([])
  expect(s.profile.moodboard).toMatchObject({ sampledPins: 1, previewPins: 2, totalPins: 50 })
  expect(s.profile.warnings).toContain('some-images-unavailable')
  expect(contrast(s.selection.accent!, s.selection.background!)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(s.selection.text!, s.selection.background!)).toBeGreaterThanOrEqual(4.5)
  const md = styleMarkdown(s.profile, s.selection)
  expect(md).toContain('not detected typography')
  expect(readStyleDocument(md)).toEqual(s)
})
it('handles white-only boards without unreadable headings and rejects missing pixels', () => {
  const s = moodboardStyle(board, [new Uint8Array([255, 255, 255, 255])], 1)
  expect(contrast(s.selection.accent!, s.selection.background!)).toBeGreaterThanOrEqual(4.5)
  expect(() => moodboardStyle(board, [], 1)).toThrow('invalid-moodboard-images')
  expect(() => moodboardStyle(board, [new Uint8Array([0, 0, 0, 0])], 1)).toThrow(
    'invalid-moodboard-images',
  )
})
it('rejects tampered sampling metadata and covers all UI languages', () => {
  const s = moodboardStyle(board, [new Uint8Array([0, 0, 0, 255])], 1)
  const md = styleMarkdown(s.profile, s.selection).replace('"sampledPins": 1', '"sampledPins": 99')
  expect(() => readStyleDocument(md)).toThrow('invalid-moodboard')
  for (const lang of LANGS) expect(Object.values(moodboardWords(lang)).every(Boolean)).toBe(true)
})
