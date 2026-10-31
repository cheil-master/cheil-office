/** Cheil fork: per-item decisions preserve evidence and reject stale writes. */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it, expect } from 'vitest'
import { createWikiStore } from '../src/main/cheil/wiki-store'
import type { WikiReply, WikiReview } from '../src/shared/cheil-wiki-api'
const page = (r: WikiReply) => {
  if (!r.ok || !r.page) throw Error(JSON.stringify(r))
  return r.page
}
const review = (r: WikiReply): WikiReview => {
  if (!r.ok || !r.review) throw Error(JSON.stringify(r))
  return r.review
}
it('holds tentative changes, applies selected edits once, rejects another and preserves exact history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wiki-review-'))
  const make = () =>
    createWikiStore({
      root: () => root,
      readText: (p) => readFile(p, 'utf8'),
      campaignExists: async () => true,
    })
  try {
    let store = make()
    const target = page(
      await store.request({
        op: 'createKnowledge',
        title: '에어린 현황',
        body: '제출일: 11월 12일\n영상: 2종\n전략: 기능 중심',
        knowledge: {
          type: 'campaign',
          aliases: [],
          relatedIds: [],
          reuse: 'campaign',
          status: 'draft',
        },
        sources: [],
      }),
    )
    const source = page(
      await store.request({
        op: 'addText',
        title: '회의록',
        body: '제출일: 11월 15일로 검토\n영상: 3종으로 확정\n전략: 장면 중심',
      }),
    )
    const sourceRaw = await readFile(join(root, 'sources', source.id + '.md'), 'utf8')
    const before = await readFile(join(root, 'pages', target.id + '.md'), 'utf8')
    let r = review(await store.request({ op: 'compare', sourceId: source.id, targetId: target.id }))
    expect(r.items.map((i) => i.kind)).toEqual(['supplement', 'decision', 'conflict'])
    expect(await readFile(join(root, 'pages', target.id + '.md'), 'utf8')).toBe(before)
    r = review(
      await store.request({
        op: 'reviewItem',
        reviewId: r.id,
        itemId: r.items[0]!.id,
        revision: r.revision,
        action: 'hold',
      }),
    )
    r = review(
      await store.request({
        op: 'reviewItem',
        reviewId: r.id,
        itemId: r.items[2]!.id,
        revision: r.revision,
        action: 'reject',
      }),
    )
    const apply = {
      op: 'reviewItem' as const,
      reviewId: r.id,
      itemId: r.items[1]!.id,
      revision: r.revision,
      action: 'apply' as const,
      text: '영상: 3종 (사용자 확인)',
    }
    r = review(await store.request(apply))
    expect(await store.request(apply)).toMatchObject({ ok: false, reason: 'conflict' })
    expect(page(await store.request({ op: 'read', id: target.id })).body).toBe(
      '제출일: 11월 12일\n영상: 3종 (사용자 확인)\n전략: 기능 중심',
    )
    expect(
      await readFile(join(root, '.history', target.id + '-' + target.version + '.md'), 'utf8'),
    ).toBe(before)
    expect(await readFile(join(root, 'sources', source.id + '.md'), 'utf8')).toBe(sourceRaw)
    store = make()
    const listing = await store.request({ op: 'reviews' })
    expect(listing.ok && listing.reviews?.[0]?.items.map((i) => i.status)).toEqual([
      'held',
      'applied',
      'rejected',
    ])
    const current = page(await store.request({ op: 'read', id: target.id }))
    await store.request({
      op: 'save',
      id: target.id,
      expectedVersion: current.version,
      title: current.title,
      body: current.body + '\n사용자 추가',
    })
    expect(
      await store.request({
        op: 'reviewItem',
        reviewId: r.id,
        itemId: r.items[0]!.id,
        revision: r.revision,
        action: 'apply',
      }),
    ).toMatchObject({ ok: false, reason: 'conflict' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
