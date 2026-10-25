import { describe, expect, it } from 'vitest'
import {
  CHEIL_DECK_MAX,
  buildCheilDeckPrompt,
  cheilDeckOps,
  cheilDeckSamples,
  parseCheilDeckPlan,
} from '../src/cheil-deck-plan'

const SAMPLES = cheilDeckSamples([
  '[캠페인명]\n[광고주] 제안',
  '[슬라이드 제목]\n[본문 1]\n[본문 10]',
  '감사합니다\n[팀명]',
])

describe('Cheil fork: a deck from my template’s samples (plan item 13 ②)', () => {
  it('reads each sample’s blanks', () => {
    expect(SAMPLES.map((s) => s.blanks)).toEqual([
      ['[캠페인명]', '[광고주]'],
      ['[슬라이드 제목]', '[본문 1]', '[본문 10]'],
      ['[팀명]'],
    ])
  })

  it('asks for samples in order and only the words', () => {
    const prompt = buildCheilDeckPrompt({
      request: '오로라7 여름 제안서',
      skillText: '',
      materials: '자료 내용',
      samples: SAMPLES,
    })
    expect(prompt.system).toContain('견본 순서를 지킨다')
    expect(prompt.user).toContain('[견본 2]\n[슬라이드 제목]')
    expect(prompt.user).toContain('자료 내용')
  })

  it('keeps only known samples and their own blanks, up to the limit', () => {
    const plan = parseCheilDeckPlan(
      `answer: ${JSON.stringify({
        slides: [
          { sample: 1, fill: { '[캠페인명]': '오로라7 여름', '[다른 칸]': 'x' } },
          { sample: 2, fill: { '[슬라이드 제목]': '시장', '[본문 1]': '  성장  중 ' } },
          { sample: 2, fill: { '[슬라이드 제목]': '타깃' } },
          { sample: 9, fill: {} },
          { sample: 3, fill: { '[팀명]': 7 } },
        ],
      })}`,
      SAMPLES,
    )
    expect(plan).toEqual([
      { sample: 1, fill: { '[캠페인명]': '오로라7 여름' } },
      { sample: 2, fill: { '[슬라이드 제목]': '시장', '[본문 1]': '성장 중' } },
      { sample: 2, fill: { '[슬라이드 제목]': '타깃' } },
      { sample: 3, fill: {} },
    ])
    const long = { slides: Array.from({ length: 40 }, () => ({ sample: 2, fill: {} })) }
    expect(parseCheilDeckPlan(JSON.stringify(long), SAMPLES)).toHaveLength(CHEIL_DECK_MAX)
    expect(parseCheilDeckPlan('{"slides": []}', SAMPLES)).toBeNull()
    expect(parseCheilDeckPlan('nope', SAMPLES)).toBeNull()
  })

  it('copies samples to the end in order, fills each on its own slide, then removes the samples', () => {
    const ops = cheilDeckOps(
      [
        { sample: 1, fill: { '[캠페인명]': '오로라7 여름' } },
        { sample: 2, fill: { '[본문 1]': '가', '[본문 10]': '나' } },
        { sample: 2, fill: {} },
      ],
      3,
    )
    // a copy is made in one transaction and moved in the next
    expect(ops).toEqual([
      [{ op: 'duplicateSlide', target: { slide: 0 } }],
      [
        { op: 'moveSlide', target: { slide: 1 }, to: 3 },
        { op: 'findReplace', find: '[캠페인명]', replace: '오로라7 여름', slideIndex: 3 },
      ],
      [{ op: 'duplicateSlide', target: { slide: 1 } }],
      [
        { op: 'moveSlide', target: { slide: 2 }, to: 4 },
        { op: 'findReplace', find: '[본문 10]', replace: '나', slideIndex: 4 },
        { op: 'findReplace', find: '[본문 1]', replace: '가', slideIndex: 4 },
      ],
      [{ op: 'duplicateSlide', target: { slide: 1 } }],
      [{ op: 'moveSlide', target: { slide: 2 }, to: 5 }],
      [
        { op: 'deleteSlide', target: { slide: 2 } },
        { op: 'deleteSlide', target: { slide: 1 } },
        { op: 'deleteSlide', target: { slide: 0 } },
      ],
    ])
  })
})
