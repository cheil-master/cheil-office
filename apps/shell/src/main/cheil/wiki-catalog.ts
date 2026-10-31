/** Cheil fork: operational catalog; Markdown remains authoritative for content. */
import { DatabaseSync } from 'node:sqlite'
import { lstat, mkdir, realpath } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'
import type { WikiPage, WikiJob, WikiKnowledge } from '../../shared/cheil-wiki-api'

export async function catalog<T>(root: string, run: (db: DatabaseSync) => T): Promise<T> {
  const dir = join(root, '.catalog')
  await mkdir(dir, { recursive: true })
  const rel = relative(await realpath(root), await realpath(dir))
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Unsafe catalog')
  const path = join(dir, 'wiki.sqlite')
  if ((await lstat(path).catch(() => null))?.isSymbolicLink()) throw Error('Unsafe catalog')
  const db = new DatabaseSync(path)
  try {
    db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,version TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(id TEXT NOT NULL,version TEXT NOT NULL,raw TEXT NOT NULL,PRIMARY KEY(id,version));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY,id TEXT NOT NULL,value TEXT NOT NULL,created TEXT NOT NULL);
    `)
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = run(db)
      db.exec('COMMIT')
      return result
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  } finally {
    db.close()
  }
}

export async function syncCatalog(root: string, pages: WikiPage[]) {
  return catalog(root, (db) => {
    db.exec('UPDATE documents SET active=0')
    const put = db.prepare(
      'INSERT INTO documents VALUES(?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET version=excluded.version,kind=excluded.kind,title=excluded.title,active=1',
    )
    const meta = db.prepare('SELECT value FROM metadata WHERE id=?')
    for (const p of pages) {
      put.run(p.id, p.version, p.kind, p.title)
      const row = meta.get(p.id)
      p.knowledge = row ? (JSON.parse(String(row.value)) as WikiKnowledge) : undefined
    }
    db.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run('schema', '1')
  })
}

export async function saveKnowledge(root: string, id: string, value: WikiKnowledge) {
  await catalog(root, (db) => {
    db.prepare(
      'INSERT INTO metadata VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
    ).run(id, JSON.stringify(value))
    db.prepare('INSERT INTO events(id,value,created) VALUES(?,?,?)').run(
      id,
      JSON.stringify(value),
      new Date().toISOString(),
    )
  })
}
export async function saveJob(root: string, job: WikiJob) {
  await catalog(root, (db) =>
    db
      .prepare('INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value')
      .run(job.id, JSON.stringify(job)),
  )
}
export async function getJobs(root: string): Promise<WikiJob[]> {
  return catalog(root, (db) =>
    db
      .prepare('SELECT value FROM jobs ORDER BY rowid DESC LIMIT 100')
      .all()
      .map((r) => JSON.parse(String(r.value)) as WikiJob),
  )
}
