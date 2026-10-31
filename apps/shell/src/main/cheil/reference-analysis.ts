/** Cheil fork: infer editable regions from local OCR geometry; discard recognized words. */
import type { ReferenceTemplate, ReferenceRegion } from '../../shared/reference-template'
import { readReferenceTemplate } from '../../shared/reference-template'
export interface ReferenceLine {
  box: { x0: number; y0: number; x1: number; y1: number }
  confidence: number
}
const round = (n: number) => Math.round(n * 10000) / 10000
export function inferReference(
  aspect: number,
  lines: ReferenceLine[],
  shapes: ReferenceRegion[],
): ReferenceTemplate {
  const boxes = lines
    .filter((l) => l.confidence >= 0.25)
    .map((l) => ({ x: l.box.x0, y: 1 - l.box.y1, w: l.box.x1 - l.box.x0, h: l.box.y1 - l.box.y0 }))
    .filter(
      (b) =>
        Object.values(b).every(Number.isFinite) &&
        b.w > 0.015 &&
        b.h > 0.006 &&
        b.x >= 0 &&
        b.y >= 0 &&
        b.x + b.w <= 1.001 &&
        b.y + b.h <= 1.001,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x)
  if (boxes.length < 2) throw Error('unreadable-reference')
  // Adjacent lines of similar height and left edge form a reusable paragraph region.
  const blocks: typeof boxes = []
  for (const box of boxes) {
    const near = blocks.find(
      (b) =>
        Math.abs(b.x - box.x) < 0.035 &&
        box.y >= b.y + b.h - 0.005 &&
        box.y - b.y - b.h < 0.025 &&
        Math.abs(b.w - box.w) < 0.25,
    )
    if (near) {
      near.w = Math.max(near.w, box.x + box.w - near.x)
      near.h = box.y + box.h - near.y
    } else blocks.push({ ...box })
  }
  const largest = boxes.reduce((a, b) => (b.h > a.h && b.y < 0.75 ? b : a), boxes[0])
  const title =
    blocks.find(
      (b) => largest.x >= b.x - 0.005 && largest.y >= b.y - 0.005 && largest.y <= b.y + b.h + 0.005,
    ) ?? blocks[0]
  // Keep all meaningful regions or ask for a simpler reference, never silently drop them.
  if (blocks.length > 16) throw Error('unreadable-reference')
  const regions: ReferenceRegion[] = shapes.slice(0, 6)
  for (const [i, b] of blocks.entries()) {
    const role = b === title ? 'title' : 'body'
    const region: ReferenceRegion = {
      id: `text-${i + 1}`,
      role,
      x: round(Math.max(0, b.x - 0.008)),
      y: round(Math.max(0, b.y - 0.006)),
      w: round(Math.min(1 - Math.max(0, b.x - 0.008), Math.max(b.w + 0.016, 0.12))),
      h: round(Math.min(1 - Math.max(0, b.y - 0.006), Math.max(b.h + 0.018, 0.055))),
      geometry: 'none',
      align: 'left',
      scale: 1,
      fill: 'none',
      evidence: 'text',
    }
    // A centered source line becomes centered text; font families remain a user choice.
    if (Math.abs(b.x + b.w / 2 - 0.5) < 0.035) region.align = 'center'
    const enclosure = regions.find(
      (s) =>
        s.role === 'decoration' &&
        region.x >= s.x - 0.012 &&
        region.y >= s.y - 0.012 &&
        region.x + region.w <= s.x + s.w + 0.012 &&
        region.y + region.h <= s.y + s.h + 0.012,
    )
    if (
      enclosure &&
      !blocks.some(
        (other) =>
          other !== b &&
          other.x >= enclosure.x &&
          other.y >= enclosure.y &&
          other.x + other.w <= enclosure.x + enclosure.w &&
          other.y + other.h <= enclosure.y + enclosure.h,
      )
    ) {
      region.x = enclosure.x
      region.y = enclosure.y
      region.w = enclosure.w
      region.h = enclosure.h
      region.geometry = enclosure.geometry
      region.fill = 'background'
      regions.splice(regions.indexOf(enclosure), 1)
    }
    regions.push(region)
  }
  if (!regions.some((r) => r.role === 'body')) throw Error('unreadable-reference')
  return readReferenceTemplate({
    version: 1,
    method: 'local-geometry',
    aspect: Math.max(0.4, Math.min(2.5, aspect)),
    regions,
    overflow: 'continue-page',
    binding: 'reading-order',
    word: 'flow-cards',
  })
}
// Flat-color connected regions exclude photographic texture and small lettering.
export function detectReferenceShapes(
  bgra: Uint8Array,
  width: number,
  height: number,
): ReferenceRegion[] {
  if (width * height * 4 !== bgra.length || width * height > 100000)
    throw Error('invalid-reference-bitmap')
  const keys = new Int32Array(width * height),
    counts = new Map<number, number>()
  for (let p = 0; p < keys.length; p++) {
    const i = p * 4
    keys[p] =
      bgra[i + 3] < 220
        ? -1
        : ((bgra[i] >> 5) << 6) | ((bgra[i + 1] >> 5) << 3) | (bgra[i + 2] >> 5)
    counts.set(keys[p], (counts.get(keys[p]) ?? 0) + 1)
  }
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  const seen = new Uint8Array(keys.length),
    out: ReferenceRegion[] = []
  for (let start = 0; start < keys.length; start++) {
    if (seen[start] || keys[start] === background || keys[start] === -1) continue
    const key = keys[start],
      queue = [start]
    seen[start] = 1
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0
    for (let q = 0; q < queue.length; q++) {
      const p = queue[q],
        x = p % width,
        y = Math.floor(p / width)
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
      for (const n of [
        x > 0 ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y + 1 < height ? p + width : -1,
      ])
        if (n >= 0 && !seen[n] && keys[n] === key) {
          seen[n] = 1
          queue.push(n)
        }
    }
    const w = (x1 - x0 + 1) / width,
      h = (y1 - y0 + 1) / height,
      density = queue.length / ((x1 - x0 + 1) * (y1 - y0 + 1))
    if (w * h < 0.012 || w * h > 0.65 || w < 0.08 || h < 0.012 || density < 0.68) continue
    const geometry = density > 0.92 ? 'rect' : density > 0.86 ? 'roundRect' : 'ellipse'
    out.push({
      id: `shape-${out.length + 1}`,
      role: 'decoration',
      x: round(x0 / width),
      y: round(y0 / height),
      w: round(w),
      h: round(h),
      geometry,
      align: 'left',
      scale: 1,
      fill: 'accent',
      evidence: 'shape',
    })
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 6)
}
