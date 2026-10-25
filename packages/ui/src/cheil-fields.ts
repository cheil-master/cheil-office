/**
 * Cheil fork: the common blanks every Cheil template shares.
 *
 * The same information (client, campaign name, period, budget, ...) used to go
 * by a different blank in each template ([광고주] in one, [광고주명] in
 * another). `cheil-fields.json` names each once; `tools/cheil/make_templates.py`
 * builds the templates with those names only, and the app reads them here:
 *
 * - the one-call fill tells the model what a common blank means (its hint),
 *   since a short name like [타깃] says less than the long blanks did;
 * - a campaign card's values go straight into the common blanks, with no model
 *   call (`cheilFieldValues`, `cheilFieldValueFor`). Aliases are read too, so
 *   a person's own template with [광고주명] is filled the same way.
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
  /** what the blank means, for the model */
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

/** What a common blank means; null for any other blank */
export function cheilFieldHint(placeholder: string): string | null {
  return cheilFieldOf(placeholder)?.hint ?? null
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
