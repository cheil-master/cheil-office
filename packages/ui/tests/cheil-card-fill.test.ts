import { describe, expect, it } from 'vitest'
import { findCheilSlots } from '../src/cheil-fill'
import {
  CHEIL_FIELDS,
  cheilCardChangeNote,
  cheilCardChanges,
  cheilCardFillNote,
  cheilCardFillOf,
  cheilChangeCounts,
  cheilPropagatePairs,
  cheilReplaceText,
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

describe('Cheil fork: a card change carried to the open documents', () => {
  it('lists the fields whose value changed, with what to look for', () => {
    const { changes, cleared } = cheilCardChanges(
      CARD,
      { ...CARD, budget: '600000000', team: '', kpi: CARD.kpi, author: '홍길동' },
      '2026-10-26',
    )
    expect(changes).toEqual([
      { label: '총예산', from: '500,000,000원', to: '600,000,000원', finds: ['500,000,000원'] },
      // the card had no author: the blank (and its aliases) is what the documents hold
      {
        label: '작성자',
        from: '',
        to: '홍길동',
        finds: ['[작성자]', '[작성자 이름]', '[담당자]'],
      },
    ])
    // an emptied field is not deleted from the documents
    expect(cleared).toEqual(['팀명'])
    // the day a document is made is never carried
    expect(cheilCardChanges(CARD, CARD, '2027-01-01').changes).toEqual([])
  })

  it('flattens the changes into pairs and adds a tab’s counts back up per field', () => {
    const { changes } = cheilCardChanges(CARD, { ...CARD, budget: '6억 원', author: '홍길동' }, 'x')
    const pairs = cheilPropagatePairs(changes)
    expect(pairs.map((p) => p.find)).toEqual([
      '500,000,000원',
      '[작성자]',
      '[작성자 이름]',
      '[담당자]',
    ])
    expect(cheilChangeCounts(pairs, [2, 1, 0, 1])).toEqual([
      { label: '총예산', from: '500,000,000원', to: '6억 원', count: 2 },
      { label: '작성자', from: '', to: '홍길동', count: 2 },
    ])
    // a missing or bad count reads as none
    expect(cheilChangeCounts(pairs, [-1]).map((i) => i.count)).toEqual([0, 0])
    expect(cheilCardChangeNote('ko', cheilChangeCounts(pairs, [2, 0, 0, 0]))).toBe(
      '캠페인 카드가 바뀌어 이 문서를 고쳤습니다(AI 없이): 총예산 500,000,000원 → 6억 원 (2곳)',
    )
    expect(cheilCardChangeNote('ko', cheilChangeCounts(pairs, []))).toContain(
      '바꿀 곳이 없었습니다',
    )
  })
})

describe('Cheil fork: replacing card values in a text', () => {
  it('replaces every place, the longer text winning where two overlap', () => {
    const text = '에어린 봄 런칭 — 에어린 공기청정기, 에어린 봄 런칭 예산 500,000,000원'
    const { text: out, counts } = cheilReplaceText(text, [
      { find: '에어린', replace: '에어린2' },
      { find: '에어린 봄 런칭', replace: '에어린 여름 런칭' },
      { find: '500,000,000원', replace: '600,000,000원' },
      { find: '없는 글', replace: 'x' },
    ])
    expect(out).toBe('에어린 여름 런칭 — 에어린2 공기청정기, 에어린 여름 런칭 예산 600,000,000원')
    expect(counts).toEqual([1, 2, 1, 0])
  })
})
