import { describe, expect, it } from 'vitest'
import {
  buildCheilFillPrompt,
  cheilFillPlan,
  cheilFillSkillOf,
  cheilFillSummary,
  findCheilSlots,
  parseCheilFillAnswer,
} from '../src/cheil-fill'

const DOC = [
  '크리에이티브 브리프',
  '광고주',
  '[광고주]',
  '캠페인명',
  '[캠페인명]',
  '1. 과제',
  '[이 광고로 해결할 문제 한 문장]',
  '2. 배경',
  '[시장·브랜드 상황 2~3줄, 숫자는 출처와 함께]',
  '참고 [광고주] 다시 나옴',
  '이미 [확인 필요] 표시',
  '빈 칸 [ ]',
].join('\n')

describe('Cheil fork: template fill', () => {
  it('knows the Cheil template chips only', () => {
    expect(cheilFillSkillOf([{ id: 'builtin:cheil-brief' }])).toBe('cheil-brief')
    expect(cheilFillSkillOf([{ id: 'builtin:cheil-house-rules' }])).toBeNull()
    expect(cheilFillSkillOf([{ id: 'app:cheil-brief' }])).toBeNull()
    expect(cheilFillSkillOf([{ id: 'builtin:meeting-minutes' }])).toBeNull()
  })

  it('lists each blank once, in order, with its context, and skips markers and empty brackets', () => {
    const slots = findCheilSlots(DOC)
    expect(slots.map((s) => s.placeholder)).toEqual([
      '[광고주]',
      '[캠페인명]',
      '[이 광고로 해결할 문제 한 문장]',
      '[시장·브랜드 상황 2~3줄, 숫자는 출처와 함께]',
    ])
    expect(slots.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4'])
    expect(slots[0]!.context).toBe('광고주 / [광고주]')
    expect(slots[2]!.context).toBe('1. 과제 / [이 광고로 해결할 문제 한 문장]')
  })

  it('asks for one JSON object keyed by slot, with the rules and the material', () => {
    const slots = findCheilSlots(DOC)
    const { system, user } = buildCheilFillPrompt({
      request: '아래 메모로 채워 줘',
      skillText: '# 브리프 설명서',
      materials: '가상전자 에어린 공기청정기',
      slots,
    })
    expect(system).toContain('지어내지 않는다')
    expect(system).toContain('# 브리프 설명서')
    expect(user).toContain('가상전자 에어린 공기청정기')
    expect(user).toContain('S3: [이 광고로 해결할 문제 한 문장] — 문맥: 1. 과제')
    expect(user).toContain('4개 칸 번호를 모두 키로')
  })

  it('reads the answer, fenced or not, keeps known slots, flattens lines and lists', () => {
    const slots = findCheilSlots(DOC)
    const values = parseCheilFillAnswer(
      '```json\n{"S1": "가상전자", "S2": ["에어린", "봄"], "S3": "2030 1인 가구 인지도 상승\\n(봄 시즌)", "S4": "[확인 필요]", "S9": "x"}\n```',
      slots,
    )
    expect(values.get('S1')).toBe('가상전자')
    expect(values.get('S2')).toBe('에어린, 봄')
    expect(values.get('S3')).toBe('2030 1인 가구 인지도 상승 (봄 시즌)')
    expect(values.get('S4')).toBe('[확인 필요]')
    expect(values.has('S9')).toBe(false)
    expect(parseCheilFillAnswer('not json', slots).size).toBe(0)
  })

  it('plans the replacements and says what is left for a person', () => {
    const slots = findCheilSlots(DOC)
    const plan = cheilFillPlan(
      slots,
      new Map([
        ['S1', '가상전자'],
        ['S3', '인지도 상승'],
        ['S4', '[확인 필요]'],
      ]),
    )
    expect(plan.replacements).toEqual([
      { find: '[광고주]', replace: '가상전자' },
      { find: '[이 광고로 해결할 문제 한 문장]', replace: '인지도 상승' },
      { find: '[시장·브랜드 상황 2~3줄, 숫자는 출처와 함께]', replace: '[확인 필요]' },
    ])
    expect(plan.fromMaterial).toBe(2)
    expect(plan.open).toEqual(['[캠페인명]', '[시장·브랜드 상황 2~3줄, 숫자는 출처와 함께]'])
    const text = cheilFillSummary('ko', { total: 4, fromMaterial: 2, open: plan.open })
    expect(text).toContain('양식 칸 4개 중 2개를 자료로 채웠습니다.')
    expect(text).toContain('[확인 필요]로 둔 칸 2개: [캠페인명]')
  })
})
