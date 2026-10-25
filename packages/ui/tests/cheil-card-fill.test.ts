import { describe, expect, it } from 'vitest'
import { findCheilSlots } from '../src/cheil-fill'
import {
  CHEIL_FIELDS,
  cheilCardFillNote,
  cheilCardFillOf,
  cheilCardReplacements,
  cheilCardSummary,
  cheilFieldValues,
} from '../src/cheil-fields'
import { cheilCardSheetWrites, type SheetSnapshot } from '../src/cheil-sheet-fill'

const CARD = {
  campaign: '에어린 봄 런칭',
  client: '가상전자',
  brand: '에어린',
  start: '2027-03-01',
  end: '2027-04-30',
  budget: '500000000',
  target: '25~34세 1인 가구 직장인',
  kpi: '브랜드 인지도 30%',
  team: '비즈니스13팀',
  author: '',
}
const values = Object.fromEntries(cheilFieldValues(CARD, '2026-10-25'))

describe('Cheil fork: a document set filled from a campaign card', () => {
  it('replaces the common blanks it has values for, by name or alias, and nothing else', () => {
    const doc = [
      '캠페인명 [캠페인명]',
      '광고주 [광고주명]',
      '작성 [작성자] · [팀명]',
      '[이 광고로 해결할 문제 한 문장]',
      '목표 KPI: [KPI]',
      '다시 [캠페인명]',
    ].join('\n')
    const pairs = cheilCardReplacements(
      findCheilSlots(doc).map((s) => s.placeholder),
      values,
    )
    expect(pairs).toEqual([
      { find: '[캠페인명]', replace: '에어린 봄 런칭' },
      { find: '[광고주명]', replace: '가상전자' },
      { find: '[팀명]', replace: '비즈니스13팀' },
      { find: '[KPI]', replace: '브랜드 인지도 30%' },
    ])
  })

  it('reads a hand-off defensively', () => {
    expect(cheilCardFillOf({ campaign: 'C', values: { '[광고주]': '가상전자' } })).toEqual({
      campaign: 'C',
      values: { '[광고주]': '가상전자' },
    })
    expect(
      cheilCardFillOf({
        campaign: 'C',
        values: { '[광고주]': 5, 'not a blank': 'x', '[총예산]': '  ', '[팀명]': '팀' },
      }),
    ).toEqual({ campaign: 'C', values: { '[팀명]': '팀' } })
    expect(cheilCardFillOf(null)).toBeNull()
    expect(cheilCardFillOf({ values: {} })).toBeNull()
    expect(cheilCardFillOf({ campaign: 'C', values: 'x' })).toBeNull()
  })

  it('writes the card as request lines, leaving empty fields out', () => {
    const text = cheilCardSummary(CARD)
    expect(text.split('\n')[0]).toBe('[캠페인 카드]')
    expect(text).toContain('광고주: 가상전자')
    expect(text).toContain('캠페인 기간: 2027-03-01 ~ 2027-04-30')
    expect(text).toContain('총예산: 500,000,000원')
    expect(text).not.toContain('작성자')
    expect(cheilCardSummary({})).toBe('')
  })

  it('says what it filled', () => {
    expect(cheilCardFillNote('ko', { campaign: '에어린 봄 런칭', filled: 9 })).toContain(
      "캠페인 '에어린 봄 런칭' 카드로 공통 칸 9개를 채웠습니다(AI 없이)",
    )
    expect(cheilCardFillNote('en', { campaign: 'X', filled: 0 })).toContain('no values')
  })

  it('rewrites workbook cells holding common blanks, leaving tables and other blanks', () => {
    const sheets: SheetSnapshot[] = [
      {
        id: 's1',
        name: '미디어 플랜',
        cells: {
          A1: { value: '[광고주] [캠페인명] 미디어 플랜' },
          A2: { value: '작성 [작성일] · [팀명] · 캠페인 기간 [캠페인 기간] · 총예산 [총예산]' },
          A3: { value: '메모 [자료 메모]' },
          A4: { value: '매체' },
          B4: { value: '상품·지면' },
          C4: { value: '예산(원)' },
          A5: { value: '[매체]' },
          A8: { value: '합계' },
        },
      },
    ]
    const { writes, filled } = cheilCardSheetWrites(sheets, values)
    expect(filled).toBe(6)
    expect(writes).toEqual([
      { sheetId: 's1', address: 'A1', value: '가상전자 에어린 봄 런칭 미디어 플랜' },
      {
        sheetId: 's1',
        address: 'A2',
        value:
          '작성 2026-10-25 · 비즈니스13팀 · 캠페인 기간 2027-03-01 ~ 2027-04-30 · 총예산 500,000,000원',
      },
    ])
  })

  it('covers every common blank of every field the card fills', () => {
    // a full card gives a value for every common field
    const full = Object.fromEntries(cheilFieldValues({ ...CARD, author: '챔프리' }, '2026-10-25'))
    expect(Object.keys(full).sort()).toEqual(CHEIL_FIELDS.map((f) => f.placeholder).sort())
  })
})
