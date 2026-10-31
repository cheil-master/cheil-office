/** Cheil fork: Markdown is the source of truth. No network, Electron or credentials. */
import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  lstat,
  rename,
  writeFile,
  unlink,
} from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative } from 'node:path'
import { catalog, syncCatalog, saveKnowledge, saveJob, getJobs } from './wiki-catalog'
import { wikiTypes } from '../../shared/cheil-wiki-api'
import type { WikiKnowledge, WikiJob } from '../../shared/cheil-wiki-api'
import { compareWiki, reviews, saveReview, reviewFingerprint } from './wiki-review'
import { searchWiki } from '../../shared/wiki-search'
import type { WikiExtraction, WikiPage, WikiReply, WikiRequest } from '../../shared/cheil-wiki-api'
import { KNOWLEDGE_EXTENSIONS } from './knowledge'

const MAX_BODY = 1_000_000
const MAX_FILE = 128 * 1024 * 1024
const idOk = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v)
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')
class WikiFailure extends Error {
  constructor(readonly reason: 'invalid' | 'not-found' | 'conflict' | 'empty') {
    super(reason)
  }
}
export interface WikiDeps {
  root(): string
  readText(path: string): Promise<string | WikiExtraction | null>
  campaignExists(id: string): Promise<boolean>
  now?(): string
}
export function createWikiStore(deps: WikiDeps) {
  let tail: Promise<unknown> = Promise.resolve()
  const cache = new Map<string, { stamp: string; page: WikiPage }>()
  const now = () => deps.now?.() ?? new Date().toISOString()
  const root = () => deps.root()
  async function folder(name: string) {
    const base = root()
    await mkdir(base, { recursive: true })
    const path = join(base, name)
    await mkdir(path, { recursive: true })
    const rel = relative(await realpath(base), await realpath(path))
    if (rel.startsWith('..') || isAbsolute(rel)) throw new WikiFailure('invalid')
    return path
  }
  async function pathOf(kind: 'source' | 'page', id: string) {
    if (!idOk(id)) throw new WikiFailure('invalid')
    const path = join(await folder(kind === 'source' ? 'sources' : 'pages'), `${id}.md`)
    const info = await lstat(path).catch(() => null)
    if (info?.isSymbolicLink()) throw new WikiFailure('invalid')
    return path
  }
  function decode(raw: string, id: string, kind: 'source' | 'page'): WikiPage | null {
    try {
      const m = /^---\r?\ncheil: (.+)\r?\n---\r?\n\r?\n?/.exec(raw)
      if (!m) return null
      const meta = JSON.parse(m[1]!)
      if (
        meta.id !== id ||
        meta.kind !== kind ||
        typeof meta.title !== 'string' ||
        !Array.isArray(meta.campaignIds) ||
        !Array.isArray(meta.sourceIds) ||
        !meta.sourceIds.every(idOk) ||
        !meta.campaignIds.every((id: unknown) => typeof id === 'string' && id.length <= 256) ||
        typeof meta.updatedAt !== 'string' ||
        typeof meta.createdAt !== 'string' ||
        !meta.sourceVersions ||
        typeof meta.sourceVersions !== 'object'
      )
        return null
      return { ...meta, body: raw.slice(m[0].length), version: hash(raw) }
    } catch {
      return null
    }
  }
  function encode(page: WikiPage) {
    const {
      body,
      version: _version,
      stale: _stale,
      originMissing: _originMissing,
      knowledge: _knowledge,
      ...meta
    } = page
    return `---\ncheil: ${JSON.stringify(meta)}\n---\n\n${body}`
  }
  async function preserveLegacy() {
    const dir = await folder('.migration-v1')
    const marker = join(dir, 'complete.json')
    const markerInfo = await lstat(marker).catch(() => null)
    if (markerInfo?.isSymbolicLink()) throw new WikiFailure('invalid')
    if (markerInfo) return
    const files: Array<{ name: string; hash: string }> = []
    for (const name of ['sources', 'pages', '.history', '.trash']) {
      const source = await folder(name)
      for (const entry of await readdir(source, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue
        const bytes = await readFile(join(source, entry.name))
        const target = join(dir, name.replace('.', '') + '--' + entry.name)
        const info = await lstat(target).catch(() => null)
        if (info?.isSymbolicLink()) throw new WikiFailure('invalid')
        if (!info) await writeFile(target, bytes, { flag: 'wx' })
        else if (hash(await readFile(target)) !== hash(bytes)) throw new WikiFailure('conflict')
        files.push({ name: name + '/' + entry.name, hash: hash(bytes) })
      }
    }
    await atomic(marker, JSON.stringify({ schema: 1, createdAt: now(), files }))
  }
  async function all(): Promise<WikiPage[]> {
    await preserveLegacy()
    const pages: WikiPage[] = []
    const seen = new Set<string>()
    for (const kind of ['source', 'page'] as const) {
      const dir = await folder(kind === 'source' ? 'sources' : 'pages')
      for (const entry of (await readdir(dir, { withFileTypes: true })).slice(0, 5000)) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue
        const id = entry.name.slice(0, -3)
        if (!idOk(id)) continue
        const path = await pathOf(kind, id)
        const info = await lstat(path)
        if (info.size > 6 * 1024 * 1024) continue
        const stamp = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`
        seen.add(path)
        const cached = cache.get(path)
        let page =
          cached?.stamp === stamp ? cached.page : decode(await readFile(path, 'utf8'), id, kind)
        if (!page) continue
        cache.set(path, { stamp, page })
        page = {
          ...page,
          originMissing: page.origin ? !(await lstat(page.origin).catch(() => null)) : false,
        }
        pages.push(page)
      }
    }
    for (const path of cache.keys()) if (!seen.has(path)) cache.delete(path)
    const versions = new Map(pages.map((p) => [p.id, p.version]))
    for (const page of pages)
      page.stale = page.sourceIds.some(
        (id) =>
          versions.get(id) !== page.sourceVersions?.[id] ||
          pages.some((newer) => newer.previousId === id),
      )
    await syncCatalog(root(), pages)
    return pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  async function atomic(path: string, raw: string) {
    const temp = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, raw, { encoding: 'utf8', flag: 'wx' })
      await rename(temp, path)
    } finally {
      await unlink(temp).catch(() => undefined)
    }
  }
  async function persist(page: WikiPage, previous?: WikiPage) {
    const path = await pathOf(page.kind, page.id)
    if (previous) {
      const currentRaw = await readFile(path, 'utf8')
      if (hash(currentRaw) !== previous.version) throw new WikiFailure('conflict')
      await atomic(join(await folder('.history'), `${page.id}-${previous.version}.md`), currentRaw)
    }
    const raw = encode(page)
    // Preserve exact historical bytes before switching the active Markdown file.
    await catalog(root(), (db) => {
      db.prepare('INSERT OR IGNORE INTO revisions VALUES(?,?,?)').run(page.id, hash(raw), raw)
    })
    await atomic(path, raw)
    return { ...page, version: hash(raw) }
  }
  function newPage(title: string, body: string, campaignId?: string): WikiPage {
    if (!clean(title, 200) || !clean(body, MAX_BODY) || body.length > MAX_BODY)
      throw new WikiFailure('empty')
    return {
      id: randomUUID(),
      title: clean(title, 200),
      body,
      kind: 'source',
      campaignIds: campaignId ? [campaignId] : [],
      sourceIds: [],
      sourceVersions: {},
      generated: false,
      needsReview: false,
      createdAt: now(),
      updatedAt: now(),
      version: '',
    }
  }
  async function snapshot(bytes: Buffer, ext: string) {
    const name = hash(bytes) + ext
    const path = join(await folder('raw'), name)
    const info = await lstat(path).catch(() => null)
    if (info?.isSymbolicLink()) throw new WikiFailure('invalid')
    if (info) {
      if (hash(await readFile(path)) !== hash(bytes)) throw new WikiFailure('conflict')
    } else await writeFile(path, bytes, { flag: 'wx' })
    return name
  }
  async function validateKnowledge(value: WikiKnowledge, pages: WikiPage[], self?: string) {
    if (
      !value ||
      !wikiTypes.includes(value.type) ||
      !['campaign', 'brand', 'advertiser', 'common'].includes(value.reuse) ||
      !Array.isArray(value.aliases) ||
      value.aliases.length > 30 ||
      value.aliases.some((a) => typeof a !== 'string' || a.length > 200) ||
      !Array.isArray(value.relatedIds) ||
      value.relatedIds.length > 100 ||
      value.relatedIds.some((id) => id === self || !pages.some((p) => p.id === id))
    )
      throw new WikiFailure('invalid')
    return {
      type: value.type,
      reuse: value.reuse,
      aliases: [...new Set(value.aliases.map((a) => a.trim()).filter(Boolean))],
      relatedIds: [...new Set(value.relatedIds)],
      status: 'draft' as const,
    }
  }
  async function extractionSnapshot(page: WikiPage) {
    const name = page.id + '-' + hash(page.body) + '.json'
    await atomic(
      join(await folder('extracted'), name),
      JSON.stringify({ body: page.body, extraction: page.extraction, originHash: page.originHash }),
    )
    return name
  }
  async function importJob(job: WikiJob, pages: WikiPage[]) {
    job.status = 'extracting'
    job.updatedAt = now()
    await saveJob(root(), job)
    try {
      if (!job.snapshot || !/^[a-f0-9]{64}\.[a-z0-9]+$/.test(job.snapshot))
        throw new WikiFailure('invalid')
      const path = join(await folder('raw'), job.snapshot)
      if ((await lstat(path)).isSymbolicLink()) throw new WikiFailure('invalid')
      const originHash = hash(await readFile(path))
      if (!job.snapshot.startsWith(originHash + '.')) throw new WikiFailure('conflict')
      const existing = pages.find((p) => p.originHash === originHash)
      if (existing) {
        if (job.campaignId && !existing.campaignIds.includes(job.campaignId))
          Object.assign(
            existing,
            await persist(
              {
                ...existing,
                campaignIds: [...existing.campaignIds, job.campaignId],
                updatedAt: now(),
              },
              existing,
            ),
          )
        job.pageId = existing.id
        job.status = 'complete'
        await saveJob(root(), job)
        return existing
      }
      const extracted = await deps.readText(path)
      const body = typeof extracted === 'string' ? extracted : extracted?.body
      if (!body?.trim() || body.length > MAX_BODY) throw new WikiFailure('empty')
      const page = newPage(basename(job.origin, extname(job.origin)), body, job.campaignId)
      Object.assign(page, {
        origin: job.origin,
        originHash,
        snapshot: job.snapshot,
        previousId: pages.find((p) => p.origin === job.origin)?.id,
        extraction: typeof extracted === 'object' ? extracted?.extraction : undefined,
      })
      page.extractionSnapshot = await extractionSnapshot(page)
      const saved = await persist(page)
      pages.push(saved)
      job.pageId = saved.id
      job.status = 'complete'
      await saveJob(root(), job)
      return saved
    } catch (e) {
      job.status = 'failed'
      await saveJob(root(), job)
      throw e
    }
  }
  async function execute(req: WikiRequest): Promise<WikiReply> {
    if (!req || typeof req !== 'object' || typeof req.op !== 'string')
      throw new WikiFailure('invalid')
    const campaignId = 'campaignId' in req ? req.campaignId : undefined
    if (
      campaignId !== undefined &&
      (typeof campaignId !== 'string' || !(await deps.campaignExists(campaignId)))
    )
      throw new WikiFailure('invalid')
    const pages = await all()
    const scoped = campaignId ? pages.filter((p) => p.campaignIds.includes(campaignId)) : pages
    const find = (id: string) => {
      const p = scoped.find((p) => p.id === id)
      if (!p) throw new WikiFailure('not-found')
      return p
    }
    switch (req.op) {
      case 'commitSemantic': {
        if (root() !== req.expectedRoot) throw new WikiFailure('conflict')
        const source = find(req.sourceId),
          target = find(req.targetId)
        if (source.version !== req.sourceVersion || target.version !== req.targetVersion)
          throw new WikiFailure('conflict')
        if (target.kind !== 'page' || source.id === target.id) throw new WikiFailure('invalid')
        const review = {
          id: randomUUID(),
          sourceId: source.id,
          sourceTitle: source.title,
          sourceVersion: source.version,
          targetId: target.id,
          targetTitle: target.title,
          targetVersion: target.version,
          createdAt: now(),
          revision: 0,
          items: req.items,
        }
        await saveReview(root(), review)
        return { ok: true, review }
      }
      case 'reviews':
        return {
          ok: true,
          reviews: (await reviews(root())).filter(
            (r) =>
              scoped.some((p) => p.id === r.targetId) && scoped.some((p) => p.id === r.sourceId),
          ),
        }
      case 'compare': {
        const source = find(req.sourceId),
          target = find(req.targetId)
        if (source.id === target.id || target.kind !== 'page') throw new WikiFailure('invalid')
        const fingerprint = reviewFingerprint(source, target)
        const old = (await reviews(root())).find(
          (r) =>
            r.fingerprint === fingerprint ||
            (r.sourceId === source.id &&
              r.sourceVersion === source.version &&
              r.targetId === target.id &&
              r.targetVersion === target.version),
        )
        if (old) return { ok: true, review: old }
        const review = compareWiki(source, target)
        review.fingerprint = fingerprint
        await saveReview(root(), review)
        return { ok: true, review }
      }
      case 'reviewItem': {
        const review = (await reviews(root())).find((r) => r.id === req.reviewId)
        if (!review) throw new WikiFailure('not-found')
        const source = find(review.sourceId),
          target = find(review.targetId)
        const item = review.items.find((i) => i.id === req.itemId)
        if (!item || !['apply', 'hold', 'reject'].includes(req.action))
          throw new WikiFailure('invalid')
        const marker = review.id + ':' + item.id
        // A completed file write can be recovered after interruption before DB finalization.
        if (target.appliedReviews?.includes(marker) && item.status !== 'applied') {
          item.status = 'applied'
          review.targetVersion = target.version
          review.revision++
          item.history.push({ action: 'apply-recovered', at: now(), version: target.version })
          await saveReview(root(), review)
          return { ok: true, review, page: target }
        }
        if (
          review.revision !== req.revision ||
          item.status === 'applied' ||
          item.status === 'rejected'
        )
          throw new WikiFailure('conflict')
        if (req.action !== 'apply') {
          item.status = req.action === 'hold' ? 'held' : 'rejected'
          review.revision++
          item.history.push({ action: req.action, at: now() })
          await saveReview(root(), review)
          return { ok: true, review }
        }
        if (source.version !== review.sourceVersion || target.version !== review.targetVersion)
          throw new WikiFailure('conflict')
        const text = req.text === undefined ? item.after : req.text
        if (typeof text !== 'string' || !text.trim() || text.length > 20000)
          throw new WikiFailure('invalid')
        let body = target.body
        if (item.kind !== 'duplicate' || text !== item.after) {
          if (item.replace) {
            const parts = body.split(/\r?\n/)
            const hits = parts.map((p, i) => (p === item.before ? i : -1)).filter((i) => i >= 0)
            if (hits.length !== 1) throw new WikiFailure('conflict')
            parts[hits[0]!] = text
            body = parts.join('\n')
          } else body = body.trimEnd() + '\n\n' + text
        }
        if (body.length > MAX_BODY) throw new WikiFailure('invalid')
        const updated = await persist(
          {
            ...target,
            body,
            updatedAt: now(),
            needsReview: true,
            appliedReviews: [...(target.appliedReviews ?? []), marker],
            sourceIds: [...new Set([...target.sourceIds, source.id])],
            sourceVersions: { ...target.sourceVersions, [source.id]: source.version },
          },
          target,
        )
        item.status = 'applied'
        item.history.push({ action: 'apply', at: now(), text, version: updated.version })
        review.targetVersion = updated.version
        review.revision++
        await saveReview(root(), review)
        return { ok: true, review, page: updated }
      }
      case 'jobs':
        return { ok: true, jobs: await getJobs(root()) }
      case 'retryImport': {
        const job = (await getJobs(root())).find((j) => j.id === req.jobId)
        if (!job || (job.campaignId && !(await deps.campaignExists(job.campaignId))))
          throw new WikiFailure('invalid')
        return { ok: true, page: await importJob(job, pages) }
      }
      case 'createKnowledge': {
        const knowledge = await validateKnowledge(req.knowledge, scoped)
        if (!Array.isArray(req.sources) || req.sources.length > 100)
          throw new WikiFailure('invalid')
        for (const ref of req.sources)
          if (find(ref.id).version !== ref.version) throw new WikiFailure('conflict')
        const page = newPage(req.title, req.body, campaignId)
        page.kind = 'page'
        page.needsReview = true
        page.sourceIds = req.sources.map((s) => s.id)
        page.sourceVersions = Object.fromEntries(req.sources.map((s) => [s.id, s.version]))
        await saveKnowledge(root(), page.id, knowledge)
        return { ok: true, page: { ...(await persist(page)), knowledge } }
      }
      case 'setKnowledge': {
        const page = find(req.id)
        if (JSON.stringify(page.knowledge) !== JSON.stringify(req.expectedKnowledge))
          throw new WikiFailure('conflict')
        if (page.version !== req.expectedVersion) throw new WikiFailure('conflict')
        const knowledge = await validateKnowledge(req.knowledge, scoped, page.id)
        await saveKnowledge(root(), page.id, knowledge)
        return { ok: true, page: { ...page, knowledge } }
      }
      case 'list': {
        const query = clean(req.query, 2000)
        const hits = query ? searchWiki(scoped, query, 100) : []
        const ids = [...new Set(hits.map((h) => h.id))]
        // Literal file search still accepts broad words that AI question retrieval ignores.
        if (query && !ids.length) {
          const words = query.toLowerCase().split(/\s+/).filter(Boolean)
          ids.push(
            ...scoped
              .filter((p) =>
                words.every((w) =>
                  `${p.title}\n${p.knowledge?.aliases.join(' ') ?? ''}\n${p.body}`
                    .toLowerCase()
                    .includes(w),
                ),
              )
              .map((p) => p.id),
          )
        }

        return {
          ok: true,
          root: root(),
          pages: query ? ids.map((id) => scoped.find((p) => p.id === id)!) : scoped,
        }
      }
      case 'read':
        return { ok: true, page: find(req.id) }
      case 'addText': {
        const page = newPage(req.title, req.body, campaignId)
        page.originHash = hash(page.body)
        const same = pages.find((p) => p.originHash === page.originHash && !p.origin)
        if (same) {
          if (campaignId && !same.campaignIds.includes(campaignId))
            await persist(
              { ...same, campaignIds: [...same.campaignIds, campaignId], updatedAt: now() },
              same,
            )
          return {
            ok: true,
            results: [{ name: page.title, ok: true, id: same.id, duplicate: true }],
          }
        }
        page.snapshot = await snapshot(Buffer.from(page.body), '.txt')
        page.extractionSnapshot = await extractionSnapshot(page)
        return {
          ok: true,
          page: await persist(page),
          results: [{ name: page.title, ok: true, id: page.id }],
        }
      }
      case 'addFiles': {
        if (
          !Array.isArray(req.paths) ||
          req.paths.length > 50 ||
          req.paths.some((p) => typeof p !== 'string' || !isAbsolute(p) || p.length > 2048)
        )
          throw new WikiFailure('invalid')
        const results: NonNullable<Extract<WikiReply, { ok: true }>['results']> = []
        for (const source of req.paths) {
          const name = basename(source)
          try {
            const ext = extname(source).slice(1).toLowerCase()
            if (!(KNOWLEDGE_EXTENSIONS as readonly string[]).includes(ext)) {
              results.push({ name, ok: false, reason: 'unsupported' })
              continue
            }
            const info = await lstat(source)
            if (!info.isFile() || info.size > MAX_FILE) {
              results.push({
                name,
                ok: false,
                reason: info.size > MAX_FILE ? 'too-large' : 'unreadable',
              })
              continue
            }
            const raw = await readFile(source)
            const originHash = hash(raw)
            const same = pages.find((p) => p.originHash === originHash)
            if (same) {
              if (campaignId && !same.campaignIds.includes(campaignId)) {
                const updated = await persist(
                  { ...same, campaignIds: [...same.campaignIds, campaignId], updatedAt: now() },
                  same,
                )
                Object.assign(same, updated)
              }
              results.push({ name, ok: true, id: same.id, duplicate: true })
              continue
            }
            const job: WikiJob = {
              id: randomUUID(),
              origin: source,
              campaignId,
              status: 'queued',
              updatedAt: now(),
              snapshot: await snapshot(raw, '.' + ext),
            }
            await saveJob(root(), job)
            const saved = await importJob(job, pages)
            results.push({
              name,
              ok: true,
              id: saved.id,
              reason:
                saved.extraction &&
                (saved.extraction.unreadablePages.length || saved.extraction.truncated)
                  ? 'partial'
                  : undefined,
            })
          } catch {
            results.push({ name, ok: false, reason: 'unreadable' })
          }
        }
        return { ok: true, results }
      }
      case 'save': {
        const page = find(req.id)
        if (page.version !== req.expectedVersion) throw new WikiFailure('conflict')
        if (!clean(req.title, 200) || !clean(req.body, MAX_BODY) || req.body.length > MAX_BODY)
          throw new WikiFailure('empty')
        return {
          ok: true,
          page: await persist(
            { ...page, title: clean(req.title, 200), body: req.body, updatedAt: now() },
            page,
          ),
        }
      }
      case 'link': {
        const page = pages.find((p) => p.id === req.id)
        if (!page || typeof req.linked !== 'boolean') throw new WikiFailure('not-found')
        const ids = new Set(page.campaignIds)
        if (req.linked) ids.add(req.campaignId)
        else ids.delete(req.campaignId)
        return {
          ok: true,
          page: await persist({ ...page, campaignIds: [...ids], updatedAt: now() }, page),
        }
      }
      case 'context': {
        const query = clean(req.query, 2000)
        if (!query) throw new WikiFailure('empty')
        return { ok: true, excerpts: searchWiki(scoped, query) }
      }
      case 'reindex': {
        const page = find(req.id)
        if (page.version !== req.expectedVersion) throw new WikiFailure('conflict')
        if (!page.origin) throw new WikiFailure('invalid')
        const info = await lstat(page.origin)
        if (!info.isFile() || info.size > MAX_FILE) throw new WikiFailure('invalid')
        const bytes = await readFile(page.origin)
        const originalHash = hash(bytes)
        const rawSnapshot = await snapshot(bytes, extname(page.origin).toLowerCase())
        const extracted = await deps.readText(join(await folder('raw'), rawSnapshot))
        if (originalHash !== hash(await readFile(page.origin))) throw new WikiFailure('conflict')
        const body = typeof extracted === 'string' ? extracted : extracted?.body
        if (!body?.trim() || body.length > MAX_BODY) throw new WikiFailure('empty')
        return {
          ok: true,
          page: await persist(
            {
              ...page,
              body,
              extraction: typeof extracted === 'object' ? extracted?.extraction : undefined,
              originHash: originalHash,
              snapshot: rawSnapshot,
              extractionSnapshot: await extractionSnapshot({
                ...page,
                body,
                originHash: originalHash,
                extraction: typeof extracted === 'object' ? extracted?.extraction : undefined,
              }),
              updatedAt: now(),
            },
            page,
          ),
        }
      }
      case 'saveAnswer': {
        if (!Array.isArray(req.sources) || !req.sources.length || req.sources.length > 6)
          throw new WikiFailure('invalid')
        for (const ref of req.sources)
          if (find(ref.id).version !== ref.version) throw new WikiFailure('conflict')
        const page = newPage(req.title, req.body, campaignId)
        Object.assign(page, {
          kind: 'page',
          generated: true,
          needsReview: true,
          sourceIds: req.sources.map((s) => s.id),
          sourceVersions: Object.fromEntries(req.sources.map((s) => [s.id, s.version])),
        })
        return { ok: true, page: await persist(page) }
      }
      case 'history': {
        find(req.id)
        return {
          ok: true,
          versions: (await readdir(await folder('.history')))
            .filter((n) => n.startsWith(`${req.id}-`) && n.endsWith('.md'))
            .map((n) => n.slice(37, -3))
            .filter((n) => /^[a-f0-9]{64}$/.test(n)),
        }
      }
      case 'restore': {
        const current = find(req.id)
        if (current.version !== req.expectedVersion) throw new WikiFailure('conflict')
        if (!/^[a-f0-9]{64}$/.test(req.version)) throw new WikiFailure('invalid')
        const path = join(await folder('.history'), `${req.id}-${req.version}.md`)
        if ((await lstat(path)).isSymbolicLink()) throw new WikiFailure('invalid')
        const raw = await readFile(path, 'utf8')
        const old = decode(raw, req.id, current.kind)
        if (!old) throw new WikiFailure('invalid')
        return {
          ok: true,
          page: await persist(
            { ...old, campaignIds: current.campaignIds, updatedAt: now() },
            current,
          ),
        }
      }
      case 'trash': {
        const page = find(req.id)
        if (page.version !== req.expectedVersion) throw new WikiFailure('conflict')
        await rename(
          await pathOf(page.kind, page.id),
          join(await folder('.trash'), `${page.id}-${Date.now()}.md`),
        )
        return { ok: true }
      }
      default:
        throw new WikiFailure('invalid')
    }
  }
  return {
    // Main-only write: retain history and reject edits/root switches made during OCR.
    applyOcr(
      expected: WikiPage,
      replacements: Array<{ page: number; text: string }>,
    ): Promise<WikiReply> {
      const run = tail
        .then(async (): Promise<WikiReply> => {
          const current = (await all()).find((p) => p.id === expected.id)
          if (!current || current.version !== expected.version || !current.extraction)
            return { ok: false, reason: 'conflict' }
          let body = current.body
          for (const r of replacements) {
            const pattern = new RegExp(
              '(^|\\n)## PDF ' + r.page + ' \\([^\\n]*\\)\\n[\\s\\S]*?(?=\\n## PDF \\d+ \\(|$)',
            )
            if (!pattern.test(body)) return { ok: false, reason: 'conflict' }
            body = body.replace(
              pattern,
              (_match, prefix) => prefix + '## PDF ' + r.page + ' (Azure OCR)\n' + r.text + '\n',
            )
          }
          if (body.length > MAX_BODY) return { ok: false, reason: 'invalid' }
          const completed = replacements.map((r) => r.page)
          return {
            ok: true,
            page: await persist(
              {
                ...current,
                body,
                needsReview: true,
                updatedAt: now(),
                extraction: {
                  ...current.extraction,
                  cloudPages: [
                    ...new Set([...(current.extraction.cloudPages ?? []), ...completed]),
                  ].sort((a, b) => a - b),
                  unreadablePages: current.extraction.unreadablePages.filter(
                    (p) => !completed.includes(p),
                  ),
                },
              },
              current,
            ),
          }
        })
        .catch((): WikiReply => ({ ok: false, reason: 'failed' }))
      tail = run
      return run
    },
    switchRoot(change: () => Promise<void>): Promise<WikiReply> {
      const run = tail
        .then(async () => {
          await change()
          cache.clear()
          return execute({ op: 'list' })
        })
        .catch((): WikiReply => ({ ok: false, reason: 'failed' }))
      tail = run
      return run
    },
    request(req: WikiRequest): Promise<WikiReply> {
      const run = tail
        .then(() => execute(req))
        .catch((e: unknown): WikiReply => ({
          ok: false,
          reason: e instanceof WikiFailure ? e.reason : 'failed',
        }))
      tail = run
      return run
    },
  }
}
