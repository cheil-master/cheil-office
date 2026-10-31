/** Cheil fork: bounded document OCR; no redirects, retries or alternate billing provider. */
export function azureEndpoint(value: string): string {
  const u = new URL(value)
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash ||
    !/^[a-z0-9-]+\.(cognitiveservices\.azure\.com|api\.cognitive\.microsoft\.com)$/.test(
      u.hostname,
    ) ||
    !['', '/'].includes(u.pathname)
  )
    throw new Error('invalid-endpoint')
  return u.origin
}
export async function analyzeAzurePage(
  config: { endpoint: string; key: string },
  png: Uint8Array,
  fetcher: typeof fetch = fetch,
  wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<string> {
  const origin = azureEndpoint(config.endpoint)
  if (!config.key || config.key.length > 512 || png.byteLength > 10_000_000)
    throw new Error('invalid')
  const signal = AbortSignal.timeout(120_000)
  const headers = { 'Ocp-Apim-Subscription-Key': config.key, 'Content-Type': 'application/json' }
  const response = await fetcher(
    `${origin}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30&outputContentFormat=markdown`,
    {
      method: 'POST',
      headers,
      redirect: 'error',
      signal,
      body: JSON.stringify({ base64Source: Buffer.from(png).toString('base64') }),
    },
  )
  if (response.status !== 202) throw new Error('service-rejected')
  const location = new URL(response.headers.get('operation-location') || '')
  if (
    location.origin !== origin ||
    !location.pathname.startsWith('/documentintelligence/documentModels/') ||
    location.username ||
    location.password
  )
    throw new Error('invalid-operation')
  for (let i = 0; i < 55; i++) {
    await wait(2000)
    signal.throwIfAborted()
    const poll = await fetcher(location.href, { headers, redirect: 'error', signal })
    if (!poll.ok) throw new Error('service-rejected')
    const raw = await poll.text()
    if (raw.length > 8_000_000) throw new Error('response-too-large')
    const result = JSON.parse(raw)
    if (result.status === 'succeeded') {
      const content = result.analyzeResult?.content
      if (typeof content !== 'string' || !content.trim() || content.length > 200_000)
        throw new Error('empty-result')
      return content.trim()
    }
    if (result.status !== 'running' && result.status !== 'notStarted')
      throw new Error('service-failed')
  }
  throw new Error('timeout')
}
