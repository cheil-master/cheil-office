/**
 * Cheil fork: the common blanks every Cheil template shares.
 *
 * The same information (client, campaign name, period, budget, ...) used to go
 * by a different blank in each template ([광고주] in one, [광고주명] in
 * another). `cheil-fields.json` names each once; `tools/cheil/make_templates.py`
 * builds the templates with those names only, and the app reads them here: a
 * campaign card's values go straight into the common blanks, with no model
 * call (`cheilFieldValues`, `cheilFieldValueFor`). Aliases are read too, so a
 * person's own template with [광고주명] is filled the same way.
 *
 * The one-call fill sends the blanks as they are, without their `hint`: on
 * gemma4:e4b the added meaning left the message and concept blanks open
 * (cheil-fill.ts).
 *
 * Pure functions only.
 */
import data from './cheil-fields.json'

export type CheilFieldKey =
  | 'campaign'
  | 'client'
  | 'brand'
  | 'period'
  | 'budget'
  | 'target'
  | 'kpi'
  | 'team'
  | 'author'
  | 'date'

export interface CheilField {
  key: CheilFieldKey
  /** the blank the templates use, brackets included */
  placeholder: string
  /** the name a person reads (campaign card, lists) */
  label: string
  /** where the value comes from: the campaign card, or the day the document is made */
  source: 'card' | 'today'
  /** what the blank means, for a person reading the dictionary */
  hint: string
  /** other blanks that mean the same; the templates never use them */
  aliases: readonly string[]
}

export const CHEIL_FIELDS: readonly CheilField[] = data.fields as CheilField[]

const byPlaceholder = new Map<string, CheilField>()
for (const field of CHEIL_FIELDS) {
  byPlaceholder.set(normalize(field.placeholder), field)
  for (const alias of field.aliases) byPlaceholder.set(normalize(alias), field)
}

/** `[ 광고주명 ]` and `[광고주명]` are the same blank */
function normalize(placeholder: string): string {
  return placeholder
    .replace(/\s+/g, ' ')
    .replace(/^\[\s*/, '[')
    .replace(/\s*\]$/, ']')
}

/** The common field a blank names, by its own name or an alias; null for any other blank */
export function cheilFieldOf(placeholder: string): CheilField | null {
  return byPlaceholder.get(normalize(placeholder)) ?? null
}

/** A campaign card: what a person types once for the whole campaign */
export interface CheilCampaignCard {
  campaign: string
  client: string
  brand: string
  /** YYYY-MM-DD, or empty */
  start: string
  /** YYYY-MM-DD, or empty */
  end: string
  /** as typed: "500000000", "5억 원" */
  budget: string
  target: string
  kpi: string
  team: string
  author: string
}

export const EMPTY_CHEIL_CARD: CheilCampaignCard = {
  campaign: '',
  client: '',
  brand: '',
  start: '',
  end: '',
  budget: '',
  target: '',
  kpi: '',
  team: '',
  author: '',
}

/** the marker the house rules leave for a person */
const OPEN = '[확인 필요]'

/** A budget of bare digits reads as won with thousands separators; anything else as typed */
export function cheilBudgetText(budget: string): string {
  const value = budget.trim()
  const digits = value.replace(/,/g, '')
  if (/^\d+$/.test(digits)) return `${Number(digits).toLocaleString('en-US')}원`
  return value
}

/** The local calendar day as YYYY-MM-DD */
export function cheilToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * The common blanks a card fills, by canonical placeholder. A field the card
 * leaves empty is left out (the model or a person fills it); a period with one
 * end known keeps the other end open.
 */
export function cheilFieldValues(
  card: Partial<CheilCampaignCard>,
  today: string,
): Map<string, string> {
  const values = new Map<string, string>()
  const text = (v: string | undefined) => (v ?? '').replace(/\s*\n\s*/g, ' ').trim()
  for (const field of CHEIL_FIELDS) {
    let value = ''
    switch (field.key) {
      case 'period': {
        const start = text(card.start)
        const end = text(card.end)
        if (start || end) value = `${start || OPEN} ~ ${end || OPEN}`
        break
      }
      case 'budget':
        value = cheilBudgetText(text(card.budget))
        break
      case 'date':
        value = text(today)
        break
      default:
        value = text((card as Partial<Record<string, string>>)[field.key])
    }
    if (value) values.set(field.placeholder, value)
  }
  return values
}

