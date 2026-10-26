/**
 * Cheil fork (the person's request of 10-26): "내 지식 베이스" — the app as the
 * hub of a personal knowledge base in the Obsidian vault.
 *
 *   put in material (files or pasted text) → Markdown → sorted by itself into
 *   Cheil/지식/<광고주>/<종류>/<제목>.md → searched inside the vault
 *
 * Sorting is rules on this PC, no model: the advertiser is the longest known
 * name found in the material (the campaign cards' clients, and the folders the
 * person already has under Cheil/지식 — moving a note into a new folder in
 * Obsidian teaches the app that name), else '미분류'; the kind comes from words
 * in the file name and text. Search reads every note in the vault, on this PC.
 * Nothing here sends anything anywhere. No Electron.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type {
  KnowledgeAddResult,
  KnowledgeAdded,
  KnowledgeHit,
  KnowledgeOverview,
  KnowledgeSearchResult,
} from '../../shared/cheil-campaign-api'
import { obsidianNoteName, obsidianText, OBSIDIAN_ROOT } from './obsidian'

/** the knowledge base's folder in the vault */
export const KNOWLEDGE_DIR = '지식'
export const UNSORTED = '미분류'

/** the files the knowledge base takes (what file-parse reads as text) */
export const KNOWLEDGE_EXTENSIONS = [
  'docx',
  'doc',
  'pptx',
  'xlsx',
  'xls',
  'csv',
  'pdf',
  'hwp',
  'hwpx',
  'odt',
  'md',
  'txt',
  'html',
  'htm',
] as const
const EXT_SET = new Set<string>(KNOWLEDGE_EXTENSIONS)

/** most files one drop takes, longest pasted text, most notes search reads */
export const ADD_MAX = 50
export const TEXT_MAX = 200_000
export const SEARCH_FILES_MAX = 5_000
const NOTE_BYTES_MAX = 2 * 1024 * 1024
const RESULTS_MAX = 30
const SNIPPET_CHARS = 140

/** kind → the words that name it, checked in this order (file name first, then text) */
const KINDS: Array<[string, RegExp]> = [
  ['메일', /메일|e-?mail|보낸\s*사람|받는\s*사람|from:|subject:|^제목\s*:/im],
  ['회의록', /회의|미팅|meeting|minutes/i],
  ['견적', /견적|미디어\s*플랜|media\s*plan|CPM|CPC|CPV|단가/i],
  ['보고서', /보고서|리포트|report|결과\s*분석|실적/i],
  ['제안서', /제안|OT|RFP|브리프|brief|proposal|기획안/i],
  ['분석', /분석|경쟁|리서치|research|조사|트렌드/i],
  ['계약·정산', /계약|정산|세금계산서|invoice|청구/i],
]
export const OTHER_KIND = '기타'

export interface KnowledgeClass {
  advertiser: string
  kind: string
}

/** Sort one piece of material: its advertiser and kind */
export function classifyKnowledge(
  name: string,
  text: string,
  advertisers: readonly string[],
): KnowledgeClass {
  const known = [...new Set(advertisers.map((a) => a.trim()).filter((a) => a.length >= 2))].sort(
    (a, b) => b.length - a.length,
  )
  // the name the material mentions most; the file name counts double
  let advertiser = UNSORTED
  let best = 0
  for (const candidate of known) {
    const count = occurrences(text, candidate) + 2 * occurrences(name, candidate)
    if (count > best) {
      best = count
      advertiser = candidate
    }
  }
  const kind =
    KINDS.find(([, re]) => re.test(name))?.[0] ??
    KINDS.find(([, re]) => re.test(text.slice(0, 4000)))?.[0] ??
    OTHER_KIND
  return { advertiser, kind }
}

function occurrences(text: string, word: string): number {
  if (!word) return 0
  const lower = text.toLowerCase()
  const needle = word.toLowerCase()
  let count = 0
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
    count++
  }
  return count
}

const yamlValue = (v: string) => JSON.stringify(v)

/** One knowledge note */
export function knowledgeNote(input: {
  title: string
  source: string
  advertiser: string
  kind: string
  text: string
  added: string
}): string {
  return [
    '---',
    `source: ${yamlValue(input.source)}`,
    `advertiser: ${yamlValue(input.advertiser)}`,
    `kind: ${yamlValue(input.kind)}`,
    `added: ${yamlValue(input.added)}`,
    `tags: [cheil/knowledge, ${yamlValue(`cheil/${input.kind}`)}]`,
    '---',
    '',
    `# ${input.title}`,
    '',
    obsidianText(input.text),
    '',
  ].join('\n')
}

