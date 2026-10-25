import { describe, expect, it } from 'vitest'
import { cheilBlankForLabel, cheilBlankOf, findCheilTemplateBlanks } from '../src/cheil-my-template'

/** what file-parse gives for an old brief: table rows as "a | b", lines as "label: value" */
const OLD_BRIEF = [
  '크리에이티브 브리프',
  '광고주 | 블루윈드',
  '브랜드·제품 | 오로라7',
  '캠페인명 | 오로라7 여름 캠페인',
  '캠페인 기간 | 2026-06-01 ~ 2026-08-31',
  '총예산 | 300,000,000원',
  '작성 | 홍길동 · 비즈니스13팀',
  '작성일 · 판 | 2026-03-02 · v2',
  '# 1. 과제',
  '- 오로라7 여름 캠페인으로 20대 인지도를 높인다',
  '- 목표 KPI: 브랜드 인지도 25%',
  '# 9. 산출물과 일정',
  '산출물 | 규격·길이 | 매체 | 마감',
  'TV 광고 | 30초 | 지상파 | 2026년 5월 20일',
  '디지털 영상 | 15초 | 유튜브 | 5월 25일',
  '제작비는 4,500만원, 전환율 목표 3.5%p 상승',
].join('\n')

describe('Cheil fork: my template, step ① (plan item 13)', () => {
  it('maps labels and their aliases to the common blanks', () => {
    expect(cheilBlankForLabel('광고주')).toBe('[광고주]')
    expect(cheilBlankForLabel('- 목표 KPI:')).toBe('[KPI]')
    expect(cheilBlankForLabel('클라이언트')).toBe('[광고주]')
    expect(cheilBlankForLabel('캠페인 기간')).toBe('[캠페인 기간]')
    expect(cheilBlankForLabel('작성일')).toBe('[작성일]')
    expect(cheilBlankForLabel('산출물')).toBeNull()
  })

  it('finds labelled values first, then amounts, rates and dates, with where they repeat', () => {
    const found = findCheilTemplateBlanks(OLD_BRIEF)
    expect(found.filter((c) => c.kind === 'field')).toEqual([
      { find: '블루윈드', blank: '[광고주]', kind: 'field', count: 1 },
      // its two places inside the campaign name go with the longer value
      { find: '오로라7', blank: '[브랜드·제품]', kind: 'field', count: 1 },
      { find: '오로라7 여름 캠페인', blank: '[캠페인명]', kind: 'field', count: 2 },
      { find: '2026-06-01 ~ 2026-08-31', blank: '[캠페인 기간]', kind: 'field', count: 1 },
      { find: '300,000,000원', blank: '[총예산]', kind: 'field', count: 1 },
      { find: '홍길동', blank: '[작성자]', kind: 'field', count: 1 },
      { find: '비즈니스13팀', blank: '[팀명]', kind: 'field', count: 1 },
      { find: '2026-03-02', blank: '[작성일]', kind: 'field', count: 1 },
      { find: '브랜드 인지도 25%', blank: '[KPI]', kind: 'field', count: 1 },
    ])
    const rest = found.filter((c) => c.kind !== 'field').map((c) => [c.find, c.blank])
    expect(rest).toEqual([
      ['2026년 5월 20일', '[날짜]'],
      ['5월 25일', '[날짜]'],
      ['4,500만원', '[금액]'],
      ['3.5%p', '[수치]'],
    ])
    // a number inside a labelled value is not offered again
    expect(found.some((c) => c.find === '25%' || c.find === '2026-06-01')).toBe(false)
  })

  it('leaves a template that is already blank alone', () => {
    expect(findCheilTemplateBlanks('광고주 | [광고주]\n- 목표 KPI: [KPI]')).toEqual([])
  })

  it('turns a typed name into a blank', () => {
    expect(cheilBlankOf('예산 규모')).toBe('[예산 규모]')
    expect(cheilBlankOf('[핵심 메시지]')).toBe('[핵심 메시지]')
    expect(cheilBlankOf('  ')).toBeNull()
  })
})
