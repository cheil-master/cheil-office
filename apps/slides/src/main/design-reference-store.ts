/** Cheil fork: Markdown is canonical; the existing template picker reads the same rules. */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  designMarkdown,
  readDesignMarkdown,
  readDesignReference,
  type DesignReferenceEntry,
} from '../shared/design-reference'
export function designReferenceStore(root: string) {
  const pathOf = (key: string) => {
    if (!/^ref-[a-f0-9-]{36}$/.test(key)) throw Error('invalid-design-key')
    return join(root, `${key}.design.md`)
  }
  const load = (key: string): DesignReferenceEntry => {
    const path = pathOf(key),
      stat = statSync(path)
    if (!stat.isFile() || stat.size > 160000) throw Error('invalid-design-reference')
    const design = readDesignMarkdown(readFileSync(path, 'utf8'))
    return { key, name: design.name, design, createdAt: stat.birthtime.toISOString() }
  }
  return {
    pathOf,
    load,
    save(value: unknown): DesignReferenceEntry {
      const design = readDesignReference(value),
        key = `ref-${randomUUID()}`
      mkdirSync(root, { recursive: true })
      writeFileSync(pathOf(key), designMarkdown(design), { flag: 'wx' })
      return load(key)
    },
    list(): DesignReferenceEntry[] {
      if (!existsSync(root)) return []
      return readdirSync(root)
        .filter((f) => /^ref-[a-f0-9-]{36}\.design\.md$/.test(f))
        .slice(0, 500)
        .flatMap((f) => {
          try {
            return [load(f.slice(0, -10))]
          } catch {
            return []
          }
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
  }
}
