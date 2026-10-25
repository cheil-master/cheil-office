import { describe, expect, it } from 'vitest'
import {
  CHEIL_MAIL_SITUATIONS,
  buildCheilMailPrompt,
  maskCheilValues,
  parseCheilMailDraft,
  suggestCheilMailSituation,
  type CheilMailFact,
} from '../src/cheil-mail-draft'
import { gradeOutbound } from '../../ai-provider/src/cheil-grade'

const FACTS: CheilMailFact[] = [
  { name: '캠페인명', label: '캠페인 이름', value: '에어린 봄 런칭' },
  { name: '광고주', label: '광고주 회사', value: '가상전자' },
  { name: '총예산', label: '총예산', value: '600,000,000원' },
  { name: 'KPI', label: '목표 지표', value: '브랜드 인지도 30%' },
  { name: '팀명', label: '보내는 팀', value: '비즈니스13팀' },
  { name: '작성자', label: '보내는 사람', value: '홍길동' },
  { name: '받는분', label: '받는 사람', value: '' },
]
const HISTORY = [
  '카드 수정: 총예산 500,000,000원 → 600,000,000원',
  '크리에이티브 브리프: 캠페인 카드로 공통 칸 10개를 채움',
  '시안 2안 송부 (담당 기획 3팀) 마감 2026-11-03',
]

describe('Cheil fork: mail drafts (plan items 6, 7)', () => {
  it('turns every number and date into a name, the same value keeping one name', () => {
    const values = new Map<string, string>()
    expect(maskCheilValues('예산 500,000,000원, 인지도 30%. 마감 2026-11-03.', values)).toBe(
      '예산 {값1}, 인지도 {값2}. 마감 {값3}.',
    )
    expect(maskCheilValues('다시 500,000,000원', values)).toBe('다시 {값1}')
    expect(values.get('값3')).toBe('2026-11-03')
  })

  it('sends the tone and the fact names, never the facts or the numbers', () => {
    const prompt = buildCheilMailPrompt({
      situation: 'send',
      audience: 'client',
      strength: 'firm',
      facts: FACTS,
      history: HISTORY,
      points: '수정안은 11월 5일까지 회신 부탁. 예산은 6억 원으로 확정.',
    })
    expect(prompt.system).toContain('자료 송부')
    expect(prompt.system).toContain('합니다체')
    expect(prompt.system).toContain('단호하게')
    const sent = prompt.system + prompt.user
    for (const secret of [
      '600,000,000원',
      '500,000,000원',
      '30%',
      '2026-11-03',
      '6억',
      '가상전자',
      '홍길동',
    ]) {
      expect(sent).not.toContain(secret)
    }
    expect(prompt.user).toContain('{총예산}: 총예산')
    // an empty fact is not offered
    expect(prompt.user).not.toContain('{받는분}')
    // what leaves this PC passes the confidentiality line
    const verdict = gradeOutbound([prompt.user])
    expect(verdict.rule).toBeLessThan(2)
    expect(verdict.pii).toBe(false)
  })

  it('the same request with the numbers in it would have been refused', () => {
    const raw = [...HISTORY, '브리프 KPI 인지도 30%, 물량 3,000개, 예산 6억 원'].join('\n')
    expect(gradeOutbound([raw]).rule).toBeGreaterThanOrEqual(2)
  })

  it('puts the values back, and marks a name the model made up', () => {
    const prompt = buildCheilMailPrompt({
      situation: 'revision',
      audience: 'internal',
      strength: 'normal',
      facts: FACTS,
      history: HISTORY,
      points: '',
    })
    const draft = parseCheilMailDraft(
      'here: ' +
        JSON.stringify({
          subject: '[{캠페인명}] 예산 { 총예산 } 반영',
          body: '- 예산: {값1} → {값2}\n- 미팅: {미팅일}\n{작성자}',
        }),
      prompt.values,
    )
    expect(draft).toEqual({
      subject: '[에어린 봄 런칭] 예산 600,000,000원 반영',
      body: '- 예산: 500,000,000원 → 600,000,000원\n- 미팅: [확인 필요]\n홍길동',
      unknown: 1,
    })
    expect(parseCheilMailDraft('not json', prompt.values)).toBeNull()
    expect(parseCheilMailDraft('{"subject":"x"}', prompt.values)).toBeNull()
  })

  it('suggests a situation from what happened last', () => {
    expect(suggestCheilMailSituation('fill')).toBe('send')
    expect(suggestCheilMailSituation('task')).toBe('schedule')
    expect(suggestCheilMailSituation('card')).toBe('revision')
    expect(suggestCheilMailSituation(undefined)).toBe('send')
    expect(CHEIL_MAIL_SITUATIONS).toHaveLength(6)
  })
})