/** A pasted text's title: its subject line, else its first line */
export function pastedTitle(text: string): string {
  const subject = /^\s*(?:제목|subject)\s*:\s*(.+)$/im.exec(text)?.[1]
  const first =
    text
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? ''
  const title = (subject ?? first).replace(/\s+/g, ' ').trim().slice(0, 40)
  return title || '메모'
}

export interface KnowledgeDeps {
  /** the vault folder, null when none is set */
  vault(): Promise<string | null>
  /** a document's text; null when it cannot be read (DRM, a password, a broken file) */
  readText(path: string): Promise<string | null>
  /** the advertisers the person works with (the campaign cards' clients) */
  advertisers(): Promise<string[]>
  /** the local time as the notes show it */
  now(): string
}

const toPosix = (p: string) => p.split(sep).join('/')

/** The paths the screen sent for a drop, checked; null when unusable */
export function knowledgePathsOf(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > ADD_MAX) return null
  const paths: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || !entry || entry.length > 2048 || !isAbsolute(entry)) {
      return null
    }
    paths.push(entry)
  }
  return paths
}

export function createKnowledgeBase(deps: KnowledgeDeps) {
  /** parsed notes, kept while their file is unchanged */
  const cache = new Map<string, { mtimeMs: number; body: string }>()

  async function folderNames(root: string): Promise<string[]> {
    const dir = join(root, OBSIDIAN_ROOT, KNOWLEDGE_DIR)
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    return entries.filter((e) => e.isDirectory() && e.name !== UNSORTED).map((e) => e.name)
  }

  async function advertisersFor(root: string): Promise<string[]> {
    const fromCards = await deps.advertisers().catch(() => [])
    return [...fromCards, ...(await folderNames(root))]
  }

  /** a note path free for this source: the same source is written over, another gets "(2)" */
  async function notePath(folder: string, title: string, source: string): Promise<string> {
    const base = obsidianNoteName(title)
    for (let n = 1; n < 100; n++) {
      const path = join(folder, `${n === 1 ? base : `${base} (${n})`}.md`)
      const existing = await readFile(path, 'utf8').catch(() => null)
      if (existing === null) return path
      if (existing.includes(`source: ${yamlValue(source)}`)) return path
    }
    return join(folder, `${base} (${Date.now()}).md`)
  }

  async function write(
    root: string,
    input: { name: string; title: string; source: string; text: string },
  ): Promise<KnowledgeAdded> {
    const sorted = classifyKnowledge(input.name, input.text, await advertisersFor(root))
    const folder = join(
      root,
      OBSIDIAN_ROOT,
      KNOWLEDGE_DIR,
      obsidianNoteName(sorted.advertiser),
      obsidianNoteName(sorted.kind),
    )
    try {
      await mkdir(folder, { recursive: true })
      const path = await notePath(folder, input.title, input.source)
      await writeFile(path, knowledgeNote({ ...input, ...sorted, added: deps.now() }), 'utf8')
      return { name: input.name, ok: true, note: toPosix(relative(root, path)), ...sorted }
    } catch {
      return { name: input.name, ok: false, reason: 'failed' }
    }
  }

  return {
    /** files dropped or picked: each read, turned into Markdown and sorted */
    async addFiles(paths: string[]): Promise<KnowledgeAddResult> {
      const root = await deps.vault()
      if (!root) return { vault: false, added: [] }
      const added: KnowledgeAdded[] = []
      for (const path of paths.slice(0, ADD_MAX)) {
        const name = basename(path)
        const ext = extname(name).slice(1).toLowerCase()
        if (!EXT_SET.has(ext)) {
          added.push({ name, ok: false, reason: 'unsupported' })
          continue
        }
        const info = await stat(path).catch(() => null)
        if (!info?.isFile()) {
          added.push({ name, ok: false, reason: 'unreadable' })
          continue
        }
        const text = await deps.readText(path).catch(() => null)
        if (text === null) {
          added.push({ name, ok: false, reason: 'unreadable' })
          continue
        }
        if (!text.trim()) {
          added.push({ name, ok: false, reason: 'empty' })
          continue
        }
        added.push(
          await write(root, {
            name,
            title: name.slice(0, name.length - ext.length - 1),
            source: path,
            text,
          }),
        )
      }
      return { vault: true, added }
    },

    /** a mail or memo pasted in */
    async addText(raw: unknown): Promise<KnowledgeAddResult> {
      const root = await deps.vault()
      if (!root) return { vault: false, added: [] }
      const text = typeof raw === 'string' ? raw.slice(0, TEXT_MAX) : ''
      const title = pastedTitle(text)
      if (!text.trim()) return { vault: true, added: [{ name: title, ok: false, reason: 'empty' }] }
      return {
        vault: true,
        added: [
          await write(root, { name: title, title, source: `붙여 넣은 글 ${deps.now()}`, text }),
        ],
      }
    },

    /** every note in the vault that holds the query's words, the best first */
    async search(raw: unknown): Promise<KnowledgeSearchResult> {
      const root = await deps.vault()
      if (!root) return { vault: false, hits: [], notes: 0 }
      const query = typeof raw === 'string' ? raw.trim().slice(0, 200) : ''
      const words = [
        ...new Set(
          query
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.toLowerCase()),
        ),
      ]
      const files = await listNotes(root)
      if (!words.length) return { vault: true, hits: [], notes: files.length }
      const scored: Array<KnowledgeHit & { score: number }> = []
      for (const path of files) {
        const body = await readNote(path)
        if (!body) continue
        const title = basename(path, '.md')
        const folder = toPosix(relative(root, dirname(path)))
        const lower = `${title}\n${folder}\n${body}`.toLowerCase()
        const matched = words.filter((w) => lower.includes(w))
        if (!matched.length) continue
        const hitsInText = matched.reduce((sum, w) => sum + Math.min(occurrences(lower, w), 20), 0)
        const inTitle = matched.filter((w) => title.toLowerCase().includes(w)).length
        scored.push({
          note: toPosix(relative(root, path)),
          title,
          folder,
          snippet: snippetOf(body, matched),
          matched,
          score: matched.length * 1000 + inTitle * 50 + hitsInText,
        })
      }
      scored.sort((a, b) => b.score - a.score)
      return {
        vault: true,
        notes: files.length,
        hits: scored.slice(0, RESULTS_MAX).map(({ score: _score, ...hit }) => hit),
      }
    },

    /** a note's full path, only when it is a Markdown file inside the vault */
    async notePathOf(raw: unknown): Promise<string | null> {
      const root = await deps.vault()
      if (!root || typeof raw !== 'string' || !raw.toLowerCase().endsWith('.md')) return null
      const full = resolve(root, raw)
      const rel = relative(root, full)
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
      const info = await stat(full).catch(() => null)
      return info?.isFile() ? full : null
    },

    /** how many notes the knowledge folder holds, per advertiser and kind */
    async overview(): Promise<KnowledgeOverview> {
      const root = await deps.vault()
      if (!root) return { vault: null, groups: [] }
      const base = join(root, OBSIDIAN_ROOT, KNOWLEDGE_DIR)
      const groups = []
      for (const adv of await readdir(base, { withFileTypes: true }).catch(() => [])) {
        if (!adv.isDirectory()) continue
        const kinds = []
        for (const kind of await readdir(join(base, adv.name), { withFileTypes: true }).catch(
          () => [],
        )) {
          if (!kind.isDirectory()) continue
          const notes = (await readdir(join(base, adv.name, kind.name)).catch(() => []))
            .filter((n) => n.toLowerCase().endsWith('.md'))
            .map((n) => `${OBSIDIAN_ROOT}/${KNOWLEDGE_DIR}/${adv.name}/${kind.name}/${n}`)
            .sort()
          if (notes.length) kinds.push({ kind: kind.name, notes })
        }
        if (kinds.length) groups.push({ advertiser: adv.name, kinds })
      }
      groups.sort((a, b) =>
        a.advertiser === UNSORTED
          ? 1
          : b.advertiser === UNSORTED
            ? -1
            : a.advertiser.localeCompare(b.advertiser, 'ko'),
      )
      return { vault: root, groups }
    },
  }

  async function listNotes(root: string): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: string): Promise<void> => {
      if (out.length >= SEARCH_FILES_MAX) return
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (out.length >= SEARCH_FILES_MAX) return
        // Obsidian's own settings and trash are not notes
        if (entry.name.startsWith('.')) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) await walk(path)
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(path)
      }
    }
    await walk(root)
    return out
  }

  /** a note's text without its front matter; '' when it cannot be read */
  async function readNote(path: string): Promise<string> {
    const info = await stat(path).catch(() => null)
    if (!info || info.size > NOTE_BYTES_MAX) return ''
    const known = cache.get(path)
    if (known && known.mtimeMs === info.mtimeMs) return known.body
    const text = await readFile(path, 'utf8').catch(() => '')
    const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '')
    cache.set(path, { mtimeMs: info.mtimeMs, body })
    return body
  }
}

/** a short piece of the note around its first matched word */
export function snippetOf(body: string, words: string[]): string {
  const flat = body
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = flat.toLowerCase()
  const at = Math.min(
    ...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0),
    Number.POSITIVE_INFINITY,
  )
  if (!Number.isFinite(at)) return flat.slice(0, SNIPPET_CHARS)
  const start = Math.max(0, at - 40)
  const piece = flat.slice(start, start + SNIPPET_CHARS)
  return `${start > 0 ? '…' : ''}${piece}${start + SNIPPET_CHARS < flat.length ? '…' : ''}`
}

export type KnowledgeBase = ReturnType<typeof createKnowledgeBase>
