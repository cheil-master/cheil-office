/** Cheil fork: own Markdown store isolation, durability and scope regression tests. */
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createWikiStore } from '../src/main/cheil/wiki-store'
import type { WikiPage, WikiReply } from '../src/shared/cheil-wiki-api'
let dir: string
let root: string
const make = () =>
  createWikiStore({
    root: () => root,
    readText: async (path) => {
      const body = await readFile(path, 'utf8')
      return body === 'locked' ? null : body
    },
    campaignExists: async (id) => ['aurora', 'airin'].includes(id),
  })
let store: ReturnType<typeof make>
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cheil-wiki-'))
  root = join(dir, 'wiki')
  store = make()
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})
function page(reply: WikiReply): WikiPage {
  expect(reply.ok).toBe(true)
  if (!reply.ok || !reply.page) throw new Error('missing')
  return reply.page
}
const add = async (title = '오로라7 회의', body = '오로라7 일정 확정', campaignId?: string) =>
  page(await store.request({ op: 'addText', title, body, campaignId }))

it('starts without an Obsidian vault and survives restart as ordinary Markdown', async () => {
  const p = await add()
  const raw = await readFile(join(root, 'sources', `${p.id}.md`), 'utf8')
  expect(raw).toContain('오로라7 일정 확정')
  expect(page(await make().request({ op: 'read', id: p.id })).body).toBe(p.body)
})
it('deduplicates concurrent imports and links one file to two campaigns', async () => {
  const path = join(dir, '에어린.txt')
  await writeFile(path, '에어린 공통자료')
  const [a, b] = await Promise.all(
    ['aurora', 'airin'].map((campaignId) =>
      store.request({ op: 'addFiles', paths: [path], campaignId }),
    ),
  )
  expect(a.ok && a.results?.[0]?.id).toBe(b.ok && b.results?.[0]?.id)
  expect(await readdir(join(root, 'sources'))).toHaveLength(1)
  const list = await store.request({ op: 'list' })
  expect(list.ok && list.pages?.[0]?.campaignIds.sort()).toEqual(['airin', 'aurora'])
})
it('unlinking preserves the same editable material in the other campaign', async () => {
  const p = await add('공통', '공통문서', 'aurora')
  await store.request({ op: 'link', id: p.id, campaignId: 'airin', linked: true })
  const linked = page(
    await store.request({ op: 'link', id: p.id, campaignId: 'aurora', linked: false }),
  )
  await store.request({
    op: 'save',
    id: p.id,
    title: '수정',
    body: '고친 본문',
    expectedVersion: linked.version,
  })
  const a = await store.request({ op: 'list', campaignId: 'aurora' })
  expect(a.ok && a.pages).toEqual([])
  const b = await store.request({ op: 'read', id: p.id, campaignId: 'airin' })
  expect(page(b).body).toBe('고친 본문')
})
it('campaign search, direct reads and AI context exclude unlinked material', async () => {
  const a = await add('자료', '오로라7 범위 내부', 'aurora')
  const b = await add('별도', '오로라7 범위 외부', 'airin')
  const c = await add('공통', '오로라7 공통자료')
  const r = await store.request({ op: 'context', query: '오로라7', campaignId: 'aurora' })
  expect(r.ok && r.excerpts?.map((e) => e.id)).toEqual([a.id])
  expect(await store.request({ op: 'read', id: b.id, campaignId: 'aurora' })).toEqual({
    ok: false,
    reason: 'not-found',
  })
  expect(await store.request({ op: 'read', id: c.id, campaignId: 'aurora' })).toEqual({
    ok: false,
    reason: 'not-found',
  })
})
it('rejects fabricated campaigns before writing', async () => {
  expect(
    await store.request({ op: 'addText', title: '제목', body: '내용', campaignId: '../escape' }),
  ).toEqual({ ok: false, reason: 'invalid' })
})
it('keeps prior Markdown in history and detects external edit conflicts', async () => {
  const p = await add()
  const saved = page(
    await store.request({
      op: 'save',
      id: p.id,
      title: p.title,
      body: '변경',
      expectedVersion: p.version,
    }),
  )
  const path = join(root, 'sources', `${p.id}.md`)
  await writeFile(path, (await readFile(path, 'utf8')).replace('변경', '외부수정'))
  expect(
    await store.request({
      op: 'save',
      id: p.id,
      title: p.title,
      body: '덮어쓰기',
      expectedVersion: saved.version,
    }),
  ).toEqual({ ok: false, reason: 'conflict' })
  expect(page(await store.request({ op: 'read', id: p.id })).body).toBe('외부수정')
  const history = await store.request({ op: 'history', id: p.id })
  expect(history.ok && history.versions).toContain(p.version)
})
it('restores old content and keeps the overwritten version too', async () => {
  const p = await add()
  const newer = page(
    await store.request({
      op: 'save',
      id: p.id,
      title: p.title,
      body: '수정본',
      expectedVersion: p.version,
    }),
  )
  expect(
    page(
      await store.request({
        op: 'restore',
        id: p.id,
        version: p.version,
        expectedVersion: newer.version,
      }),
    ).body,
  ).toBe(p.body)
  const h = await store.request({ op: 'history', id: p.id })
  expect(h.ok && h.versions).toContain(newer.version)
})
it('marks generated pages stale when source is edited or trashed', async () => {
  const p = await add()
  const answer = page(
    await store.request({
      op: 'saveAnswer',
      title: '정리',
      body: '검토할 요약',
      sources: [{ id: p.id, version: p.version }],
    }),
  )
  expect(answer.needsReview).toBe(true)
  await store.request({
    op: 'save',
    id: p.id,
    title: p.title,
    body: '새 근거',
    expectedVersion: p.version,
  })
  expect(page(await store.request({ op: 'read', id: answer.id })).stale).toBe(true)
})
it('rejects stale or out-of-scope AI citations', async () => {
  const p = await add('에어린', '별도 자료', 'airin')
  expect(
    await store.request({
      op: 'saveAnswer',
      title: '답',
      body: '답',
      sources: [{ id: p.id, version: p.version }],
      campaignId: 'aurora',
    }),
  ).toEqual({ ok: false, reason: 'not-found' })
  expect(
    await store.request({
      op: 'saveAnswer',
      title: '답',
      body: '답',
      sources: [{ id: p.id, version: 'stale' }],
    }),
  ).toEqual({ ok: false, reason: 'conflict' })
})
it('deletes into local trash, retains original file and invalidates references', async () => {
  const path = join(dir, '원본.txt')
  await writeFile(path, '블루윈드 원본')
  const imported = await store.request({ op: 'addFiles', paths: [path] })
  if (!imported.ok) throw new Error('failed')
  const id = imported.results![0]!.id!
  const p = page(await store.request({ op: 'read', id }))
  expect(await store.request({ op: 'trash', id, expectedVersion: p.version })).toEqual({ ok: true })
  expect(await readFile(path, 'utf8')).toBe('블루윈드 원본')
  expect(await readdir(join(root, '.trash'))).toHaveLength(1)
  expect(await store.request({ op: 'read', id })).toEqual({ ok: false, reason: 'not-found' })
})
it('tracks changed source files as new versions instead of overwriting old material', async () => {
  const path = join(dir, '자료.txt')
  await writeFile(path, '첫 버전')
  const a = await store.request({ op: 'addFiles', paths: [path] })
  if (!a.ok) throw new Error('failed')
  await writeFile(path, '두 번째 버전')
  const b = await store.request({ op: 'addFiles', paths: [path] })
  if (!b.ok) throw new Error('failed')
  const newer = page(await store.request({ op: 'read', id: b.results![0]!.id! }))
  expect(newer.previousId).toBe(a.results![0]!.id)
  expect(await readdir(join(root, 'sources'))).toHaveLength(2)
})
it('reports mixed failures without phantom campaign links', async () => {
  const empty = join(dir, 'empty.txt'),
    locked = join(dir, 'locked.docx'),
    bad = join(dir, 'bad.exe'),
    good = join(dir, 'good.txt')
  await Promise.all([
    writeFile(empty, ''),
    writeFile(locked, 'locked'),
    writeFile(bad, 'bad'),
    writeFile(good, '정상'),
  ])
  const r = await store.request({
    op: 'addFiles',
    paths: [empty, locked, bad, good],
    campaignId: 'aurora',
  })
  expect(r.ok && r.results?.map((r) => r.ok)).toEqual([false, false, false, true])
  expect(await readdir(join(root, 'sources'))).toHaveLength(1)
})
it('does not use a user title as a filesystem path', async () => {
  const p = await add('../../escape\\name', '본문')
  expect(await readdir(join(root, 'sources'))).toEqual([`${p.id}.md`])
  expect(await store.request({ op: 'read', id: '../../escape' })).toEqual({
    ok: false,
    reason: 'not-found',
  })
})
it('rejects links that escape the store', async () => {
  await store.request({ op: 'list' })
  await rm(join(root, 'sources'), { recursive: true })
  await symlink(dir, join(root, 'sources'), 'junction')
  expect(await store.request({ op: 'addText', title: '본문', body: 'escape' })).toEqual({
    ok: false,
    reason: 'invalid',
  })
})
it('bounds AI context to six excerpts and never performs a model call', async () => {
  for (let i = 0; i < 9; i++) await add(`오로라7 ${i}`, `오로라7 ${i} ${'x'.repeat(9000)}`)
  const r = await store.request({ op: 'context', query: '오로라7' })
  expect(r.ok && r.excerpts).toHaveLength(6)
  if (r.ok) expect(r.excerpts?.every((e) => e.text.length <= 3000)).toBe(true)
})

