/** Cheil fork: preservation, retry and knowledge relationships across restarts. */
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { it, expect } from 'vitest'
import { createWikiStore } from '../src/main/cheil/wiki-store'
import type { WikiReply, WikiPage, WikiKnowledge } from '../src/shared/cheil-wiki-api'
function page(r: WikiReply): WikiPage {
  if (!r.ok || !r.page) throw Error(JSON.stringify(r))
  return r.page
}
const knowledge: WikiKnowledge = {
  type: 'brand',
  aliases: ['Airin'],
  relatedIds: [],
  reuse: 'campaign',
  status: 'draft',
}
it('indexes legacy bytes without changing IDs, content or history and detects metadata conflicts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wiki-foundation-'))
  const make = () =>
    createWikiStore({
      root: () => root,
      readText: (p) => readFile(p, 'utf8'),
      campaignExists: async () => true,
    })
  try {
    let store = make()
    const p = page(await store.request({ op: 'addText', title: '에어린', body: '브랜드 원문' }))
    const edited = page(
      await store.request({
        op: 'save',
        id: p.id,
        expectedVersion: p.version,
        title: p.title,
        body: '사용자 수정',
      }),
    )
    const file = join(root, 'sources', p.id + '.md'),
      raw = await readFile(file)
    const history = await readdir(join(root, '.history'))
    store = make()
    expect(page(await store.request({ op: 'read', id: p.id })).version).toBe(edited.version)
    const organized = page(
      await store.request({
        op: 'setKnowledge',
        id: p.id,
        expectedVersion: edited.version,
        knowledge,
      }),
    )
    expect(await readFile(file)).toEqual(raw)
    expect(await readdir(join(root, '.history'))).toEqual(history)
    expect(organized.knowledge?.status).toBe('draft')
    expect(
      await store.request({
        op: 'setKnowledge',
        id: p.id,
        expectedVersion: edited.version,
        knowledge,
      }),
    ).toMatchObject({ ok: false, reason: 'conflict' })
    const k = page(
      await store.request({
        op: 'createKnowledge',
        title: '브랜드 이해',
        body: '출처를 확인할 초안',
        knowledge: { ...knowledge, relatedIds: [p.id] },
        sources: [{ id: p.id, version: edited.version }],
      }),
    )
    expect(page(await make().request({ op: 'read', id: k.id })).knowledge?.relatedIds).toEqual([
      p.id,
    ])
    expect(k.sourceVersions[p.id]).toBe(edited.version)
    expect(
      await store.request({
        op: 'createKnowledge',
        title: 'invalid',
        body: 'invalid',
        knowledge: { ...knowledge, relatedIds: ['missing'] },
        sources: [],
      }),
    ).toMatchObject({ ok: false })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
it('retries the immutable original after extraction failure and preserves new versions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wiki-foundation-'))
  const origin = join(root, '에어린.txt')
  let fail = true
  const store = createWikiStore({
    root: () => join(root, 'wiki'),
    readText: async (p) => (fail ? null : readFile(p, 'utf8')),
    campaignExists: async () => true,
  })
  try {
    await writeFile(origin, '첫 번째 원문')
    expect(await store.request({ op: 'addFiles', paths: [origin] })).toMatchObject({
      ok: true,
      results: [{ ok: false }],
    })
    const r = await store.request({ op: 'jobs' })
    if (!r.ok || !r.jobs?.[0]) throw Error('job missing')
    const job = r.jobs[0]
    expect(job.status).toBe('failed')
    await writeFile(origin, '두 번째 원문')
    fail = false
    const first = page(await store.request({ op: 'retryImport', jobId: job.id }))
    expect(first.body).toBe('첫 번째 원문')
    const imported = await store.request({ op: 'addFiles', paths: [origin] })
    expect(imported).toMatchObject({ ok: true, results: [{ ok: true }] })
    const list = await store.request({ op: 'list' })
    if (!list.ok) throw Error('list')
    const second = list.pages!.find((p) => p.id !== first.id)!
    expect(second.previousId).toBe(first.id)
    expect(await readFile(join(root, 'wiki', 'raw', first.snapshot!), 'utf8')).toBe('첫 번째 원문')
    expect(await store.request({ op: 'addFiles', paths: [origin] })).toMatchObject({
      ok: true,
      results: [{ duplicate: true }],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
