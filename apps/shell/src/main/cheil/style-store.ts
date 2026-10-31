import { readReferenceTemplate } from '../../shared/reference-template'
/** Cheil fork: a versioned Markdown library. Only UUID filenames are resolved under the root. */
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { styleMarkdown } from './document-style'
import { readStyleSelection } from './style-instructions'
import type {
  DocumentStyle,
  SavedStyle,
  StyleSelection,
  StyleToken,
} from '../../shared/cheil-style-api'
const idValid = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)
const label = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 80 &&
  ![...v].some((c) => c.charCodeAt(0) < 32 || '<>`[]{}'.includes(c))
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const digest = (text: string) => createHash('sha256').update(text).digest('hex')

export function readStyleDocument(markdown: string): {
  profile: DocumentStyle
  selection: StyleSelection
} {
  const selection = readStyleSelection(markdown)
  const match = /^```json\s*\r?\n([\s\S]*?)^```\s*$/m.exec(markdown)
  const input: unknown = JSON.parse(match![1])
  if (
    !object(input) ||
    input.version !== 1 ||
    !label(input.name) ||
    !['docx', 'pptx', 'xlsx', 'catalog', 'moodboard'].includes(String(input.format))
  )
    throw Error('invalid-style')
  const tokens = (kind: string): StyleToken[] => {
    const rows = input[kind]
    if (!Array.isArray(rows) || rows.length > 40) throw Error('invalid-style')
    return rows.map((row) => {
      if (
        !object(row) ||
        !label(row.value) ||
        !Number.isInteger(row.count) ||
        Number(row.count) < 1 ||
        Number(row.count) > 10_000_000 ||
        !['direct', 'theme'].includes(String(row.basis))
      )
        throw Error('invalid-style')
      if (kind === 'colors' && !/^#[a-f0-9]{6}$/i.test(row.value)) throw Error('invalid-style')
      if (
        kind === 'sizes' &&
        (!/^\d+(?:\.\d+)?$/.test(row.value) || Number(row.value) < 4 || Number(row.value) > 200)
      )
        throw Error('invalid-style')
      return { value: row.value, count: Number(row.count), basis: row.basis as StyleToken['basis'] }
    })
  }
  const source: DocumentStyle['source'] = {}
  if (object(input.source)) {
    for (const key of ['author', 'license', 'revision'] as const)
      if (label(input.source[key])) source[key] = input.source[key]
    if (typeof input.source.sha256 === 'string' && /^[a-f0-9]{64}$/.test(input.source.sha256))
      source.sha256 = input.source.sha256
    for (const key of ['url', 'licenseUrl'] as const)
      if (typeof input.source[key] === 'string' && input.source[key].length <= 1000) {
        const url = new URL(input.source[key])
        if (url.protocol !== 'https:' || url.username || url.password)
          throw Error('invalid-style-source')
        source[key] = url.href
      }
    if (typeof input.source.modified === 'boolean') source.modified = input.source.modified
  }
  let moodboard: DocumentStyle['moodboard']
  if (input.format === 'moodboard') {
    const m = input.moodboard
    if (
      !object(m) ||
      ![m.sampledPins, m.previewPins, m.totalPins].every(
        (v) => Number.isSafeInteger(v) && Number(v) >= 0,
      ) ||
      Number(m.sampledPins) < 1 ||
      Number(m.sampledPins) > Number(m.previewPins) ||
      Number(m.previewPins) > 30 ||
      typeof m.sampledAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(m.sampledAt) ||
      !Number.isFinite(Date.parse(m.sampledAt))
    )
      throw Error('invalid-moodboard')
    moodboard = {
      sampledPins: Number(m.sampledPins),
      previewPins: Number(m.previewPins),
      totalPins: Number(m.totalPins),
      sampledAt: m.sampledAt,
    }
  }
  return {
    selection,
    profile: {
      ...(input.template !== undefined ? { template: readReferenceTemplate(input.template) } : {}),
      version: 1,
      name: input.name,
      format: input.format as DocumentStyle['format'],
      ...(moodboard ? { moodboard } : {}),
      fonts: tokens('fonts'),
      colors: tokens('colors'),
      sizes: tokens('sizes'),
      shapes: tokens('shapes'),
      warnings: Array.isArray(input.warnings)
        ? input.warnings
            .filter((v): v is string => typeof v === 'string' && /^[a-z0-9-]{1,100}$/.test(v))
            .slice(0, 30)
        : [],
      source,
    },
  }
}

export function createStyleStore(root: () => string) {
  let queue = Promise.resolve()
  const pathOf = (id: unknown) => (idValid(id) ? join(root(), `${id}.md`) : null)
  const load = async (id: string): Promise<SavedStyle> => {
    const path = pathOf(id)
    if (!path) throw Error('invalid-style-id')
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.size > 100_000)
      throw Error('invalid-style-file')
    const markdown = await readFile(path, 'utf8')
    return {
      id,
      version: digest(markdown),
      updatedAt: info.mtime.toISOString(),
      ...readStyleDocument(markdown),
    }
  }
  return {
    pathOf,
    load,
    async list(): Promise<SavedStyle[]> {
      const names = await readdir(root()).catch(() => [] as string[])
      const styles: SavedStyle[] = []
      for (const name of names
        .filter((n) => n.endsWith('.md') && idValid(n.slice(0, -3)))
        .slice(0, 500)) {
        const saved = await load(name.slice(0, -3)).catch(() => null)
        if (saved) styles.push(saved)
      }
      return styles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    save(
      profile: DocumentStyle,
      selection: StyleSelection,
      id?: string,
      version?: string,
    ): Promise<SavedStyle> {
      const task = queue.then(async () => {
        const markdown = styleMarkdown(profile, selection)
        readStyleDocument(markdown)
        if (id) {
          if (!idValid(id) || !version || (await load(id)).version !== version)
            throw Error('style-conflict')
        }
        const key = id ?? randomUUID()
        const path = pathOf(key)!
        await mkdir(root(), { recursive: true })
        if (!id) await writeFile(path, markdown, { flag: 'wx' })
        else {
          const temporary = join(root(), `.${randomUUID()}.tmp`)
          await writeFile(temporary, markdown, { flag: 'wx' })
          try {
            if ((await load(id)).version !== version) throw Error('style-conflict')
            await rename(temporary, path)
          } finally {
            await rm(temporary, { force: true })
          }
        }
        return load(key)
      })
      queue = task.then(
        () => {},
        () => {},
      )
      return task
    },
  }
}