it('switches roots after pending writes without moving old Markdown', async () => {
  const oldRoot = root
  const writing = add('오로라7', '이전 저장소')
  const switched = store.switchRoot(async () => {
    root = join(dir, 'new-wiki')
  })
  await writing
  const result = await switched
  expect(result.ok && result.pages).toEqual([])
  expect(await readdir(join(oldRoot, 'sources'))).toHaveLength(1)
  await add('에어린', '새 저장소')
  expect(await readdir(join(root, 'sources'))).toHaveLength(1)
})
it('retains stored Markdown when the original file is moved or deleted', async () => {
  const source = join(dir, '원본.txt')
  await writeFile(source, '오로라7 원문')
  const imported = await store.request({ op: 'addFiles', paths: [source] })
  if (!imported.ok) throw new Error('import')
  await rm(source)
  const kept = page(await store.request({ op: 'read', id: imported.results![0]!.id! }))
  expect(kept.originMissing).toBe(true)
  expect(kept.body).toBe('오로라7 원문')
})
it('ignores malformed external metadata without breaking other pages', async () => {
  const p = await add()
  const id = '11111111-1111-1111-1111-111111111111'
  await writeFile(
    join(root, 'pages', `${id}.md`),
    '---\ncheil: ' +
      JSON.stringify({ id, kind: 'page', title: 'broken', sourceIds: 'invalid', campaignIds: [] }) +
      '\n---\ntext',
  )
  const found = await store.request({ op: 'list' })
  expect(found.ok && found.pages?.map((p) => p.id)).toEqual([p.id])
})
it('marks summaries as stale when a newer source file version is imported', async () => {
  const path = join(dir, '오로라7.txt')
  await writeFile(path, '오로라7 원본')
  const first = await store.request({ op: 'addFiles', paths: [path] })
  if (!first.ok) throw new Error('import')
  const source = page(await store.request({ op: 'read', id: first.results![0]!.id! }))
  const summary = page(
    await store.request({
      op: 'saveAnswer',
      title: '정리',
      body: '요약',
      sources: [{ id: source.id, version: source.version }],
    }),
  )
  await writeFile(path, '오로라7 새 버전')
  await store.request({ op: 'addFiles', paths: [path] })
  expect(page(await store.request({ op: 'read', id: summary.id })).stale).toBe(true)
})

