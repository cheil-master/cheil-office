import { describe, expect, it } from 'vitest'
import {
  buildCheilSheetFillPrompt,
  cheilCellValue,
  cheilSheetWrites,
  excelDateSerial,
  findCheilSheetBlanks,
  type SheetSnapshot,
} from '../src/cheil-sheet-fill'

/** The media plan template as the sheets editor reads it (tools/cheil/make_templates.py) */
function mediaPlan(): SheetSnapshot[] {
  const plan: SheetSnapshot['cells'] = {
    A1: { value: '[광고주명] [캠페인명] 미디어 플랜' },
    A2: {
      value: "작성 [날짜] · [팀명] · 숫자는 매체 견적·합의 자료 기준(출처는 '가정·출처' 시트)",
    },
    A15: { value: '합계' },
    A17: { value: '회색 칸은 계산식. 예산·노출·클릭만 넣는다.' },
    A5: { value: '[매체]' },
    B5: { value: '[상품·지면]' },
  }
  const headers = ['매체', '상품·지면', '시작일', '종료일', '예산(원)', '예상 노출', '예상 클릭']
  headers.push('CPM(원)', 'CPC(원)', 'CTR', '예산 비중', '비고')
  'ABCDEFGHIJKL'.split('').forEach((letter, i) => {
    plan[`${letter}4`] = { value: headers[i]! }
  })
  for (let row = 5; row <= 15; row++) {
    for (const letter of 'HIJK')
      plan[`${letter}${row}`] = { value: '', formula: `=IF(E${row}="","",1)` }
  }
  for (const letter of 'EFG')
    plan[`${letter}15`] = { value: 0, formula: `=SUM(${letter}5:${letter}14)` }
  const sources: SheetSnapshot['cells'] = {
    A1: { value: '가정·출처' },
    A3: { value: '항목' },
    B3: { value: '값·가정' },
    C3: { value: '출처(자료명·날짜)' },
    A4: { value: '[예: 매체 견적]' },
  }
  return [
    { id: 'sheet-1', name: '미디어 플랜', cells: plan },
    { id: 'sheet-2', name: '가정·출처', cells: sources },
  ]
}

describe('Cheil fork: workbook template fill', () => {
  it('finds the placeholders and the input tables, leaving formula columns alone', () => {
    const plan = findCheilSheetBlanks(mediaPlan())
    expect(plan.slots.map((s) => [s.placeholder, s.address])).toEqual([
      ['[광고주명]', 'A1'],
      ['[캠페인명]', 'A1'],
      ['[날짜]', 'A2'],
      ['[팀명]', 'A2'],
    ])
    expect(plan.tables).toHaveLength(2)
    const [media, sources] = plan.tables
    expect(media).toMatchObject({ id: 'T1', sheetId: 'sheet-1', headerRow: 4 })
    expect(media!.rows).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(media!.columns.map((c) => c.header)).toEqual([
      '매체',
      '상품·지면',
      '시작일',
      '종료일',
      '예산(원)',
      '예상 노출',
      '예상 클릭',
      '비고',
    ])
    expect(sources).toMatchObject({ id: 'T2', sheetId: 'sheet-2', headerRow: 3 })
    expect(sources!.columns.map((c) => c.letter)).toEqual(['A', 'B', 'C'])
  })

  it('asks for every slot and table by key', () => {
    const plan = findCheilSheetBlanks(mediaPlan())
    const { user } = buildCheilSheetFillPrompt({
      request: '견적으로 채워 줘',
      skillText: '# 미디어 플랜',
      materials: '유튜브 30,000,000원',
      plan,
    })
    expect(user).toContain("T1: '미디어 플랜' 시트 5~14행, 최대 10줄.")
    expect(user).toContain(
      '열: 매체, 상품·지면, 시작일, 종료일, 예산(원), 예상 노출, 예상 클릭, 비고',
    )
    expect(user.trim().split('\n').at(-1)).toBe(
      'JSON 객체 하나로만 답하라. 키: S1, S2, S3, S4, T1, T2.',
    )
  })

  it('turns figures into numbers and ISO dates into Excel dates', () => {
    expect(cheilCellValue('30,000,000')).toBe(30_000_000)
    expect(cheilCellValue('15,000,000원')).toBe(15_000_000)
    expect(cheilCellValue(6_000_000)).toBe(6_000_000)
    expect(cheilCellValue('2026-11-01')).toBe(excelDateSerial(2026, 11, 1))
    expect(excelDateSerial(1900, 3, 1)).toBe(61)
    expect(cheilCellValue('')).toBeNull()
    expect(cheilCellValue('인스트림')).toBe('인스트림')
  })

  it('writes the blanks into their cells and the rows into the input columns', () => {
    const sheets = mediaPlan()
    const plan = findCheilSheetBlanks(sheets)
    const answer = JSON.stringify({
      S1: '가상전자',
      S2: '에어린 봄 캠페인',
      S3: '2026-10-21',
      S4: '[확인 필요]',
      T1: [
        {
          매체: '유튜브',
          '상품·지면': '인스트림',
          시작일: '2026-11-01',
          종료일: '2026-11-30',
          '예산(원)': '30,000,000',
          '예상 노출': 6000000,
          '예상 클릭': 60000,
          비고: '',
        },
        { 매체: '네이버 GFA', '예산(원)': 10000000, '예상 클릭': '' },
      ],
      T2: [
        {
          항목: '매체 견적',
          '값·가정': '3개 매체',
          '출처(자료명·날짜)': '블루윈드미디어, 2026-10-21',
        },
      ],
    })
    const result = cheilSheetWrites(sheets, plan, answer)
    const at = (sheetId: string, address: string) =>
      result.writes.find((w) => w.sheetId === sheetId && w.address === address)?.value
    expect(at('sheet-1', 'A1')).toBe('가상전자 에어린 봄 캠페인 미디어 플랜')
    expect(at('sheet-1', 'A2')).toBe(
      "작성 2026-10-21 · [확인 필요] · 숫자는 매체 견적·합의 자료 기준(출처는 '가정·출처' 시트)",
    )
    expect(at('sheet-1', 'A5')).toBe('유튜브')
    expect(at('sheet-1', 'C5')).toBe(excelDateSerial(2026, 11, 1))
    expect(at('sheet-1', 'E5')).toBe(30_000_000)
    expect(at('sheet-1', 'A6')).toBe('네이버 GFA')
    expect(at('sheet-1', 'G6')).toBeUndefined()
    expect(at('sheet-1', 'H5')).toBeUndefined()
    expect(at('sheet-2', 'C4')).toBe('블루윈드미디어, 2026-10-21')
    expect(result.fromMaterial).toBe(3)
    expect(result.open).toEqual(['[팀명]'])
    expect(result.rowsWritten).toBe(3)
    expect(result.rowsByTable).toEqual([
      { sheetName: '미디어 플랜', rows: 2 },
      { sheetName: '가정·출처', rows: 1 },
    ])
  })

  it('writes nothing from an answer that is not JSON', () => {
    const sheets = mediaPlan()
    const result = cheilSheetWrites(sheets, findCheilSheetBlanks(sheets), '죄송합니다')
    expect(result.writes).toEqual([])
    expect(result.open).toHaveLength(4)
  })
})
