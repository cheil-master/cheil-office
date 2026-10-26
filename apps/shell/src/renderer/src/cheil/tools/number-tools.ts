/**
 * Cheil fork (work tools): amounts in Korean words, VAT, and day counts with
 * Korean public holidays. Pure functions only.
 */

// ── amounts ──────────────────────────────────────────────────────────────

const UNIT_VALUES: Record<string, number> = { 조: 1e12, 억: 1e8, 만: 1e4, 천: 1e3 }

/** "5억 2,000만원", "520,000,000", "₩520000000" → 520000000; null when it is not an amount */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/[₩원\s]/g, '').replace(/정$/, '')
  if (!text) return null
  if (/^\d[\d,]*$/.test(text)) return Number(text.replace(/,/g, ''))
  let total = 0
  let rest = text
  for (const unit of ['조', '억', '만']) {
    const m = new RegExp(`^(\\d[\\d,]*(?:\\.\\d+)?)${unit}`).exec(rest)
    if (m) {
      total += Number(m[1]!.replace(/,/g, '')) * UNIT_VALUES[unit]!
      rest = rest.slice(m[0].length)
    }
  }
  const thousand = /^(\d+)천/.exec(rest)
  if (thousand) {
    total += Number(thousand[1]) * 1e3
    rest = rest.slice(thousand[0].length)
  }
  if (rest) {
    if (!/^\d[\d,]*$/.test(rest)) return null
    total += Number(rest.replace(/,/g, ''))
  }
  return Number.isSafeInteger(Math.round(total)) ? Math.round(total) : null
}

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조', '경']

/** 520000000 → "오억이천만" (formal: 일 kept before 십·백·천, as on a quote) */
export function koreanNumber(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return ''
  if (n === 0) return '영'
  const groups: number[] = []
  for (let v = n; v > 0; v = Math.floor(v / 1e4)) groups.push(v % 1e4)
  let out = ''
  for (let g = groups.length - 1; g >= 0; g--) {
    const group = groups[g]!
    if (!group) continue
    let part = ''
    const digits = String(group).padStart(4, '0')
    for (let i = 0; i < 4; i++) {
      const d = Number(digits[i])
      if (d) part += DIGITS[d] + SMALL[3 - i]
    }
    out += part + BIG[g]
  }
  return out
}

/** "일금 오억이천만원정 (₩520,000,000)" */
export function amountInWords(n: number): string {
  return `일금 ${koreanNumber(n)}원정 (₩${n.toLocaleString('en-US')})`
}

export interface Vat {
  supply: number
  vat: number
  total: number
}

/**
 * VAT at 10%. From a supply price: VAT is 10% with won fractions cut. From a
 * total with VAT in: the supply price is the total ÷ 1.1 rounded to the won
 * and VAT is the rest, so the three always add up.
 */
export function vatOf(amount: number, given: 'supply' | 'total'): Vat {
  if (given === 'supply') {
    const vat = Math.floor(amount / 10)
    return { supply: amount, vat, total: amount + vat }
  }
  const supply = Math.round(amount / 1.1)
  return { supply, vat: amount - supply, total: amount }
}

// ── dates ────────────────────────────────────────────────────────────────

/**
 * Korean public holidays (substitute holidays and election days included)
 * for 2025 and 2026, from the government's announcements. A year outside the
 * table counts only weekends, and the screen says so (dates not yet certain
 * are left out rather than guessed).
 */
export const HOLIDAYS: Record<number, Record<string, string>> = {
  2025: {
    '2025-01-01': '신정',
    '2025-01-27': '임시공휴일',
    '2025-01-28': '설날 연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설날 연휴',
    '2025-03-01': '삼일절',
    '2025-03-03': '대체공휴일(삼일절)',
    '2025-05-05': '어린이날·부처님오신날',
    '2025-05-06': '대체공휴일',
    '2025-06-03': '대통령 선거일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석 연휴',
    '2025-10-06': '추석',
    '2025-10-07': '추석 연휴',
    '2025-10-08': '대체공휴일(추석)',
    '2025-10-09': '한글날',
    '2025-12-25': '성탄절',
  },
  2026: {
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절',
    '2026-03-02': '대체공휴일(삼일절)',
    '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날',
    '2026-05-25': '대체공휴일(부처님오신날)',
    '2026-06-03': '전국동시지방선거일',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-08-17': '대체공휴일(광복절)',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절',
    '2026-10-05': '대체공휴일(개천절)',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절',
  },
}

const DAY_MS = 86_400_000

/** "2027-03-01" → a UTC day (no time zone shifts) */
export function dayOf(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null
}

const isoOf = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS)

export function holidayOf(iso: string): string | null {
  return HOLIDAYS[Number(iso.slice(0, 4))]?.[iso] ?? null
}

/** whether the year's holidays are known */
export function holidaysKnown(year: number): boolean {
  return year in HOLIDAYS
}

export function isWorkday(d: Date): boolean {
  const weekday = d.getUTCDay()
  return weekday !== 0 && weekday !== 6 && !holidayOf(isoOf(d))
}

/** "D-12", "D-day", "D+3" */
export function dday(target: Date, today: Date): string {
  const days = Math.round((target.getTime() - today.getTime()) / DAY_MS)
  return days === 0 ? 'D-day' : days > 0 ? `D-${days}` : `D+${-days}`
}

export interface Span {
  /** calendar days from start to end, both counted */
  days: number
  /** working days in it: weekends and holidays out */
  workdays: number
  /** the holidays on weekdays that were taken out */
  holidays: Array<{ date: string; name: string }>
  /** years in the span whose holidays the table does not have */
  unknownYears: number[]
}

export function spanOf(start: Date, end: Date): Span {
  const [from, to] = start <= end ? [start, end] : [end, start]
  let workdays = 0
  const holidays: Span['holidays'] = []
  const unknown = new Set<number>()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!holidaysKnown(d.getUTCFullYear())) unknown.add(d.getUTCFullYear())
    const weekday = d.getUTCDay()
    const name = holidayOf(isoOf(d))
    if (weekday === 0 || weekday === 6) continue
    if (name) holidays.push({ date: isoOf(d), name })
    else workdays++
  }
  return {
    days: Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1,
    workdays,
    holidays,
    unknownYears: [...unknown],
  }
}

/** The day `n` working days after `start` (n > 0) or before it (n < 0) */
export function addWorkdays(start: Date, n: number): Date {
  let d = start
  let left = Math.abs(n)
  const step = n >= 0 ? 1 : -1
  while (left > 0) {
    d = addDays(d, step)
    if (isWorkday(d)) left--
  }
  return d
}

/** ISO week of the year, and the week of the month (the week holding the 1st is 1) */
export function weekOf(d: Date): { year: number; isoWeek: number; monthWeek: number } {
  const thursday = addDays(d, 3 - ((d.getUTCDay() + 6) % 7))
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const monthWeek = Math.ceil((d.getUTCDate() + ((first.getUTCDay() + 6) % 7)) / 7)
  return { year: thursday.getUTCFullYear(), isoWeek, monthWeek }
}

export { isoOf }
