/** Cheil fork: sample-table boundaries, privacy defaults and explainable response handling. */
import { describe, expect, it } from 'vitest'
import {
  buildFormulaTable,
  cellAddress,
  columnName,
  parseTablePaste,
  pasteFormulaTable,
} from '../src/renderer/src/cheil/tools/formula-table'
import {
  buildFormulaPrompt,
  formulaDifference,
  parseFormulaReply,
  type FormulaInput,
} from '../src/renderer/src/cheil/tools/formula-tools'
import {
  findFormulaFunctions,
  FORMULA_FUNCTIONS,
  functionSupported,
} from '../src/renderer/src/cheil/tools/formula-dictionary'
const base: FormulaInput = {
  mode: 'data',
  version: '2019',
  request: '합계를 구해 주세요.',
  formula: '',
  context: '',
  error: '',
  language: 'ko',
}
const grid = [
  ['담당', '금액'],
  ['가상 A', '987654321'],
]
const reply = {
  formula: '=SUM(B2:B5)',
  explanation: '범위의 합계를 구합니다.',
  steps: ['합산'],
  notes: [],
  compatibility: 'Excel 2016 이상',
  questions: [],
  alternatives: [
    {
      label: '개별 셀',
      formula: '=B2+B3+B4+B5',
      when: '셀을 따로 지정할 때',
      tradeoff: '범위 확장에 취약',
      compatibility: 'Excel 2016 이상',
    },
  ],
  parts: [
    { expression: 'B2:B5', meaning: '합산 범위' },
    { expression: 'C1', meaning: '수식에 없는 부분' },
  ],
  changes: [],
}

describe('formula sample tables', () => {
  it('does not serialize sample values by default, including when headers are off', () => {
    const table = buildFormulaTable(grid, 'C5', 'F6', true, false)!
    expect(table.range).toBe('C5:D6')
    expect(table.dataStartRow).toBe(6)
    expect(table.columns).toEqual([
      { column: 'C', header: '담당' },
      { column: 'D', header: '금액' },
    ])
    const prompt = buildFormulaPrompt({ ...base, table })
    expect(prompt.user).not.toContain('987654321')
    expect(prompt.user).not.toContain('가상 A')
    expect(JSON.parse(prompt.user).sampleTable.sampleRows).toBeUndefined()
    const noHeaders = buildFormulaTable(grid, 'A1', 'D2', false, false)!
    expect(JSON.stringify(noHeaders)).not.toContain('담당')
    expect(noHeaders.dataRowCount).toBe(2)
  })
  it('includes exact sample values only when opted in', () => {
    const table = buildFormulaTable(grid, '$c$5', 'f6', true, true)!
    expect(table.sampleRows).toEqual([['가상 A', '987654321']])
    expect(table.target).toBe('F6')
    expect(JSON.parse(buildFormulaPrompt({ ...base, table }).user).sampleTable.valuesIncluded).toBe(
      true,
    )
  })
  it('validates Excel limits, rectangles and cell lengths', () => {
    for (const address of ['A0', 'A01', 'XFE1', 'A1048577', 'Sheet1!A1', 'A1:A2'])
      expect(cellAddress(address)).toBeNull()
    expect(cellAddress('XFD1048576')?.column).toBe(16384)
    expect(columnName(27)).toBe('AA')
    expect(buildFormulaTable(grid, 'XFD1', 'D2', true, false)).toBeNull()
    expect(buildFormulaTable(grid, 'A1048576', 'D2', true, false)).toBeNull()
    expect(buildFormulaTable([['a'], []], 'A1', 'D2', true, false)).toBeNull()
    expect(buildFormulaTable([['a'.repeat(257)]], 'A1', 'D2', false, false)).toBeNull()
  })
  it('reads quoted TSV and rejects malformed or oversized pastes', () => {
    expect(parseTablePaste('A\tB\r\n"first\nsecond"\t"a""b"\r\n')).toEqual([
      ['A', 'B'],
      ['first\nsecond', 'a"b'],
    ])
    expect(parseTablePaste('"unclosed')).toBeNull()
    expect(parseTablePaste(Array(22).fill('x').join('\n'))).toBeNull()
    expect(parseTablePaste('x'.repeat(257))).toBeNull()
    expect(pasteFormulaTable([['old']], 'a\tb\nc\td', 1, 1)).toEqual([
      ['old', '', ''],
      ['', 'a', 'b'],
      ['', 'c', 'd'],
    ])
    expect(pasteFormulaTable([['old']], 'a\tb', 0, 7)).toBeNull()
  })
})
describe('formula explanations and choices', () => {
  it('carries clarification history with the exact original request', () => {
    const clarifications = [{ question: '금액 열은?', answer: 'B열' }]
    const prompt = buildFormulaPrompt({ ...base, clarifications })
    expect(JSON.parse(prompt.user).clarifications).toEqual(clarifications)
    expect(prompt.system).toContain('do not repeat answered questions')
    expect(prompt.system).toContain('Do not use XLOOKUP')
    expect(buildFormulaPrompt({ ...base, version: '2016' }).system).toContain(
      'Do not recommend IFS',
    )
  })
  it('keeps valid alternatives and only exact formula fragments', () => {
    const parsed = parseFormulaReply(JSON.stringify(reply), 'data')!
    expect(parsed.alternatives[0]?.formula).toBe('=B2+B3+B4+B5')
    expect(parsed.parts).toEqual([{ expression: 'B2:B5', meaning: '합산 범위' }])
    expect(
      parseFormulaReply(
        JSON.stringify({
          ...reply,
          alternatives: [{ ...reply.alternatives[0], formula: 'not a formula' }],
        }),
        'create',
      ),
    ).toBeNull()
    expect(
      parseFormulaReply(JSON.stringify({ ...reply, changes: [{ what: 42 }] }), 'fix'),
    ).toBeNull()
  })
  it('accepts formatted multiline formulas without interpreting or executing them', () => {
    const formula = '=IF(A2="",\n"",SUM(B2:B5))'
    expect(parseFormulaReply(JSON.stringify({ ...reply, formula }), 'fix')?.formula).toBe(formula)
  })
  it('computes exact before/after spans for insertions, removals and identical text', () => {
    const difference = formulaDifference('=SUM(A2,A3,A4)', '=SUM(A2:A4)')
    for (const [name, text] of [
      ['before', '=SUM(A2,A3,A4)'],
      ['after', '=SUM(A2:A4)'],
    ] as const) {
      const part = difference[name]
      expect(part.prefix + part.changed + part.suffix).toBe(text)
    }
    expect(formulaDifference('=A2', '=A2').identical).toBe(true)
    expect(formulaDifference('=A2', '=A2*2').after.changed).toBe('*2')
  })
})
describe('local formula dictionary', () => {
  it('finds functions by task and category with correct offered-version boundaries', () => {
    expect(new Set(FORMULA_FUNCTIONS.map((f) => f.name)).size).toBe(FORMULA_FUNCTIONS.length)
    expect(findFormulaFunctions('조건 합계', 'aggregate').map((f) => f.name)).toContain('SUMIFS')
    expect(findFormulaFunctions('공백', 'lookup')).toHaveLength(0)
    const xlookup = FORMULA_FUNCTIONS.find((f) => f.name === 'XLOOKUP')!
    expect(functionSupported(xlookup, '2019')).toBe(false)
    expect(functionSupported(xlookup, '2021')).toBe(true)
    const join = FORMULA_FUNCTIONS.find((f) => f.name === 'TEXTJOIN')!
    expect(functionSupported(join, '2016')).toBe(false)
    expect(functionSupported(join, '2019')).toBe(true)
  })
})