it('keeps broad literal file search separate from vague AI questions', async () => {
  const p = await add('오로라7 캠페인', '일정 자료')
  const list = await store.request({ op: 'list', query: '캠페인' })
  expect(list.ok && list.pages?.some((x) => x.id === p.id)).toBe(true)
  const context = await store.request({ op: 'context', query: '캠페인' })
  expect(context.ok && context.excerpts).toEqual([])
})

it('cloud OCR replaces only reviewed pages, retains history and rejects stale writes', async () => {
  const source = join(dir, 'sample.pdf')
  await writeFile(source, 'synthetic PDF fixture')
  const cloudStore = createWikiStore({
    root: () => root,
    campaignExists: async () => true,
    readText: async () => ({
      body: '## PDF 1 (text)\nKeep page one\n\n## PDF 2 (OCR)\nOld page two\n\n## PDF 3 (text)\nKeep page three',
      extraction: { totalPages: 3, ocrPages: 1, unreadablePages: [2], truncated: false },
    }),
  })
  await cloudStore.request({ op: 'addFiles', paths: [source] })
  const listed = await cloudStore.request({ op: 'list' })
  if (!listed.ok || !listed.pages?.[0]) throw Error('missing')
  const original = listed.pages[0]
  const result = page(
    await cloudStore.applyOcr(original, [
      { page: 2, text: '| Product | Cost |\n| --- | --- |\n| Airin | 12 |' },
    ]),
  )
  expect(result.body).toContain('Keep page one')
  expect(result.body).toContain('Keep page three')
  expect(result.body).not.toContain('Old page two')
  expect(result.extraction?.cloudPages).toEqual([2])
  expect(result.extraction?.unreadablePages).toEqual([])
  expect(result.needsReview).toBe(true)
  const history = await cloudStore.request({ op: 'history', id: original.id })
  expect(history.ok && history.versions).toContain(original.version)
  expect(await cloudStore.applyOcr(original, [{ page: 1, text: 'stale' }])).toMatchObject({
    ok: false,
    reason: 'conflict',
  })
  expect(await readFile(source, 'utf8')).toBe('synthetic PDF fixture')
})
