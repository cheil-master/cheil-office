/** Cheil fork: portable, inert reference geometry shared by preview and Office adapters. */
import type { StyleSelection } from './cheil-style-api'
export interface ReferenceRegion {
  id: string
  role: 'title' | 'body' | 'label' | 'decoration'
  x: number
  y: number
  w: number
  h: number
  geometry: 'none' | 'rect' | 'roundRect' | 'ellipse'
  align: 'left' | 'center' | 'right'
  scale: number
  fill: 'none' | 'accent' | 'background'
  evidence: 'text' | 'shape' | 'suggested' | 'edited'
}
export interface ReferenceTemplate {
  version: 1
  method: 'local-geometry'
  aspect: number
  regions: ReferenceRegion[]
  overflow: 'continue-page'
  binding: 'reading-order'
  word: 'flow-cards'
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export function readReferenceTemplate(v: unknown): ReferenceTemplate {
  if (
    !obj(v) ||
    v.version !== 1 ||
    v.method !== 'local-geometry' ||
    typeof v.aspect !== 'number' ||
    !Number.isFinite(v.aspect) ||
    v.aspect < 0.4 ||
    v.aspect > 2.5 ||
    v.overflow !== 'continue-page' ||
    v.binding !== 'reading-order' ||
    v.word !== 'flow-cards' ||
    !Array.isArray(v.regions) ||
    v.regions.length < 2 ||
    v.regions.length > 24
  )
    throw Error('invalid-reference-template')
  const ids = new Set<string>()
  const regions = v.regions.map((r): ReferenceRegion => {
    if (
      !obj(r) ||
      typeof r.id !== 'string' ||
      !/^[a-z][a-z0-9-]{0,35}$/.test(r.id) ||
      ids.has(r.id)
    )
      throw Error('invalid-reference-region')
    ids.add(r.id)
    for (const k of ['x', 'y', 'w', 'h', 'scale'])
      if (typeof r[k] !== 'number' || !Number.isFinite(r[k]))
        throw Error('invalid-reference-geometry')
    const x = Number(r.x),
      y = Number(r.y),
      w = Number(r.w),
      h = Number(r.h),
      scale = Number(r.scale)
    if (
      x < 0 ||
      y < 0 ||
      w < 0.01 ||
      h < 0.005 ||
      x + w > 1.001 ||
      y + h > 1.001 ||
      scale < 0.5 ||
      scale > 4
    )
      throw Error('invalid-reference-geometry')
    if (
      !['title', 'body', 'label', 'decoration'].includes(String(r.role)) ||
      !['none', 'rect', 'roundRect', 'ellipse'].includes(String(r.geometry)) ||
      !['left', 'center', 'right'].includes(String(r.align)) ||
      !['none', 'accent', 'background'].includes(String(r.fill)) ||
      !['text', 'shape', 'suggested', 'edited'].includes(String(r.evidence))
    )
      throw Error('invalid-reference-region')
    return {
      id: r.id,
      role: r.role as ReferenceRegion['role'],
      x,
      y,
      w,
      h,
      scale,
      geometry: r.geometry as ReferenceRegion['geometry'],
      align: r.align as ReferenceRegion['align'],
      fill: r.fill as ReferenceRegion['fill'],
      evidence: r.evidence as ReferenceRegion['evidence'],
    }
  })
  if (
    regions.filter((r) => r.role === 'title').length !== 1 ||
    !regions.some((r) => r.role === 'body')
  )
    throw Error('invalid-reference-roles')
  return {
    version: 1,
    method: 'local-geometry',
    aspect: v.aspect,
    regions,
    overflow: 'continue-page',
    binding: 'reading-order',
    word: 'flow-cards',
  }
}
export const referenceSize = (t: ReferenceTemplate) => ({ width: 960, height: 960 / t.aspect })
export interface PlannedRegion {
  region: ReferenceRegion
  lines: string[]
  fontPt: number
}
export interface ReferencePage {
  elements: PlannedRegion[]
}
// Conservative character advances include CJK and emoji; explicit line breaks survive.
export function wrapReferenceText(text: string, width: number, pt: number): string[] {
  const out: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '',
      used = 0
    for (const ch of Array.from(paragraph)) {
      const advance = pt * (/^[\u0020-\u007e]$/.test(ch) ? 0.65 : 1.05)
      if (line && used + advance > width) {
        out.push(line)
        line = ''
        used = 0
      }
      line += ch
      used += advance
    }
    out.push(line)
  }
  return out
}
export function planReference(
  t: ReferenceTemplate,
  choice: StyleSelection,
  title: string,
  body: string,
): ReferencePage[] {
  t = readReferenceTemplate(t)
  if (
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    title.length > 160 ||
    body.length > 30000 ||
    [...(title + body)].some((c) => c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c))
  )
    throw Error('invalid-reference-content')
  const size = referenceSize(t)
  const titleRegion = t.regions.find((r) => r.role === 'title')!
  const slots = t.regions
    .filter((r) => r.role === 'body' || r.role === 'label')
    .sort((a, b) => (Math.abs(a.y - b.y) < 0.025 ? a.x - b.x : a.y - b.y))
  const font = (r: ReferenceRegion) => {
    const desired =
      (r.role === 'title' ? (choice.headingPt ?? 28) : (choice.bodyPt ?? 12)) * r.scale
    if (r.role === 'decoration') return desired
    const fit = Math.min(desired, (r.h * size.height - 12) / 1.3, (r.w * size.width - 16) / 1.05)
    if (fit < 8) throw Error('invalid-reference-text-region')
    return fit
  }
  const dims = (r: ReferenceRegion) => ({
    width: Math.max(8, r.w * size.width - 16),
    rows: Math.max(1, Math.floor((r.h * size.height - 12) / (font(r) * 1.3))),
  })
  const titleLines = wrapReferenceText(title, dims(titleRegion).width, font(titleRegion))
  let titleOffset = 0
  // Each nonempty paragraph maps to a slot. Long paragraphs continue without dropping text.
  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n/)
    .filter((p) => p.length > 0)
  const pages: ReferencePage[] = []
  let p = 0,
    remaining = paragraphs[0] ?? ''
  do {
    if (pages.length >= 100) throw Error('invalid-reference-overflow')
    const take = titleLines.slice(titleOffset, titleOffset + dims(titleRegion).rows)
    titleOffset += take.length
    const elements: PlannedRegion[] = t.regions
      .filter((r) => r.role === 'decoration')
      .map((region) => ({ region, lines: [], fontPt: font(region) }))
    elements.push({
      region: titleRegion,
      lines: take.length ? take : titleLines.slice(0, dims(titleRegion).rows),
      fontPt: font(titleRegion),
    })
    for (const region of slots) {
      const d = dims(region),
        lines = remaining
          ? wrapReferenceText(remaining, d.width, font(region)).slice(0, d.rows)
          : []
      const consumed = lines.join('').length
      elements.push({ region, lines, fontPt: font(region) })
      remaining = remaining.slice(consumed)
      if (!remaining && p < paragraphs.length) {
        p++
        remaining = paragraphs[p] ?? ''
      }
    }
    pages.push({ elements })
  } while (p < paragraphs.length || titleOffset < titleLines.length)
  return pages
}
export function referenceGuide(t: ReferenceTemplate): string {
  return `## Reference structure / 레퍼런스 구조\n\nLocal OCR geometry and flat shapes; roles are inferred and editable. Font identity and semantic intent are not recognized. / 로컬 OCR 위치와 단색 도형을 바탕으로 추정한 구조입니다. 역할을 검토·수정하세요. 원본 글꼴과 의미는 인식하지 않습니다.\n\n- Canvas ratio / 화면 비율: ${t.aspect}\n- Binding / 내용 연결: title → title; paragraphs → body and label slots in reading order. / 제목은 제목 영역, 문단은 읽기 순서의 본문·라벨 영역에 배치합니다.\n- Fit / 크기 조정: shrink to region, minimum 8 pt; smaller regions require correction. / 영역에 맞춰 글자 크기를 줄이며 8pt 미만이면 영역을 수정해야 합니다.\n- Overflow / 넘침: continue on another page; never discard content. / 다음 페이지에 이어 배치합니다.\n- Word: adapt the same hierarchy to flowing paragraphs and card tables. / 같은 위계를 문단·카드 표로 변환합니다.\n- Edit the JSON below to change the executable rules. / 아래 JSON을 수정하면 실제 배치 규칙이 바뀝니다.\n\n| Role | Box x/y/w/h (0–1) | Shape | Scale | Evidence |\n|---|---|---|---|---|\n${t.regions.map((r) => `| ${r.role} | ${[r.x, r.y, r.w, r.h].map((n) => n.toFixed(3)).join(' / ')} | ${r.geometry} | ${r.scale} | ${r.evidence} |`).join('\n')}\n`
}
