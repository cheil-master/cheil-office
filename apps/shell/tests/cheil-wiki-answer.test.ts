/** Cheil fork: consent is exact, scoped, fresh and never sent during preview. */
import { expect, it, vi } from 'vitest'
import { createWikiAnswers } from '../src/main/cheil/wiki-answer'
import type { WikiReply } from '../src/shared/cheil-wiki-api'
function setup(text = '대외비 에어린 일정 10월 1일') {
  let version = 'one'
  const chat = vi.fn(async () => ({ ok: true, content: '10월 1일 [1]' }))
  const request = vi.fn(async (req): Promise<WikiReply> =>
    req.op === 'context'
      ? { ok: true, excerpts: [{ id: 'id', title: '가상자료', version, text }] }
      : { ok: true, page: { id: 'id', version } as never },
  )
  return {
    chat,
    request,
    change: () => {
      version = 'two'
    },
    run: createWikiAnswers({
      request,
      chat,
      target: () => ({ ok: true, provider: 'codex', local: false }),
    }),
  }
}
it('only sends a prepared draft after explicit consent, and rejects replay', async () => {
  const s = setup(),
    p = await s.run({ op: 'prepareAnswer', query: '일정', settings: { providers: {} } })
  if (!p.ok || !p.preview) throw Error('missing preview')
  expect(s.chat).not.toHaveBeenCalled()
  expect(await s.run({ op: 'answer', draftId: p.preview.id, approved: false })).toMatchObject({
    ok: false,
    reason: 'consent-required',
  })
  expect(await s.run({ op: 'answer', draftId: p.preview.id, approved: true })).toMatchObject({
    ok: true,
    answer: '10월 1일 [1]',
  })
  expect(await s.run({ op: 'answer', draftId: p.preview.id, approved: true })).toMatchObject({
    ok: false,
  })
  expect(s.chat).toHaveBeenCalledTimes(1)
})
it('rejects changed sources and never lets consent override personal data', async () => {
  const s = setup(),
    p = await s.run({ op: 'prepareAnswer', query: '일정', settings: { providers: {} } })
  if (!p.ok || !p.preview) throw Error('missing')
  s.change()
  expect(await s.run({ op: 'answer', draftId: p.preview.id, approved: true })).toMatchObject({
    ok: false,
    reason: 'conflict',
  })
  const pii = setup('담당 010-1234-5678'),
    q = await pii.run({ op: 'prepareAnswer', query: '담당', settings: { providers: {} } })
  expect(q).toMatchObject({ ok: true, preview: { blocked: true } })
  expect(pii.chat).not.toHaveBeenCalled()
})