/** The card's value for a blank found in a document (its own name or an alias), or null */
export function cheilFieldValueFor(
  placeholder: string,
  values: ReadonlyMap<string, string>,
): string | null {
  const field = cheilFieldOf(placeholder)
  if (!field) return null
  return values.get(field.placeholder) ?? null
}

// ── a document set opened from a campaign (plan item 4) ──

/** What a template tab is handed with: the campaign's name and its card's values by blank */
export interface CheilCardFill {
  campaign: string
  /** canonical placeholder → value (`cheilFieldValues`, as a plain object for the hand-off) */
  values: Record<string, string>
}

/** most values a hand-off carries, and the longest one */
const CARD_FILL_MAX_VALUES = 40
const CARD_FILL_VALUE_MAX = 1_000

/** A hand-off's card fill as read in a renderer; null when it is missing or malformed */
export function cheilCardFillOf(raw: unknown): CheilCardFill | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.campaign !== 'string' || !r.values || typeof r.values !== 'object') return null
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(r.values as Record<string, unknown>).slice(
    0,
    CARD_FILL_MAX_VALUES,
  )) {
    if (!/^\[[^[\]\n]{1,80}\]$/.test(key) || typeof value !== 'string') continue
    if (!value.trim() || value.length > CARD_FILL_VALUE_MAX) continue
    values[key] = value
  }
  return { campaign: r.campaign.slice(0, 200), values }
}

/**
 * The replacements a card makes in a document: every blank found there that
 * names a common field (by its own name or an alias) the card has a value for.
 * Other blanks stay for the quick fill or a person.
 */
export function cheilCardReplacements(
  placeholders: readonly string[],
  values: Readonly<Record<string, string>>,
): Array<{ find: string; replace: string }> {
  const map = new Map(Object.entries(values))
  const out: Array<{ find: string; replace: string }> = []
  const seen = new Set<string>()
  for (const placeholder of placeholders) {
    if (seen.has(placeholder)) continue
    seen.add(placeholder)
    const value = cheilFieldValueFor(placeholder, map)
    if (value) out.push({ find: placeholder, replace: value })
  }
  return out
}

/** The card as lines for a request ("[캠페인 카드]", then "광고주: 가상전자", ...): empty fields left out */
export function cheilCardSummary(card: Partial<CheilCampaignCard>): string {
  const text = (v: string | undefined) => (v ?? '').replace(/\s*\n\s*/g, ' ').trim()
  const period =
    text(card.start) || text(card.end)
      ? `${text(card.start) || '?'} ~ ${text(card.end) || '?'}`
      : ''
  const rows: Array<[string, string]> = [
    ['캠페인명', text(card.campaign)],
    ['광고주', text(card.client)],
    ['브랜드·제품', text(card.brand)],
    ['캠페인 기간', period],
    ['총예산', cheilBudgetText(text(card.budget))],
    ['타깃', text(card.target)],
    ['KPI', text(card.kpi)],
    ['팀명', text(card.team)],
    ['작성자', text(card.author)],
  ]
  const lines = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
  return lines.length ? ['[캠페인 카드]', ...lines].join('\n') : ''
}

/** The panel's note after a card fill */
export function cheilCardFillNote(
  lang: string,
  input: { campaign: string; filled: number },
): string {
  if (lang === 'ko') {
    return input.filled > 0
      ? `캠페인 '${input.campaign}' 카드로 공통 칸 ${input.filled}개를 채웠습니다(AI 없이). 나머지 칸은 자료를 붙여 보내면 채웁니다.`
      : `캠페인 '${input.campaign}' 카드에 이 양식의 공통 칸에 넣을 값이 없습니다. 자료를 붙여 보내면 채웁니다.`
  }
  return input.filled > 0
    ? `Filled ${input.filled} common blanks from the '${input.campaign}' campaign card (no AI). Send your material to fill the rest.`
    : `The '${input.campaign}' campaign card has no values for this template's common blanks. Send your material to fill it.`
}
