/** Cheil fork: conservative local comparison; no remote calls or implicit decisions. */
import { createHash, randomUUID } from 'node:crypto'
import { catalog } from './wiki-catalog'
import type { WikiPage, WikiReview } from '../../shared/cheil-wiki-api'

export function compareWiki(source: WikiPage, target: WikiPage): WikiReview {
  if (source.body.length > 100000 || target.body.length > 100000)
    throw Error('Comparison too large')
  const lines = (body: string) =>
    body
      .split(/\r?\n/)
      .map((text, index) => ({ text, line: index + 1 }))
      .filter((l) => l.text.trim() && !/^\s*#/.test(l.text))
  const incoming = lines(source.body),
    existing = lines(target.body)
  if (incoming.length > 200) throw Error('Too many comparison items')
  const key = (text: string) =>
    /^\s*(?:[-*]\s*)?([^:：]{1,80})[:：]/.exec(text)?.[1]?.trim().toLowerCase()
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ')
  const items: WikiReview['items'] = []
  for (const line of incoming) {
    if (items.some((i) => normalize(i.after) === normalize(line.text))) continue
    const exact = existing.find((l) => normalize(l.text) === normalize(line.text))
    const matches = key(line.text) ? existing.filter((l) => key(l.text) === key(line.text)) : []
    const match = matches.length === 1 ? matches[0] : undefined
    const tentative = /검토|미정|제안|예정|가능 여부|보류|tentative|propos|consider|pending/i.test(
      line.text,
    )
    const confirmed = /확정|결정|승인|confirmed|approved|decided/i.test(line.text)
    const kind = exact
      ? 'duplicate'
      : match
        ? tentative
          ? 'supplement'
          : confirmed
            ? 'decision'
            : 'conflict'
        : 'new'
    items.push({
      id: randomUUID(),
      kind,
      before: exact?.text ?? match?.text ?? '',
      after: line.text,
      line: line.line,
      replace: !!match && !tentative,
      status: 'pending',
      history: [],
    })
  }
  return {
    id: randomUUID(),
    sourceId: source.id,
    sourceTitle: source.title,
    sourceVersion: source.version,
    targetId: target.id,
    targetTitle: target.title,
    targetVersion: target.version,
    createdAt: new Date().toISOString(),
    revision: 0,
    items,
  }
}
export async function reviews(root: string): Promise<WikiReview[]> {
  return catalog(root, (db) => {
    db.exec('CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,value TEXT NOT NULL)')
    return db
      .prepare('SELECT value FROM reviews ORDER BY rowid DESC')
      .all()
      .map((r) => JSON.parse(String(r.value)) as WikiReview)
  })
}
export async function saveReview(root: string, review: WikiReview) {
  await catalog(root, (db) => {
    db.exec('CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,value TEXT NOT NULL)')
    db.prepare(
      'INSERT INTO reviews VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
    ).run(review.id, JSON.stringify(review))
  })
}
export const reviewFingerprint = (source: WikiPage, target: WikiPage) =>
  createHash('sha256')
    .update(source.id + source.version + target.id + target.version)
    .digest('hex')
