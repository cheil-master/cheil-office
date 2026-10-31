/** Cheil fork: explicit PlayMCP send-to-self; credentials remain encrypted in main. */
import { safeStorage } from 'electron'
import { readFile } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { atomicWriteFile } from '../atomic-write'
import type { WikiReply, WikiRequest } from '../../shared/cheil-wiki-api'
type Tokens = {
  accessToken: { tokenValue: string; expiresAt: string }
  refreshToken: { tokenValue: string; expiresAt: string }
}
const gateway = 'https://playmcp.kakao.com/mcp',
  clientId = 'HElMUWdVoroTsrXxezeTSemg8gXzzCKWARb5MJux8gY'
export function createWikiKakao(path: () => string) {
  let cached: Tokens | null = null
  async function save(t: Tokens) {
    cached = t
    if (safeStorage.isEncryptionAvailable())
      await atomicWriteFile(path(), safeStorage.encryptString(JSON.stringify(t)))
  }
  async function load() {
    if (cached) return cached
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      cached = JSON.parse(safeStorage.decryptString(await readFile(path()))) as Tokens
      return cached
    } catch {
      return null
    }
  }
  async function access() {
    let t = await load()
    if (!t) return null
    if (Date.parse(t.accessToken.expiresAt) > Date.now() + 60000) return t.accessToken.tokenValue
    const response = await fetch('https://playauth.kakao.com/playmcp/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: t.refreshToken.tokenValue,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
    if (!response.ok) return null
    const x = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
    if (!x.access_token || !Number.isFinite(x.expires_in)) return null
    t = {
      accessToken: {
        tokenValue: x.access_token,
        expiresAt: new Date(Date.now() + x.expires_in * 1000).toISOString(),
      },
      refreshToken: { ...t.refreshToken, tokenValue: x.refresh_token || t.refreshToken.tokenValue },
    }
    await save(t)
    return t.accessToken.tokenValue
  }
  async function connection(token: string) {
    const client = new Client({ name: 'CheilOffice My Wiki', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(gateway), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
      redirectPolicy: 'same-origin',
    })
    await client.connect(transport)
    return client
  }
  return async (req: WikiRequest): Promise<WikiReply> => {
    try {
      if (req.op === 'kakaoStatus') return { ok: true, kakaoConnected: !!(await load()) }
      if (req.op === 'kakaoConnect') {
        const input = req.token.trim()
        const match = input.match(/oneTimeToken["']?\s*[:=]\s*["']?([A-Za-z0-9._~-]+)/i)
        const token = match?.[1] ?? input
        if (!/^[A-Za-z0-9._~-]{8,2048}$/.test(token)) return { ok: false, reason: 'invalid' }
        const response = await fetch('https://playmcp.kakao.com/api/v1/auths/otts:exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenValue: token }),
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        })
        if (!response.ok) return { ok: false, reason: 'failed' }
        const t = (await response.json()) as Tokens
        if (
          !t.accessToken?.tokenValue ||
          !t.refreshToken?.tokenValue ||
          !t.accessToken.expiresAt ||
          !t.refreshToken.expiresAt
        )
          return { ok: false, reason: 'failed' }
        await save(t)
        return { ok: true, kakaoConnected: true }
      }
      if (req.op === 'kakaoSend') {
        if (
          req.approved !== true ||
          typeof req.text !== 'string' ||
          !req.text.trim() ||
          req.text.length > 200
        )
          return { ok: false, reason: 'invalid' }
        const token = await access()
        if (!token) return { ok: false, reason: 'failed' }
        const client = await connection(token)
        try {
          const { tools } = await client.listTools()
          const matches = tools.filter(
            (t) =>
              t.name === 'KakaotalkChat-MemoChat' &&
              t.inputSchema?.properties &&
              Object.keys(t.inputSchema.properties).includes('message'),
          )
          if (matches.length !== 1) return { ok: false, reason: 'unsupported' }
          const result = await client.callTool({
            name: matches[0]!.name,
            arguments: { message: req.text },
          })
          if (result.isError) return { ok: false, reason: 'failed' }
          return { ok: true }
        } finally {
          await client.close()
        }
      }
      return { ok: false, reason: 'invalid' }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }
}
