/** Cheil fork: cloud transport, consent and source-version regressions, no live service. */
import { expect, it, vi } from 'vitest'
import { azureEndpoint, analyzeAzurePage } from '../src/main/cheil/azure-ocr'
import { createWikiCloudOcr } from '../src/main/cheil/wiki-cloud-ocr'
import type { WikiPage } from '../src/shared/cheil-wiki-api'
it('restricts keys to approved HTTPS Azure origins', () => {
  expect(azureEndpoint('https://sample.cognitiveservices.azure.com/')).toBe(
    'https://sample.cognitiveservices.azure.com',
  )
  for (const url of [
    'http://sample.cognitiveservices.azure.com',
    'https://evil.test',
    'https://sample.cognitiveservices.azure.com.evil.test',
    'https://a:b@sample.cognitiveservices.azure.com',
    'https://sample.cognitiveservices.azure.com/path',
  ])
    expect(() => azureEndpoint(url)).toThrow()
})
it('sends only supplied image bytes once and returns layout Markdown', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('', {
        status: 202,
        headers: {
          'operation-location':
            'https://sample.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/id',
        },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'succeeded',
          analyzeResult: { content: '| Item | Cost |\n| --- | --- |\n| Airin | 12 |' },
        }),
      ),
    )
  const text = await analyzeAzurePage(
    { endpoint: 'https://sample.cognitiveservices.azure.com', key: 'fake' },
    new Uint8Array([1, 2]),
    fetcher,
    async () => {},
  )
  expect(text).toContain('| Airin | 12 |')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ base64Source: 'AQI=' })
  expect(fetcher.mock.calls[0][1].redirect).toBe('error')
})
it('does not leak the key to redirected polling or retry paid requests', async () => {
  const f = vi
    .fn()
    .mockResolvedValue(
      new Response('', {
        status: 202,
        headers: {
          'operation-location': 'https://evil.test/documentintelligence/documentModels/a',
        },
      }),
    )
  await expect(
    analyzeAzurePage(
      { endpoint: 'https://sample.cognitiveservices.azure.com', key: 'fake' },
      new Uint8Array([1]),
      f,
      async () => {},
    ),
  ).rejects.toThrow()
  expect(f).toHaveBeenCalledTimes(1)
  f.mockReset().mockResolvedValue(new Response('', { status: 429 }))
  await expect(
    analyzeAzurePage(
      { endpoint: 'https://sample.cognitiveservices.azure.com', key: 'fake' },
      new Uint8Array([1]),
      f,
      async () => {},
    ),
  ).rejects.toThrow()
  expect(f).toHaveBeenCalledTimes(1)
})
function setup() {
  let hash = 'source',
    version = 'v1'
  const page = {
    id: 'id',
    origin: 'C:/test.pdf',
    originHash: 'source',
    version: 'v1',
    body: 'Airin sample',
    extraction: { totalPages: 3, ocrPages: 0, unreadablePages: [2], truncated: false },
  } as WikiPage
  const analyze = vi.fn(async () => 'Recovered table'),
    apply = vi.fn(async () => ({ ok: true as const, page }))
  const run = createWikiCloudOcr({
    request: async () => ({ ok: true, page: { ...page, version } }),
    fingerprint: async () => hash,
    render: async (_path, pages) => pages.map((page) => ({ page, png: 'AQI=' })),
    apply,
    analyze,
  })
  const configure = () =>
    run({ op: 'ocrConfigure', endpoint: 'https://sample.cognitiveservices.azure.com', key: 'fake' })
  const prepare = () => run({ op: 'ocrPrepare', id: 'id', expectedVersion: 'v1', pages: [2] })
  return {
    run,
    configure,
    prepare,
    analyze,
    apply,
    change: () => {
      hash = 'changed'
    },
    edit: () => {
      version = 'v2'
    },
  }
}
it('requires configuration, exact preview and one-use consent', async () => {
  const s = setup()
  expect(await s.prepare()).toMatchObject({ reason: 'ocr-not-configured' })
  await s.configure()
  const r = await s.prepare()
  if (!r.ok || !r.ocrPreview) throw Error('preview')
  expect(s.analyze).not.toHaveBeenCalled()
  expect(await s.run({ op: 'ocrRun', draftId: r.ocrPreview.id, approved: false })).toMatchObject({
    reason: 'consent-required',
  })
  expect(await s.run({ op: 'ocrRun', draftId: r.ocrPreview.id, approved: true })).toMatchObject({
    ok: true,
  })
  expect(s.analyze).toHaveBeenCalledTimes(1)
  expect(await s.run({ op: 'ocrRun', draftId: r.ocrPreview.id, approved: true })).toMatchObject({
    reason: 'conflict',
  })
})
it.each(['source', 'wiki'])('rejects changed %s before transmission', async (kind) => {
  const s = setup()
  await s.configure()
  const r = await s.prepare()
  if (!r.ok || !r.ocrPreview) throw Error()
  if (kind === 'source') s.change()
  else s.edit()
  expect(await s.run({ op: 'ocrRun', draftId: r.ocrPreview.id, approved: true })).toMatchObject({
    reason: 'conflict',
  })
  expect(s.analyze).not.toHaveBeenCalled()
})
it('disconnect and dismiss revoke draft; invalid page ranges are rejected', async () => {
  const s = setup()
  await s.configure()
  for (const pages of [[0], [4], [1, 1], [1, 2, 3, 4, 5, 6]])
    expect(await s.run({ op: 'ocrPrepare', id: 'id', expectedVersion: 'v1', pages })).toMatchObject(
      { ok: false },
    )
  const r = await s.prepare()
  if (!r.ok || !r.ocrPreview) throw Error()
  await s.run({ op: 'ocrDismiss' })
  expect(await s.run({ op: 'ocrRun', draftId: r.ocrPreview.id, approved: true })).toMatchObject({
    reason: 'conflict',
  })
  await s.run({ op: 'ocrConfigure', endpoint: '', key: '' })
  expect(await s.run({ op: 'ocrStatus' })).toEqual({ ok: true, ocrEndpoint: '' })
})
