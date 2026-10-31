/** Cheil fork: the journal cutoff, pause boundary, idempotency and local ingress gate. */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JournalStore, journalDay, journalExtract } from '../src/main/cheil/journal-store'
import { JournalServer } from '../src/main/cheil/journal-server'

const roots: string[] = []
const services: JournalServer[] = []
afterEach(async () => {
  services.forEach((service) => service.close())
  services.length = 0
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'cheil-journal-test-'))
  roots.push(root)
  let now = Date.parse('2026-10-29T10:00:00Z')
  const store = new JournalStore(root, () => now)
  return {
    store,
    root,
    time: () => now,
    advance: (delta: number) => {
      now += delta
    },
  }
}
const payload = (at: number, answer = 'Check the period and unit before comparing numbers.') => ({
  source: 'chatgpt-web',
  adapter: 'chatgpt-web',
  conversations: [
    {
      externalId: 'fixture-conversation',
      metadata: { url: 'https://chatgpt.com/c/fixture-conversation' },
      messages: [
        {
          externalId: 'q1',
          role: 'user',
          content: 'How should I compare these numbers?',
          createdAt: at,
        },
        { externalId: 'a1', role: 'assistant', content: answer, createdAt: at + 1 },
      ],
    },
  ],
})

describe('forward-only local journal', () => {
  it('excludes questions from before recording and writes short Q/A Markdown', async () => {
    const test = await setup()
    await test.store.setEnabled(true)
    await test.store.ingest(payload(test.time() - 1000))
    expect((await test.store.view()).entries).toEqual([])
    await test.store.ingest(payload(test.time() + 10))
    const view = await test.store.view()
    expect(view.entries).toHaveLength(1)
    const md = await readFile(test.store.pathOf(journalDay(test.time())), 'utf8')
    expect(md).toContain('How should I compare these numbers?')
    expect(md).toContain('summary: local-extract')
    expect(md).toContain('https://chatgpt.com/c/fixture-conversation')
  })
  it('deduplicates repeated imports, updates an answer and survives restart', async () => {
    const test = await setup()
    await test.store.setEnabled(true)
    await test.store.ingest(payload(test.time() + 10))
    await test.store.ingest(payload(test.time() + 10, 'Updated answer'))
    const restarted = new JournalStore(test.root, test.time)
    expect((await restarted.view()).entries).toHaveLength(1)
    expect((await restarted.view()).entries[0].answer).toBe('Updated answer')
    expect(await restarted.connection()).toEqual(await test.store.connection())
  })
  it('rejects ingestion while off and does not join a reply across a pause', async () => {
    const test = await setup()
    await test.store.setEnabled(true)
    const oldQuestion = test.time() + 10
    test.advance(20)
    await test.store.setEnabled(false)
    await expect(test.store.ingest(payload(oldQuestion))).rejects.toThrow('paused')
    const offQuestion = test.time() + 10
    test.advance(40)
    await test.store.setEnabled(true)
    await test.store.ingest(payload(offQuestion))
    const crossing = payload(oldQuestion)
    crossing.conversations[0].messages[1].createdAt = test.time() + 1
    await test.store.ingest(crossing)
    expect((await test.store.view()).entries).toEqual([])
    await test.store.ingest(payload(test.time() + 2))
    expect((await test.store.view()).entries).toHaveLength(1)
  })
  it('uses Korea day boundaries and limits plain text extracts', () => {
    expect(journalDay(Date.parse('2026-10-29T15:00:00Z'))).toBe('2026-10-30')
    const extract = journalExtract('```js\nsecret code\n```\n# Result\n' + 'A'.repeat(500), 100)
    expect(extract.length).toBeLessThanOrEqual(100)
    expect(extract).not.toContain('secret code')
  })
  it('preserves a damaged state file and rejects unknown sources and traversal', async () => {
    const test = await setup()
    await test.store.setEnabled(true)
    await expect(
      test.store.ingest({ ...payload(test.time()), adapter: 'unknown' }),
    ).rejects.toThrow('invalid')
    expect(() => test.store.pathOf('../../outside')).toThrow('Invalid day')
    await writeFile(join(test.root, 'state.json'), 'damaged')
    const restarted = new JournalStore(test.root)
    await expect(restarted.view()).rejects.toThrow('preserved')
    expect(await readFile(join(test.root, 'state.json'), 'utf8')).toBe('damaged')
  })
  it('requires the paired token and refuses website origins on the real loopback receiver', async () => {
    const test = await setup()
    const server = new JournalServer(test.store, 0)
    services.push(server)
    expect(await server.start()).toBe(true)
    const url = `http://127.0.0.1:${server.port}/health`
    expect((await fetch(url)).status).toBe(401)
    const { token } = await test.store.connection()
    const headers = { Authorization: `Bearer ${token}` }
    expect(
      (await fetch(url, { headers: { ...headers, Origin: 'https://example.com' } })).status,
    ).toBe(403)
    expect((await (await fetch(url, { headers })).json()).capture.enabled).toBe(false)
    await test.store.setEnabled(true)
    const result = await fetch(`http://127.0.0.1:${server.port}/ingest`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(test.time() + 10)),
    })
    expect(result.status).toBe(200)
    expect((await test.store.view()).entries).toHaveLength(1)
  })
  it('pairs an extension over HTTP only after office approval and consumes the request', async () => {
    const test = await setup()
    const server = new JournalServer(test.store, 0)
    services.push(server)
    expect(await server.start()).toBe(true)
    const identity = { id: 'a'.repeat(32), nonce: '1'.repeat(64) }
    const headers = {
      'Content-Type': 'application/json',
      Origin: `chrome-extension://${identity.id}`,
    }
    const post = (route: string, body = identity) =>
      fetch(`http://127.0.0.1:${server.port}${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    const requested = await post('/pair/request')
    expect(requested.status).toBe(202)
    const waiting = await requested.json()
    expect(waiting.connection).toBeUndefined()
    expect((await post('/pair/complete')).status).toBe(202)
    expect((await post('/pair/approve')).status).toBe(401)
    expect((await post('/pair/complete', { ...identity, nonce: '2'.repeat(64) })).status).toBe(400)
    expect(server.pairing.approve(waiting.code)).toBe(true)
    const completed = await post('/pair/complete')
    expect(completed.status).toBe(200)
    expect((await completed.json()).connection).toEqual(await test.store.connection())
    expect((await post('/pair/complete')).status).toBe(400)
    expect(
      (
        await fetch(`http://127.0.0.1:${server.port}/pair/request`, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://example.com' },
          body: JSON.stringify(identity),
        })
      ).status,
    ).toBe(403)
  })
})
