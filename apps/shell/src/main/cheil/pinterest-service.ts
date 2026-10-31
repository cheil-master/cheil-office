import { analyzeReferenceImage } from './reference-image'
/** Cheil fork: isolated Pinterest browser session; no imported browser credentials or paid API. */
import { BrowserWindow, session, dialog, nativeImage, net } from 'electron'
import { moodboardStyle } from './moodboard-style'
import { getUiLang } from '@genoffice/i18n'
import { pinterestWords } from '../../renderer/src/cheil/pinterest-words'
import {
  boardsOf,
  identity,
  pinsOf,
  pinterestLoginUrl,
  pinterestVersion,
  resourcePage,
} from './pinterest-data'
import type {
  PinterestBoard,
  PinterestRequest,
  PinterestState,
} from '../../shared/cheil-pinterest-api'
export function createPinterestService() {
  let working = false
  let boardList: PinterestBoard[] = []
  let next: string | undefined
  let username = ''
  let preview:
    | { board: PinterestBoard; pins: import('../../shared/cheil-pinterest-api').PinterestPin[] }
    | undefined
  let origin = 'https://www.pinterest.com'
  let appVersion: string | undefined
  const getSession = () => {
    const s = session.fromPartition('persist:cheil-pinterest')
    s.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    s.setPermissionCheckHandler(() => false)
    return s
  }
  const connected = async () =>
    (await getSession().cookies.get({ url: 'https://www.pinterest.com' })).some(
      (c) => c.name === '_auth' && c.value === '1',
    )
  // Cheil fork: net.fetch rejects real manual redirects before exposing the response.
  // ClientRequest lets us validate each hop before following it, with the same session.
  const read = (url: string, limit = 8_000_000, headers: Record<string, string> = {}) =>
    new Promise<{ bytes: Buffer; type: string }>((resolve, reject) => {
      const webRequest = pinterestLoginUrl(url)
      const request = net.request({
        url,
        session: getSession(),
        credentials: 'include',
        redirect: 'manual',
        headers,
      })
      let done = false,
        hops = 0,
        size = 0
      let finalUrl = url
      const chunks: Buffer[] = []
      const fail = (reason = 'failed') => {
        if (done) return
        done = true
        clearTimeout(timer)
        reject(Error(reason))
        request.abort()
      }
      const timer = setTimeout(() => fail(), 60000)
      request.on('error', () => fail())
      request.on('abort', () => fail())
      request.on('redirect', (_status, _method, target) => {
        if (!webRequest || !pinterestLoginUrl(target) || ++hops > 3) {
          fail()
          return
        }
        finalUrl = target
        request.followRedirect()
      })
      request.on('response', (response) => {
        if (response.statusCode === 401 || response.statusCode === 403) {
          fail('login')
          return
        }
        if (
          response.statusCode < 200 ||
          response.statusCode >= 300 ||
          Number(response.headers['content-length']) > limit
        ) {
          fail()
          return
        }
        response.on('error', () => fail())
        response.on('aborted', () => fail())
        response.on('data', (chunk: Buffer) => {
          if (done) return
          size += chunk.length
          if (size > limit) {
            fail()
            return
          }
          chunks.push(Buffer.from(chunk))
        })
        response.on('end', () => {
          if (done) return
          done = true
          clearTimeout(timer)
          if (webRequest) origin = new URL(finalUrl).origin
          const type = response.headers['content-type']
          resolve({
            bytes: Buffer.concat(chunks),
            type: Array.isArray(type) ? (type[0] ?? '') : (type ?? ''),
          })
        })
      })
      request.end()
    })
  const resource = async (name: 'Boards' | 'BoardFeed', options: Record<string, unknown>) => {
    const source =
      name === 'Boards'
        ? `/${username}/_boards/`
        : new URL(boardList.find((b) => b.id === options.board_id)!.url).pathname
    const params = new URLSearchParams({
      source_url: source,
      data: JSON.stringify({ options, context: {} }),
    })
    const { bytes } = await read(`${origin}/resource/${name}Resource/get/?${params}`, 8_000_000, {
      Accept: 'application/json, text/javascript, */*, q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-Source-Url': source,
      'X-Pinterest-PWS-Handler':
        name === 'Boards' ? 'www/[username]/_boards.js' : 'www/[username]/[slug].js',
      Referer: `${origin}${source}`,
      ...(appVersion ? { 'X-App-Version': appVersion } : {}),
    })
    return resourcePage(JSON.parse(bytes.toString('utf8')))
  }
  const login = async () => {
    const s = getSession()
    const win = new BrowserWindow({
      width: 1050,
      height: 780,
      autoHideMenuBar: true,
      webPreferences: { session: s, sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    // This isolated remote window has no preload or Node access. Replace the local-SPA
    // navigation rule here only; all document windows keep the global lockdown.
    win.webContents.removeAllListeners('will-navigate')
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event, url) => {
      if (!pinterestLoginUrl(url)) event.preventDefault()
    })
    win.webContents.on('will-redirect', (event, url) => {
      if (!pinterestLoginUrl(url)) event.preventDefault()
    })
    win.webContents.on('did-navigate', (_event, url) => {
      if (pinterestLoginUrl(url)) origin = new URL(url).origin
    })
    const blockDownload = (event: Electron.Event) => event.preventDefault()
    s.on('will-download', blockDownload)
    await new Promise<void>((resolve, reject) => {
      let failed = false
      const timer = setTimeout(() => {
        failed = true
        win.close()
      }, 300000)
      let checking = false
      const check = async () => {
        if (checking || win.isDestroyed() || !pinterestLoginUrl(win.webContents.getURL())) return
        checking = true
        try {
          if (await connected()) {
            // An old auth flag alone must not dismiss a login or error page.
            identity((await read(`${origin}/`)).bytes.toString('utf8'))
            if (!win.isDestroyed()) win.close()
          }
        } finally {
          checking = false
        }
      }
      const cookiesChanged = (_event: Electron.Event, cookie: Electron.Cookie) => {
        if (cookie.name === '_auth') void check().catch(() => {})
      }
      s.cookies.on('changed', cookiesChanged)
      win.webContents.on('did-finish-load', () => {
        void check().catch(() => {})
      })
      win.on('closed', () => {
        clearTimeout(timer)
        s.cookies.removeListener('changed', cookiesChanged)
        s.removeListener('will-download', blockDownload)
        if (failed) reject(Error('failed'))
        else resolve()
      })
      const load = () => {
        void win.loadURL(`${origin}/login/`).catch(async (error: unknown) => {
          if (win.isDestroyed()) return
          const code = (error as { code?: string }).code ?? ''
          // A replaced navigation is not a failed login. Keep the new page alive.
          if (code === 'ERR_ABORTED') return
          const w = pinterestWords(getUiLang())
          const result = await dialog.showMessageBox(win, {
            type: 'error',
            title: 'Pinterest',
            message: w.failed,
            detail: /^ERR_[A-Z_]+$/.test(code) ? code : '',
            buttons: [w.connect, w.cancel],
            defaultId: 0,
            cancelId: 1,
          })
          if (win.isDestroyed()) return
          if (result.response === 0) load()
          else {
            failed = true
            win.close()
          }
        })
      }
      load()
    })
    await s.cookies.flushStore()
  }
  return async (req: PinterestRequest): Promise<PinterestState> => {
    if (
      ![
        'status',
        'connect',
        'disconnect',
        'boards',
        'pins',
        'more',
        'style',
        'reference',
        'references',
      ].includes(req.action)
    )
      return { connected: false, error: 'failed' }
    if (working) return { connected: await connected(), error: 'busy' }
    working = true
    try {
      if (req.action === 'disconnect') {
        preview = undefined
        await getSession().clearStorageData()
        await getSession().clearCache()
        boardList = []
        username = ''
        next = undefined
        return { connected: false }
      }
      if (req.action === 'connect') await login()
      if (!(await connected())) {
        preview = undefined
        boardList = []
        next = undefined
        username = ''
        return { connected: false, error: req.action === 'status' ? undefined : 'login' }
      }
      if (req.action === 'status' || req.action === 'connect') return { connected: true }
      if (req.action === 'references') {
        if (
          !preview ||
          preview.board.id !== req.board ||
          !Array.isArray(req.pins) ||
          req.pins.length < 1 ||
          req.pins.length > 2 ||
          new Set(req.pins).size !== req.pins.length
        )
          throw Error('changed')
        const pins = req.pins.map((id) => preview!.pins.find((p) => p.id === id && p.image))
        if (pins.some((p) => !p)) throw Error('changed')
        return {
          connected: true,
          references: {
            board: preview.board,
            pins: pins.filter((p): p is NonNullable<typeof p> => !!p),
          },
        }
      }
      if (req.action === 'reference') {
        if (!preview || preview.board.id !== req.board) throw Error('changed')
        const pin = preview.pins.find((p) => p.id === req.pin)
        if (!pin?.image) throw Error('changed')
        const bytes = Buffer.from(pin.image.split(',')[1], 'base64')
        return {
          connected: true,
          style: await analyzeReferenceImage(
            bytes,
            preview.board.name,
            `https://www.pinterest.com/pin/${pin.id}/`,
          ),
        }
      }
      if (req.action === 'style') {
        if (!preview || preview.board.id !== req.board) throw Error('changed')
        const samples: Uint8Array[] = []
        for (const pin of preview.pins) {
          if (!pin.image) continue
          const image = nativeImage.createFromDataURL(pin.image)
          if (!image.isEmpty()) samples.push(image.resize({ width: 48, height: 48 }).toBitmap())
        }
        return {
          connected: true,
          style: moodboardStyle(preview.board, samples, preview.pins.length),
        }
      }
      if (req.action === 'boards' || req.action === 'more') {
        if (req.action === 'boards') {
          preview = undefined
          const html = (await read(`${origin}/`)).bytes.toString('utf8')
          username = identity(html)
          appVersion = pinterestVersion(html)
          boardList = []
          next = undefined
        } else if (!next || !username) return { connected: true, boards: boardList, more: false }
        const page = await resource('Boards', {
          username,
          page_size: 25,
          sort: 'last_pinned_to',
          field_set_key: 'profile_grid_item',
          include_archived: true,
          privacy_filter: 'all',
          group_by: 'mix_public_private',
          filter_stories: false,
          ...(next ? { bookmarks: [next] } : {}),
        })
        const old = next
        boardList = [
          ...new Map([...boardList, ...boardsOf(page.rows)].map((b) => [b.id, b])).values(),
        ].slice(0, 1000)
        next = page.next === old || boardList.length >= 1000 ? undefined : page.next
        return { connected: true, boards: boardList, more: !!next }
      }
      if (!boardList.some((b) => b.id === req.board)) throw Error('changed')
      preview = undefined
      const page = await resource('BoardFeed', {
        board_id: req.board,
        board_url: new URL(boardList.find((b) => b.id === req.board)!.url).pathname,
        sort: 'default',
        layout: 'default',
        page_size: 30,
        field_set_key: 'react_grid_pin',
        prepend: false,
      })
      const pins = pinsOf(page.rows).slice(0, 30)
      // Preview only: bounded media, no session cookies or external URLs enter the home renderer.
      for (let i = 0; i < pins.length; i += 4) {
        await Promise.all(
          pins.slice(i, i + 4).map(async (pin) => {
            try {
              const result = await read(pin.image, 2_000_000)
              const mime = result.type.split(';')[0]
              pin.image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)
                ? `data:${mime};base64,${result.bytes.toString('base64')}`
                : ''
            } catch {
              pin.image = ''
            }
          }),
        )
      }
      preview = { board: boardList.find((b) => b.id === req.board)!, pins }
      return { connected: true, pins }
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      return {
        connected: await connected().catch(() => false),
        error: message === 'login' || message === 'changed' ? message : 'failed',
      }
    } finally {
      working = false
    }
  }
}
