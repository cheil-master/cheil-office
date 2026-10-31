/** Cheil fork: semantic suggestions stay evidence-bound and require fresh consent. */
import { expect, it, vi } from 'vitest'
import { createWikiAnswers } from '../src/main/cheil/wiki-answer'
import { semanticItems } from '../src/main/cheil/wiki-semantic'
import type { WikiPage, WikiReply, WikiRequest } from '../src/shared/cheil-wiki-api'
const source = {
  id: 'source',
  title: '회의록',
  body: '영상 세 편 제작\n제출일 15일로 변경 확정\n예산 증액 검토',
  version: 's1',
} as WikiPage
const target = {
  id: 'target',
  title: '기존 지식',
  kind: 'page',
  body: '영상 3종 제작\n제출일 12일\n예산 유지',
  version: 't1',
} as WikiPage
const output = JSON.stringify({
  items: [
    { kind: 'duplicate', sourceLine: 1, targetLine: 1, reason: '동일한 수량' },
    { kind: 'decision', sourceLine: 2, targetLine: 2, reason: '명시적으로 변경 확정' },
    { kind: 'supplement', sourceLine: 3, targetLine: 3, reason: '검토 단계' },
  ],
})
function setup() {
  let changed = false
  const request = vi.fn(async (req: WikiRequest): Promise<WikiReply> =>
    req.op === 'list'
      ? { ok: true, root: 'wiki', pages: [changed ? { ...source, version: 's2' } : source, target] }
      : { ok: true },
  )
  const chat = vi.fn(async () => ({ ok: true, content: output }))
  const run = createWikiAnswers({
    request,
    chat,
    target: () => ({ ok: true, provider: 'codex', local: false }),
  })
  return {
    run,
    request,
    chat,
    change: () => {
      changed = true
    },
  }
}
it('maps paraphrase, confirmed change and tentative proposal to exact evidence', () => {
  const items = semanticItems(output, source, target)
  expect(items.map((i) => [i.kind, i.replace])).toEqual([
    ['duplicate', false],
    ['decision', true],
    ['supplement', false],
  ])
  expect(items[1]).toMatchObject({
    before: '제출일 12일',
    after: '제출일 15일로 변경 확정',
    status: 'pending',
  })
})
it('rejects hallucinated lines and overlapping replacements', () => {
  expect(() =>
    semanticItems(
      JSON.stringify({ items: [{ kind: 'decision', sourceLine: 99, targetLine: 2, reason: 'x' }] }),
      source,
      target,
    ),
  ).toThrow()
  expect(() =>
    semanticItems(
      JSON.stringify({
        items: [1, 2].map((sourceLine) => ({
          kind: 'conflict',
          sourceLine,
          targetLine: 2,
          reason: 'x',
        })),
      }),
      source,
      target,
    ),
  ).toThrow()
})
it('previews without calling AI, requires consent, saves only proposals and refuses replay', async () => {
  const s = setup(),
    p = await s.run({ op: 'prepareSemantic', sourceId: 'source', targetId: 'target', settings: {} })
  if (!p.ok || !p.preview) throw Error('preview missing')
  expect(s.chat).not.toHaveBeenCalled()
  expect(await s.run({ op: 'runSemantic', draftId: p.preview.id, approved: false })).toMatchObject({
    ok: false,
    reason: 'consent-required',
  })
  expect(await s.run({ op: 'runSemantic', draftId: p.preview.id, approved: true })).toMatchObject({
    ok: true,
  })
  expect(s.request.mock.calls.at(-1)?.[0]).toMatchObject({
    op: 'commitSemantic',
    expectedRoot: 'wiki',
    sourceVersion: 's1',
    targetVersion: 't1',
  })
  expect(s.request.mock.calls.some(([r]) => r.op === 'save' || r.op === 'reviewItem')).toBe(false)
  expect(await s.run({ op: 'runSemantic', draftId: p.preview.id, approved: true })).toMatchObject({
    ok: false,
  })
  expect(s.chat).toHaveBeenCalledTimes(1)
})
it('rejects source changes during AI analysis and malformed output without saving proposals', async () => {
  for (const mutate of [true, false]) {
    const s = setup()
    s.chat.mockImplementation(async () => {
      if (mutate) s.change()
      return { ok: true, content: 'invalid' }
    })
    const p = await s.run({
      op: 'prepareSemantic',
      sourceId: 'source',
      targetId: 'target',
      settings: {},
    })
    if (!p.ok || !p.preview) throw Error('preview missing')
    expect(await s.run({ op: 'runSemantic', draftId: p.preview.id, approved: true })).toMatchObject(
      { ok: false, reason: mutate ? 'conflict' : 'invalid' },
    )
    expect(s.request.mock.calls.some(([r]) => r.op === 'commitSemantic')).toBe(false)
  }
})

it('omits report metadata and groups exact evidence while retaining business deadlines', () => {
  const src = {
    ...source,
    body: 'Contact Report\nDate: 2026.08.18\n[TV]\n설치 상황은 연차 대기로 변경\n대기 장면은 한 상황으로 단순화\n제출일: 11월 15일',
  }
  const items = semanticItems(
    JSON.stringify({
      items: [
        { kind: 'new', sourceLines: [1, 2, 3], targetLine: null, reason: 'metadata' },
        { kind: 'decision', sourceLines: [4, 5], targetLine: 2, reason: 'one decision' },
        { kind: 'new', sourceLines: [6], targetLine: null, reason: 'business deadline' },
      ],
    }),
    src,
    target,
  )
  expect(items).toHaveLength(2)
  expect(items[0].after).toBe('설치 상황은 연차 대기로 변경\n대기 장면은 한 상황으로 단순화')
  expect(items[1].after).toContain('제출일')
})
