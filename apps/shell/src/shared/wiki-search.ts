/** Cheil fork: local passage retrieval with Korean particles and source locations. */
import type { WikiPage, WikiExcerpt } from './cheil-wiki-api'

const STOP = new Set(
  '자료 문서 캠페인 내용 관련 검색 찾아 찾아줘 알려줘 알려 보여줘 어떻게 뭐야 언제 언제부터 언제까지 어떤 대한 대해서 질문 있어 했어 했지 했는지 하라고 해줘 전체 내역 확인 근거 다시 보고에서 제안에서'.split(
    ' ',
  ),
)
const SUFFIX =
  /(이라고|이라는|에서는|에서|으로|라고|라는|까지|부터|에게|들의|과는|와는|이랑|하고|에서의|을|를|은|는|이|가|의|에|와|과|로|도)$/
const compact = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
export function queryTerms(query: string): string[] {
  const words =
    query
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}/._-]*/gu) ?? []
  const terms = words
    .map((w) => {
      if (/^[가-힣]{3,}$/.test(w)) {
        const stem = w.replace(/(?:하라는|하라고|했어|했지)$/, '').replace(SUFFIX, '')
        if (stem.length >= 2) return stem
      }
      return /[a-z0-9]/.test(w) ? w.replace(/(은|는|을|를|의|이|가)$/, '') : w
    })
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^(했|하라|바꾸라|넘는다)/.test(w))
  const aliases: Record<string, string> = {
    수리: 'a/s',
    배우: '출연',
    워딩: '표현',
    소비자말: '워딩',
  }
  const dates = [...query.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)].map(
    (m) => m[1]!.padStart(2, '0') + m[2]!.padStart(2, '0'),
  )
  return [
    ...new Set([...terms, ...terms.flatMap((w) => (aliases[w] ? [aliases[w]!] : [])), ...dates]),
  ].slice(0, 40)
}
interface Passage {
  page: WikiPage
  text: string
  location: string
  start: number
  end: number
}
function passages(page: WikiPage): Passage[] {
  // A short worksheet is one logical table; do not silently omit its final rows.
  if (
    page.body.length <= 2500 &&
    /\[row \d+\]/.test(page.body) &&
    (page.body.match(/^# /gm) ?? []).length === 1
  ) {
    const rows = [...page.body.matchAll(/\[row (\d+)\]/g)].map((m) => m[1])
    return [
      {
        page,
        text: page.body,
        location: `${page.body.split('\n')[0]?.replace(/^# /, '')} · rows ${rows[0]}–${rows.at(-1)}`,
        start: 0,
        end: page.body.length,
      },
    ]
  }

  const lines = page.body.split('\n').flatMap((text, origin) =>
    text.length <= 1000
      ? [{ text, origin }]
      : Array.from({ length: Math.ceil(text.length / 900) }, (_, i) => ({
          text: text.slice(i * 900, i * 900 + 1000),
          origin,
        })),
  )
  const out: Passage[] = []
  let heading = '',
    header: string[] = [],
    sectionRow = 0,
    offset = 0
  let headerOpen = true
  let text = '',
    first = 1,
    last = 1,
    start = 0
  const flush = () => {
    if (!text.trim()) return
    const prefix = [
      heading.slice(0, 200),
      ...header.filter((h) => !text.includes(h)).map((h) => h.slice(0, 500)),
    ]
      .filter(Boolean)
      .join('\n')
    const rows = [...text.matchAll(/\[row (\d+)\]/g)].map((m) => m[1])
    out.push({
      page,
      text: (prefix ? prefix + '\n' : '') + text.trim(),
      location: `${heading.replace(/^#+\s*/, '') || '본문'} · ${rows.length ? 'rows ' + rows[0] + '–' + rows.at(-1) : 'lines ' + first + '–' + last}`,
      start,
      end: offset,
    })
    text = ''
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.text
    if (/^(?:#{1,4}\s|\[[^\]]{2,35}\]\s*$)/.test(line)) {
      flush()
      heading = line
      header = []
      sectionRow = 0
      headerOpen = true
    } else sectionRow++
    if (headerOpen && line.includes(' | ') && sectionRow <= 40) {
      const cells = line
        .replace(/^\[row \d+\]\s*/, '')
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c && !/^\(\d+ empty\)$/.test(c))
      const numeric = cells.filter((c) => /^[+-]?[\d,.%/-]+$/.test(c)).length
      if (cells.length - numeric >= 3 && cells.length - numeric >= numeric)
        header = [...header, line].slice(-2)
      if (
        header.length &&
        numeric >= 2 &&
        (numeric / cells.length > 0.5 || /\d{4}-\d{2}-\d{2}/.test(line))
      )
        headerOpen = false
    }
    if (!text) {
      first = lines[i]!.origin + 1
      start = offset
    }
    last = lines[i]!.origin + 1
    // Overlapping neighbouring lines retain labels and units around a match.
    if (text.length + line.length > 850 && text.trim()) {
      const previous = text.split('\n').filter(Boolean).slice(-1).join('\n')
      flush()
      first = Math.max(1, lines[i]!.origin)
      start = Math.max(0, offset - previous.length - 1)
      text = previous.length <= 350 ? previous + '\n' : ''
    }
    text += line + '\n'
    offset += line.length + 1
    if (!line.trim() && text.length > 550) flush()
  }
  flush()
  return out
}
export function searchWiki(pages: WikiPage[], query: string, limit = 6): WikiExcerpt[] {
  const terms = queryTerms(query)
  if (!terms.length) return []
  const texts = pages.map((p) => compact(p.title + '\n' + p.body))
  // A requested unknown identifier must not be answered from a generic campaign match.
  if (
    terms.some(
      (t) => /[a-z]/.test(t) && /\d/.test(t) && t.length >= 12 && !texts.some((s) => s.includes(t)),
    )
  )
    return []
  const candidates = pages.flatMap(passages)
  const weights = new Map(
    terms.map((t) => [
      t,
      (1 +
        Math.log(
          (candidates.length + 1) /
            (1 +
              candidates.filter((p) => compact(p.page.title + '\n' + p.text).includes(t)).length),
        )) *
        Math.sqrt(t.length / 3) *
        (['보고', '운영', '제안', '광고', '집행', '집행현황', '정리', '준비', '제품'].includes(t)
          ? 0.2
          : 1),
    ]),
  )
  const ranked = candidates
    .map((p) => {
      const body = compact(p.text),
        title = compact(p.page.title)
      const matched = terms.filter((t) => body.includes(t) || title.includes(t))
      const bodyTerms = terms.filter((t) => body.includes(t))
      let score =
        matched.reduce(
          (n, t) =>
            n + weights.get(t)! * ((body.includes(t) ? 1 : 0) + (title.includes(t) ? 1 : 0)),
          0,
        ) +
        bodyTerms.length * bodyTerms.length * 0.15
      for (let i = 0; i < terms.length - 1; i++)
        if (title.includes(terms[i]! + terms[i + 1]!))
          score += (weights.get(terms[i]!)! + weights.get(terms[i + 1]!)!) * 1.5
      return { ...p, score, matched }
    })
    .filter((p) => p.score > 0 && (p.matched.length >= Math.min(2, terms.length) || p.score >= 2.5))
    .sort((a, b) => b.score - a.score || a.page.id.localeCompare(b.page.id) || a.start - b.start)
  const selected: typeof ranked = []
  for (const p of ranked) {
    if (p.score < (ranked[0]?.score ?? 0) * 0.48) continue
    if (
      selected.some(
        (s) =>
          s.page.id === p.page.id &&
          Math.min(s.end, p.end) - Math.max(s.start, p.start) >
            Math.min(s.end - s.start, p.end - p.start) * 0.5,
      )
    )
      continue
    if (selected.filter((s) => s.page.id === p.page.id).length >= 3) continue
    selected.push(p)
    if (selected.length >= limit) break
  }
  return selected.map((p) => ({
    id: p.page.id,
    title: p.page.title,
    version: p.page.version,
    text: p.text,
    location: p.location,
  }))
}
