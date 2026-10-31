/** Cheil fork: deterministic local palette analysis. No image text is an instruction. */
import type { DocumentStyle, StyleSelection } from '../../shared/cheil-style-api'
import type { PinterestBoard } from '../../shared/cheil-pinterest-api'
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (v: number[]) =>
  '#' +
  v
    .map((n) => Math.round(n).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
const luminance = (color: string) =>
  rgb(color)
    .map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
export const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)

export function moodboardStyle(
  board: PinterestBoard,
  samples: Uint8Array[],
  previewPins: number,
): { profile: DocumentStyle; selection: StyleSelection } {
  const buckets = new Map<number, { count: number; sum: number[] }>()
  let sampledPins = 0
  for (const bitmap of samples.slice(0, 30)) {
    let pixels = 0
    // Electron Windows bitmaps are BGRA; normalize sample size before calling this function.
    for (let i = 0; i + 3 < bitmap.length; i += 4) {
      if (bitmap[i + 3] < 220) continue
      const channels = [bitmap[i + 2], bitmap[i + 1], bitmap[i]]
      const key = channels.reduce((v, c) => v * 8 + (c >> 5), 0)
      const b = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] }
      b.count++
      channels.forEach((c, j) => (b.sum[j] += c))
      buckets.set(key, b)
      pixels++
    }
    if (pixels) sampledPins++
  }
  if (!sampledPins) throw Error('invalid-moodboard-images')
  const colors: DocumentStyle['colors'] = []
  for (const b of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    const value = hex(b.sum.map((c) => c / b.count))
    if (
      colors.every((c) => rgb(c.value).reduce((s, n, i) => s + (n - rgb(value)[i]) ** 2, 0) > 1600)
    )
      colors.push({ value, count: b.count, basis: 'direct' })
    if (colors.length === 8) break
  }
  const dominant = colors[0].value
  // A very light tint preserves the board palette while keeping long documents readable.
  const background = hex(rgb(dominant).map((c) => 248 + (c / 255) * 7))
  const text = '#202020'
  const accentSource =
    colors.find((c) => Math.max(...rgb(c.value)) - Math.min(...rgb(c.value)) > 35)?.value ??
    dominant
  let accent = accentSource
  while (contrast(accent, background) < 4.5) accent = hex(rgb(accent).map((c) => c * 0.9))
  const name =
    [...board.name]
      .filter((c) => c.charCodeAt(0) >= 32 && !'<>`[]{}'.includes(c))
      .join('')
      .trim()
      .slice(0, 64) || 'Pinterest'
  return {
    profile: {
      version: 1,
      name: name + ' · Moodboard',
      format: 'moodboard',
      fonts: [],
      sizes: [],
      shapes: [],
      colors,
      moodboard: {
        sampledPins,
        previewPins,
        totalPins: board.count,
        sampledAt: new Date().toISOString(),
      },
      warnings: [
        'local-palette-only',
        'typography-and-layout-are-recommendations',
        'board-preview-sample-only',
        ...(sampledPins < previewPins ? ['some-images-unavailable'] : []),
      ],
      source: { url: board.url, modified: true },
    },
    selection: { font: '맑은 고딕', headingPt: 28, bodyPt: 12, accent, text, background },
  }
}
