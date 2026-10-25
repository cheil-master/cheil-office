/**
 * Cheil fork (plan item 13, step ①): a report the person wrote before becomes
 * their own template. The file is copied as it is (fonts, places, layout and
 * masters untouched); only what changes from campaign to campaign turns into
 * a `[blank]`. The app finds those values by rules, with no model call:
 *
 * - a labelled value: "광고주 | 가상전자" in a table row or "광고주: 가상전자"
 *   in a line, where the label is a common field (or its alias) → that
 *   field's blank, so a campaign card fills it later;
 * - amounts, rates and dates anywhere → `[금액]`, `[수치]`, `[날짜]`.
 *
 * The person checks the list, turns rows off, renames blanks or adds their
 * own; the editor then replaces each value everywhere (the card-change path).
 * Pure functions only.
 */
import { CHEIL_FIELDS, cheilReplaceText } from './cheil-fields'

export type CheilBlankKind = 'field' | 'money' | 'rate' | 'date'

export interface CheilBlankCandidate {
  /** the text in the document */
  find: string
  /** the blank it becomes, with its brackets */
  blank: string
  kind: CheilBlankKind
  /** how many places hold it */
  count: number
}

/** a label (no brackets, no spaces) → the blank of its common field */
const LABELS = new Map<string, string>()
const unbracket = (s: string) => s.replace(/^\[|\]$/g, '')
const squash = (s: string) => s.replace(/\s+/g, '')
for (const field of CHEIL_FIELDS) {
  for (const name of [field.placeholder, field.label, ...field.aliases]) {
    LABELS.set(squash(unbracket(name)), field.placeholder)
  }
}
// labels reports use for the same fields
for (const [label, key] of [
  ['클라이언트', 'client'],
  ['광고주사', 'client'],
  ['캠페인', 'campaign'],
  ['프로젝트명', 'campaign'],
  ['제품명', 'brand'],
  ['집행기간', 'period'],
  ['운영기간', 'period'],
  ['예산', 'budget'],
  ['총예산', 'budget'],
  ['집행예산', 'budget'],
  ['타겟', 'target'],
  ['핵심타깃', 'target'],
  ['목표KPI', 'kpi'],
  ['담당팀', 'team'],
  ['담당자', 'author'],
  ['작성', 'author'],
  ['작성일', 'today'],
  ['작성일자', 'today'],
  ['날짜', 'today'],
  ['일자', 'today'],
] as const) {
  const field = CHEIL_FIELDS.find((f) => f.key === key)
  if (field) LABELS.set(label, field.placeholder)
}

/** The common field's blank a label names; null for any other label */
export function cheilBlankForLabel(label: string): string | null {
  const key = squash(label.replace(/^[-•·*]\s*/, '').replace(/[:：]$/, ''))
  return LABELS.get(key) ?? null
}

const VALUE_MAX = 60
const TEAM_BLANK = CHEIL_FIELDS.find((f) => f.key === 'team')?.placeholder ?? '[팀명]'

const usable = (value: string) =>
  value.length >= 2 && value.length <= VALUE_MAX && !/[[\]]/.test(value)

const DATE_RE =
  /\b20\d{2}[-./]\s?\d{1,2}[-./]\s?\d{1,2}\b\.?|20\d{2}년\s?\d{1,2}월(?:\s?\d{1,2}일)?|\b\d{1,2}월\s?\d{1,2}일/g
const MONEY_RE =
  /(?:₩\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:조|억|천만|백만|만)?\s?(?:원|달러))(?:\s?(?:~|-)\s?\d[\d,]*(?:\.\d+)?\s?(?:조|억|천만|백만|만)?\s?(?:원|달러))?/g
const RATE_RE = /\d+(?:\.\d+)?\s?(?:%p|%|퍼센트|포인트)/g

