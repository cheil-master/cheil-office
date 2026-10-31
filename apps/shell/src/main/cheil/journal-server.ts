/** Cheil fork: authenticated loopback ingestion from the paired browser extension. */
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { JournalPairing } from './journal-pairing'
import { JournalStore, JOURNAL_PORT } from './journal-store'
import type { JournalProvider } from '../../shared/cheil-journal-api'

export class JournalServer {
  private server: Server | null = null
  private starting: Promise<boolean> | null = null
  readonly pairing = new JournalPairing()
  ready = false
  constructor(
    readonly store: JournalStore,
    public port = JOURNAL_PORT,
  ) {}
  async start(): Promise<boolean> {
    if (this.ready) return true
    if (this.starting) return this.starting
    this.starting = this.listen().finally(() => {
      this.starting = null
    })
    return this.starting
  }
  private async listen() {
    const { token } = await this.store.connection()
    const server = createServer((req, res) => {
      void (async () => {
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        const origin = req.headers.origin
        const allowedOrigin = !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
        if (
          !allowedOrigin ||
          ![`127.0.0.1:${this.port}`, `localhost:${this.port}`].includes(req.headers.host ?? '')
        ) {
          res.writeHead(403).end('{"ok":false}')
          return
        }
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin)
          res.setHeader('Vary', 'Origin')
          res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        }
        if (req.method === 'OPTIONS') {
          res.writeHead(204).end()
          return
        }
        // Cheil fork: an extension can request pairing, but only the office can approve it.
        if (req.method === 'POST' && ['/pair/request', '/pair/complete'].includes(req.url ?? '')) {
          if (!req.headers['content-type']?.startsWith('application/json')) throw Error('invalid')
          const body = await readBody(req, 4096)
          const result =
            req.url === '/pair/request'
              ? this.pairing.request(body, origin)
              : this.pairing.complete(body, origin)
          res.statusCode = result.pending ? 202 : 200
          res.end(
            JSON.stringify(
              result.pending ? result : { paired: true, connection: await this.store.connection() },
            ),
          )
          return
        }
        const expected = Buffer.from(`Bearer ${token}`)
        const supplied = Buffer.from(req.headers.authorization ?? '')
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
          res.writeHead(401).end('{"ok":false}')
          return
        }
        if (req.method === 'GET' && req.url === '/health') {
          await this.store.touch()
          res.end(JSON.stringify({ ok: true, capture: await this.store.capture() }))
          return
        }
        if (
          req.method !== 'POST' ||
          !['/ingest', '/status'].includes(req.url ?? '') ||
          !req.headers['content-type']?.startsWith('application/json')
        ) {
          res.writeHead(404).end('{"ok":false}')
          return
        }
        const body = await readBody(req)
        if (req.url === '/status') {
          if (!body || typeof body !== 'object') throw Error('invalid')
          const report = body as { provider: JournalProvider; status: string }
          if (!['chatgpt', 'claude'].includes(report.provider)) throw Error('invalid')
          await this.store.touch(report.provider, report.status)
          res.end('{"ok":true}')
          return
        }
        const accepted = await this.store.ingest(body)
        res.end(JSON.stringify({ conversations: accepted, created: accepted, updated: 0 }))
      })().catch((error) => {
        if (res.headersSent || res.destroyed) return
        res
          .writeHead(error instanceof Error && error.message === 'paused' ? 409 : 400)
          .end('{"ok":false}')
      })
    })
    server.headersTimeout = 5000
    server.requestTimeout = 15000
    server.maxConnections = 8
    return await new Promise<boolean>((resolve) => {
      server.once('error', () => {
        this.ready = false
        server.close()
        resolve(false)
      })
      server.listen(this.port, '127.0.0.1', () => {
        const address = server.address()
        if (address && typeof address !== 'string') this.port = address.port
        this.server = server
        this.ready = true
        resolve(true)
      })
    })
  }
  close() {
    this.ready = false
    this.server?.closeAllConnections()
    this.server?.close()
    this.server = null
  }
}

async function readBody(req: IncomingMessage, maxBytes = 4 * 1024 * 1024): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw Error('too-large')
    chunks.push(bytes)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
