/** Cheil fork: only the home may read or mutate the personal wiki. */
import { expect, it, vi } from 'vitest'
import { registerWikiIpc } from '../src/main/cheil/wiki-ipc'
import type { createWikiStore } from '../src/main/cheil/wiki-store'
import type { WikiRequest } from '../src/shared/cheil-wiki-api'
function setup() {
  let handle: (event: { sender: unknown }, req: WikiRequest) => Promise<unknown>
  const request = vi.fn(async () => ({ ok: true as const, pages: [] }))
  const pickFiles = vi.fn(async () => ['C:\\inbox\\memo.txt'])
  const openExternal = vi.fn(async () => undefined)
  const openFolder = vi.fn(async () => '')
  registerWikiIpc({
    ipc: {
      handle: (_channel, fn) => {
        handle = fn
      },
    },
    isHome: (sender) => sender === 'home',
    store: { request } as unknown as ReturnType<typeof createWikiStore>,
    pickFiles,
    openExternal,
    openFolder,
    root: () => 'C:\\자료\\Cheil 위키',
  })
  return {
    call: (sender: unknown, req: WikiRequest) => handle({ sender }, req),
    request,
    pickFiles,
    openExternal,
    openFolder,
  }
}
it('rejects other editor and external senders before disk access', async () => {
  const s = setup()
  expect(await s.call('editor', { op: 'list' })).toEqual({ ok: false, reason: 'invalid' })
  expect(await s.call('external', { op: 'addText', title: '오로라7', body: '내용' })).toEqual({
    ok: false,
    reason: 'invalid',
  })
  expect(s.request).not.toHaveBeenCalled()
})
it('passes campaign scope from native file selection through to main storage', async () => {
  const s = setup()
  await s.call('home', { op: 'pickFiles', campaignId: 'aurora' })
  expect(s.request).toHaveBeenCalledWith({
    op: 'addFiles',
    paths: ['C:\\inbox\\memo.txt'],
    campaignId: 'aurora',
  })
})
it('opens Obsidian only on the explicit optional action with the encoded wiki path', async () => {
  const s = setup()
  await s.call('home', { op: 'list' })
  expect(s.openExternal).not.toHaveBeenCalled()
  await s.call('home', { op: 'openObsidian' })
  expect(s.openExternal).toHaveBeenCalledWith(
    'obsidian://open?path=' + encodeURIComponent('C:\\자료\\Cheil 위키'),
  )
})
it('does not claim a folder was opened when the operating system rejects it', async () => {
  const s = setup()
  s.openFolder.mockResolvedValue('failed')
  expect(await s.call('home', { op: 'openFolder' })).toEqual({ ok: false, reason: 'failed' })
})
