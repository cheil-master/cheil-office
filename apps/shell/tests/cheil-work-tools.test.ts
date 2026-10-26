/**
 * Cheil fork (work tools): character counts, the spelling rules, amounts in
 * Korean words and VAT, day counts with holidays, and the AI tools' masking.
 */
import { describe, expect, it } from 'vitest'
import {
  applySpellingFixes,
  countText,
  findSpellingIssues,
} from '../src/renderer/src/cheil/tools/text-tools'
import {
  addWorkdays,
  amountInWords,
  dayOf,
  dday,
  isoOf,
  koreanNumber,
  parseAmount,
  spanOf,
  vatOf,
  weekOf,
} from '../src/renderer/src/cheil/tools/number-tools'
import {
  buildSpellingPrompt,
  buildTranslatePrompt,
  parseSpellingFixes,
  parseTranslation,
} from '../src/renderer/src/cheil/tools/ai-tools'

describe('Cheil fork: character counts', () => {
  it('counts with and without spaces, bytes, lines and sheets', () => {
    expect(countText('에어린 봄 런칭\nAB 1')).toEqual({
      withSpaces: 12,
      withoutSpaces: 9,
      bytes: 18,
      utf8: 24,
      lines: 2,
      sheets: 1,
    })
    expect(countText('')).toMatchObject({ withSpaces: 0, lines: 0, sheets: 0 })
    expect(countText('가'.repeat(201)).sheets).toBe(2)
  })
})

describe('Cheil fork: spelling rules', () => {
  const text =
    '검토후 몇일 안에 회신 드릴께요. 확인할수 있습니다. 오랫만에 됬네요. 회의 후 연락합니다.'

  it('finds only sure mistakes, in order', () => {
    expect(findSpellingIssues(text).map((i) => [i.found, i.fix, i.kind])).toEqual([
      ['검토후', '검토 후', '띄어쓰기'],
      ['몇일', '며칠', '자주 틀리는 말'],
      ['드릴께', '드릴게', '자주 틀리는 말'],
      ['할수 있', '할 수 있', '띄어쓰기'],
      ['오랫만', '오랜만', '자주 틀리는 말'],
      ['됬', '됐', '자주 틀리는 말'],
    ])
  })

  it('fixes them all and leaves correct text alone', () => {
    const fixed = applySpellingFixes(text, findSpellingIssues(text))
    expect(fixed).toBe(
      '검토 후 며칠 안에 회신 드릴게요. 확인할 수 있습니다. 오랜만에 됐네요. 회의 후 연락합니다.',
    )
    expect(findSpellingIssues('부장님께요. 결재 부탁드립니다. 며칠 뒤 봬요.')).toEqual([])
  })
})

describe('Cheil fork: amounts and VAT', () => {
  it('reads amounts written many ways', () => {
    expect(parseAmount('520,000,000')).toBe(520_000_000)
    expect(parseAmount('5억 2,000만원')).toBe(520_000_000)
    expect(parseAmount('₩1,234,500원')).toBe(1_234_500)
    expect(parseAmount('3천')).toBe(3000)
    expect(parseAmount('1조 5억')).toBe(1_000_500_000_000)
    expect(parseAmount('오억')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })

  it('writes them in Korean words as on a quote', () => {
    expect(koreanNumber(520_000_000)).toBe('오억이천만')
    expect(koreanNumber(1_010_000)).toBe('일백일만')
    expect(koreanNumber(10_000)).toBe('일만')
    expect(amountInWords(1_234_500)).toBe('일금 일백이십삼만사천오백원정 (₩1,234,500)')
  })

  it('splits VAT from a supply price or a total', () => {
    expect(vatOf(1_000_005, 'supply')).toEqual({
      supply: 1_000_005,
      vat: 100_000,
      total: 1_100_005,
    })
    expect(vatOf(1_100_000, 'total')).toEqual({ supply: 1_000_000, vat: 100_000, total: 1_100_000 })
    const odd = vatOf(1_234_567, 'total')
    expect(odd.supply + odd.vat).toBe(1_234_567)
  })
})

describe('Cheil fork: day counts', () => {
  const d = (iso: string) => dayOf(iso)!

  it('counts D-day and working days with the 2026 holidays', () => {
    expect(dday(d('2026-11-03'), d('2026-10-26'))).toBe('D-8')
    expect(dday(d('2026-10-26'), d('2026-10-26'))).toBe('D-day')
    expect(dday(d('2026-10-20'), d('2026-10-26'))).toBe('D+6')
    // 9/21 (Mon) – 10/9 (Fri): Chuseok 9/24–25, 10/5 and 10/9 are out
    const span = spanOf(d('2026-09-21'), d('2026-10-09'))
    expect(span.days).toBe(19)
    expect(span.workdays).toBe(11)
    expect(span.holidays.map((h) => h.date)).toEqual([
      '2026-09-24',
      '2026-09-25',
      '2026-10-05',
      '2026-10-09',
    ])
    expect(span.unknownYears).toEqual([])
    expect(isoOf(addWorkdays(d('2026-09-23'), 1))).toBe('2026-09-28')
    expect(isoOf(addWorkdays(d('2026-09-28'), -1))).toBe('2026-09-23')
  })

  it('says when a year has no holiday table, and finds weeks', () => {
    expect(spanOf(d('2026-12-30'), d('2027-01-04')).unknownYears).toEqual([2027])
    expect(weekOf(d('2026-10-26'))).toEqual({ year: 2026, isoWeek: 44, monthWeek: 5 })
    expect(dayOf('2026-02-30')).toBeNull()
  })
})

describe('Cheil fork: the AI tools send no numbers', () => {
  it('masks numbers for the spelling check and keeps only real fixes', () => {
    const text = '예산 500,000,000원으로 검토후 회신 드릴께요.'
    const prompt = buildSpellingPrompt(text)
    expect(prompt.user).not.toContain('500,000,000')
    const fixes = parseSpellingFixes(
      JSON.stringify({
        fixes: [
          { find: '{값1}으로 검토후', fix: '{값1}으로 검토 후', why: '띄어쓰기' },
          { find: '없는 말', fix: '고친 말', why: '' },
        ],
      }),
      text,
      prompt.values,
    )
    expect(fixes).toEqual([
      { find: '500,000,000원으로 검토후', fix: '500,000,000원으로 검토 후', why: '띄어쓰기' },
    ])
  })

  it('translates with the numbers put back', () => {
    const prompt = buildTranslatePrompt(
      '총예산은 5억 원, 마감은 2026-11-03입니다.',
      'en',
      'business',
    )
    expect(prompt.system).toContain('영어')
    expect(prompt.user).not.toMatch(/2026-11-03|5억/)
    const content = JSON.stringify({ translation: 'The budget is {값1}, due {값2}.' })
    expect(parseTranslation(content, prompt.values)).toBe('The budget is 5억 원, due 2026-11-03.')
    expect(parseTranslation('{}', prompt.values)).toBeNull()
  })
})
