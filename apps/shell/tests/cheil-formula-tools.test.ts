/** Cheil fork: preserve formula syntax and require structured, honest AI answers. */
import { describe, expect, it } from 'vitest'
import {
  buildFormulaPrompt,
  parseFormulaReply,
  type FormulaInput,
} from '../src/renderer/src/cheil/tools/formula-tools'

const input: FormulaInput = {
  mode: 'create',
  version: '365',
  request: '금액 합계',
  formula: '',
  context: "'원본 자료'!$C$2:$C$100, 조건 >=1000, 날짜 2026-10-27",
  error: '',
  language: 'ko',
}
const reply = {
  formula: '=SUM(C2:C100)',
  explanation: '금액을 더합니다.',
  steps: ['C2:C100 합산'],
  notes: ['숫자로 저장된 값인지 확인'],
  compatibility: 'Excel 2016 이상',
  questions: [],
}

describe('Cheil formula assistant', () => {
  it('keeps references, constants and dates intact in task data', () => {
    const prompt = buildFormulaPrompt(input)
    expect(JSON.parse(prompt.user).dataLayoutAndExpectedResult).toBe(input.context)
    expect(prompt.system).toContain('Never claim to have executed')
    expect(prompt.system).toContain('Korean')
  })
  it('constrains old Excel functions and selects the requested operation', () => {
    const prompt = buildFormulaPrompt({
      ...input,
      mode: 'fix',
      version: '2016',
      language: 'en',
      formula: '=XLOOKUP(D2,A:A,B:B)',
      error: '#NAME?',
    })
    expect(prompt.system).toContain('Diagnose')
    expect(prompt.system).toContain('Do not use XLOOKUP')
    expect(prompt.system).toContain('English')
    expect(JSON.parse(prompt.user).formula).toBe('=XLOOKUP(D2,A:A,B:B)')
    expect(buildFormulaPrompt({ ...input, version: '2021' }).system).toContain(
      'Do not assume Microsoft 365-only',
    )
  })
  it('reads a fenced answer without changing the formula', () => {
    expect(parseFormulaReply('```json\n' + JSON.stringify(reply) + '\n```', 'create')).toEqual({
      ...reply,
      alternatives: [],
      parts: [],
      changes: [],
    })
  })
  it('accepts missing information rather than inventing a formula', () => {
    const answer = { ...reply, formula: '', questions: ['금액이 어느 열에 있나요?'] }
    expect(parseFormulaReply(JSON.stringify(answer), 'create')?.questions).toEqual(answer.questions)
    expect(parseFormulaReply(JSON.stringify({ ...reply, formula: '' }), 'create')).toBeNull()
  })
  it('rejects prose, malformed structures and truncated formulas', () => {
    for (const text of [
      'not json',
      '[]',
      '{"formula":"=SUM(A:A)"}',
      JSON.stringify({ ...reply, formula: 'SUM(A:A)' }),
      JSON.stringify({ ...reply, steps: 'text' }),
      JSON.stringify({ ...reply, formula: '=' }),
      JSON.stringify({ ...reply, formula: '=' + 'A'.repeat(8000) }),
    ]) {
      expect(parseFormulaReply(text, 'fix')).toBeNull()
    }
  })
  it('allows a prose explanation with no replacement formula', () => {
    expect(
      parseFormulaReply(JSON.stringify({ ...reply, formula: '' }), 'explain')?.explanation,
    ).toBe(reply.explanation)
  })
})
