/** Cheil fork: bounded, inert metadata from the unofficial Pinterest web interface. */
import type { PinterestBoard, PinterestPin } from '../../shared/cheil-pinterest-api'
export const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const text = (v: unknown, n = 180) => (typeof v === 'string' ? v.slice(0, n) : '')
export function pinterestUrl(v: unknown, image = false): string {
  try {
    const u = new URL(text(v, 2000), 'https://www.pinterest.com')
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return ''
    if (image ? u.hostname !== 'i.pinimg.com' : u.hostname !== 'www.pinterest.com') return ''
    return u.href
  } catch {
    return ''
  }
}
// Cheil fork: only observed Pinterest web origins, never lookalike or arbitrary hosts.
export function pinterestLoginUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      ['www.pinterest.com', 'kr.pinterest.com'].includes(u.hostname)
    )
  } catch {
    return false
  }
}
// Cheil fork: read the site's deployment identifier; never keep a stale hard-coded header.
export function pinterestVersion(html: string): string | undefined {
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = record(JSON.parse(match[1])).appVersion
      if (typeof value === 'string' && /^[\w.-]{1,80}$/.test(value)) return value
    } catch {
      /* Unrelated JSON is ignored. */
    }
  }
  return undefined
}
export function identity(html: string): string {
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const root = record(JSON.parse(match[1]))
      const props = record(root.props)
      const initial = record(props.initialReduxState ?? root.initialReduxState)
      const session = record(initial.session)
      const context = record(root.context)
      const currentUser =
        session.isAuthenticated === true && typeof session.userId === 'string'
          ? record(record(initial.users)[session.userId])
          : {}
      const candidates = [
        context.is_authenticated === true ? record(context.user).username : undefined,
        currentUser.username,
        record(session.user).username,
        session.username,
        record(props.user).username,
      ]
      for (const value of candidates)
        if (typeof value === 'string' && /^[\w.-]{1,100}$/.test(value)) return value
    } catch {
      /* Ignore unrelated structured data. */
    }
  }
  throw Error('changed')
}
export function resourcePage(raw: unknown) {
  const r = record(raw),
    response = record(r.resource_response)
  if (response.status === 'failure' || response.error) throw Error('failed')
  const data = response.data
  const rows = Array.isArray(data) ? data : record(data).results
  if (!Array.isArray(rows)) throw Error('changed')
  const marks =
    typeof response.bookmark === 'string'
      ? [response.bookmark]
      : record(record(r.resource).options).bookmarks
  const next =
    Array.isArray(marks) &&
    typeof marks[0] === 'string' &&
    marks[0] !== '-end-' &&
    !marks[0].startsWith('Y2JOb25lO')
      ? marks[0].slice(0, 8192)
      : undefined
  return { rows: rows.slice(0, 100), next }
}
export function boardsOf(rows: unknown[]): PinterestBoard[] {
  return rows.flatMap((v) => {
    const b = record(v),
      id = text(b.id),
      url = pinterestUrl(b.url)
    return /^\d{1,30}$/.test(id) && url && text(b.name)
      ? [{ id, name: text(b.name), url, count: Math.max(0, Number(b.pin_count) || 0) }]
      : []
  })
}
export function pinsOf(rows: unknown[]): PinterestPin[] {
  return rows.flatMap((v) => {
    const p = record(v),
      images = record(p.images),
      id = text(p.id)
    const image = pinterestUrl(
      record(images['736x'] ?? images['474x'] ?? images['236x'] ?? images.orig).url,
      true,
    )
    return /^\d{1,30}$/.test(id) && image
      ? [{ id, title: text(p.title || p.grid_title || p.description), image }]
      : []
  })
}
