/**
 * Cheil fork (plan item 13 ②): the deck operations a plan turns into, run on
 * the real proposal template through the deck's own transactions, in the
 * order the panel sends them. A sample used twice, most skipped and the last
 * one used: the new deck has those slides, in that order, each filled on its
 * own slide, and the samples are gone.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openPptx } from '@genoffice/pptx-engine'
import { runTxn } from '@genoffice/pptx-ops'
import { cheilDeckOps } from '../../../packages/ui/src/cheil-deck-plan'

const PROPOSAL = resolve(
  __dirname,
  '../../shell/resources/builtin-skills/cheil-proposal/assets/캠페인 제안서.pptx',
)

const textOf = (slide: { elements: unknown[] }) => {
  const out: string[] = []
  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (key === 'text') out.push(value)
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, key)
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k)
    }
  }
  walk(slide.elements, '')
  return out.join('')
}

describe('Cheil fork: a deck from my template’s samples, on the real deck', () => {
  it('copies, moves and fills in order, then removes the samples', async () => {
    const opened = await openPptx(readFileSync(PROPOSAL))
    const samples = opened.deck.slides.length
    expect(samples).toBe(12)
    const batches = cheilDeckOps(
      [
        { sample: 1, fill: { '[캠페인명]': '오로라7 여름' } },
        { sample: 3, fill: { '[광고주가 풀려는 사업 문제]': '점유율' } },
        { sample: 3, fill: { '[광고주가 풀려는 사업 문제]': '첫 구매' } },
        { sample: 12, fill: { '[팀명]': '비즈니스13팀' } },
      ],
      samples,
    )
    for (const ops of batches) {
      const result = runTxn(opened, { ops: ops as never, isolation: 'per_op' })
      expect(result.failures ?? []).toEqual([])
    }
    const made = opened.deck.slides.map(textOf)
    expect(made).toHaveLength(4)
    expect(made[0]).toContain('오로라7 여름')
    expect(made[1]).toContain('점유율')
    expect(made[2]).toContain('첫 구매')
    expect(made[2]).not.toContain('점유율')
    expect(made[3]).toContain('감사합니다')
    expect(made[3]).toContain('비즈니스13팀')
  })
})