/** Values that change between campaigns, found in a document's text */
export function findCheilTemplateBlanks(text: string): CheilBlankCandidate[] {
  const found = new Map<string, { blank: string; kind: CheilBlankKind; at: number }>()
  const add = (find: string, blank: string, kind: CheilBlankKind, at: number) => {
    const value = find.trim()
    if (!usable(value) || found.has(value)) return
    found.set(value, { blank, kind, at })
  }
  let at = 0
  for (const line of text.split('\n')) {
    // a table row: "label | value | label | value"
    const cells = line.split(' | ').map((c) => c.trim())
    if (cells.length >= 2) {
      for (let i = 0; i + 1 < cells.length; i++) {
        if (cheilBlankForLabel(cells[i + 1]!)) continue
        // "작성일 · 판 | 2026-10-26 · v2" pairs part by part; "작성 | 홍길동 · 비즈니스13팀"
        // gives its first part to the label and a team's name to [팀명]
        const labels = cells[i]!.split(' · ')
        const values = cells[i + 1]!.split(' · ')
        if (labels.length === values.length) {
          labels.forEach((label, k) => {
            const blank = cheilBlankForLabel(label)
            if (blank) add(values[k]!, blank, 'field', at)
          })
          continue
        }
        const blank = cheilBlankForLabel(cells[i]!)
        if (!blank) continue
        add(values[0]!, blank, 'field', at)
        for (const part of values.slice(1)) {
          if (/팀$/.test(part.trim())) add(part, TEAM_BLANK, 'field', at)
        }
      }
    } else {
      // a labelled line: "- 목표 KPI: 브랜드 인지도 30%"
      const m = /^\s*(?:[-•·*]\s*)?([^:：]{1,16})[:：]\s*(.+)$/.exec(line)
      const blank = m ? cheilBlankForLabel(m[1]!) : null
      if (m && blank) add(m[2]!, blank, 'field', at)
    }
    at += line.length + 1
  }
  for (const [re, blank, kind] of [
    [DATE_RE, '[날짜]', 'date'],
    [MONEY_RE, '[금액]', 'money'],
    [RATE_RE, '[수치]', 'rate'],
  ] as const) {
    for (const m of text.matchAll(re)) {
      const value = m[0].replace(/\.$/, '')
      // a value inside a field's value is replaced with it
      if ([...found.keys()].some((f) => f.includes(value))) continue
      add(value, blank, kind, m.index ?? 0)
    }
  }
  const finds = [...found.keys()]
  const { counts } = cheilReplaceText(
    text,
    finds.map((find) => ({ find, replace: '' })),
  )
  return finds
    .map((find, i) => ({ find, ...found.get(find)!, count: counts[i]! }))
    .filter((c) => c.count > 0)
    .sort((a, b) =>
      (a.kind === 'field') === (b.kind === 'field') ? a.at - b.at : a.kind === 'field' ? -1 : 1,
    )
    .map(({ find, blank, kind, count }) => ({ find, blank, kind, count }))
}

/** A blank name the person typed, as a blank: "예산" → "[예산]"; null when unusable */
export function cheilBlankOf(name: string): string | null {
  const inner = unbracket(name.trim()).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
  return inner && inner.length <= 30 ? `[${inner}]` : null
}

/** The panel's line once the values of a report became blanks (plan item 13) */
export function cheilTemplateNote(
  lang: string,
  items: ReadonlyArray<{ label: string; from: string; count: number }>,
): string {
  const done = items.filter((i) => i.count > 0)
  const total = done.reduce((sum, i) => sum + i.count, 0)
  const ko = lang === 'ko'
  if (total === 0) {
    return ko
      ? '내 양식으로 만들 값을 이 문서에서 찾지 못했습니다.'
      : 'None of the values to turn into blanks were found in this document.'
  }
  return ko
    ? `내 양식으로 만들려고 값 ${total}곳을 [칸]으로 바꿨습니다(AI 없이). 확인하고 저장하세요: ${done
        .map((i) => `${i.from} → ${i.label}`)
        .join(', ')}`
    : `Turned ${total} places into blanks for your template (no AI). Check and save: ${done
        .map((i) => `${i.from} → ${i.label}`)
        .join(', ')}`
}
