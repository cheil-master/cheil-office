/**
 * Cheil fork (plan item 13): the person's own templates, the Word,
 * PowerPoint and Excel files in "Cheil 양식" (next to "Cheil 캠페인" in
 * Documents; the shell decides). A report the person adds is copied in byte
 * for byte under a name not taken yet; the copy is what turns into the
 * template, never the person's original. The screen names a template by its
 * file name only; every call resolves it under the root again. No Electron.
 */
import { constants } from 'node:fs'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { campaignDocumentTitle, freeFileName, isCampaignDocumentName } from './campaign-files'

export interface MyTemplate {
  /** the file name in the root */
  name: string
  /** the name without the extension */
  title: string
  /** ISO time of the last save */
  updatedAt: string
}

/** A plain document file name in the root, never a path */
export function isMyTemplateName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length <= 200 &&
    name === basename(name) &&
    !/[\\/]/.test(name) &&
    isCampaignDocumentName(name)
  )
}

export function createMyTemplates(deps: { root(): string }) {
  const pathOf = (name: unknown): string | null =>
    isMyTemplateName(name) ? join(deps.root(), name) : null

  return {
    pathOf,

    /** the templates, the last saved first; none before the folder exists */
    async list(): Promise<MyTemplate[]> {
      let names: string[]
      try {
        names = await readdir(deps.root())
      } catch {
        return []
      }
      const templates: MyTemplate[] = []
      for (const name of names.filter(isMyTemplateName)) {
        try {
          const info = await stat(join(deps.root(), name))
          if (!info.isFile()) continue
          templates.push({
            name,
            title: campaignDocumentTitle(name),
            updatedAt: info.mtime.toISOString(),
          })
        } catch {
          // gone between the listing and the look
        }
      }
      return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    /** copy a document in under its own name (" (2)" when taken); null for one that is not a document */
    async add(source: string): Promise<{ name: string; path: string } | null> {
      if (!isMyTemplateName(basename(source))) return null
      await mkdir(deps.root(), { recursive: true })
      // Cheil fork: exclusive copies also preserve files during concurrent imports on Windows.
      const taken = new Set((await readdir(deps.root())).map((name) => name.toLowerCase()))
      for (;;) {
        const name = freeFileName(basename(source), (n) => taken.has(n.toLowerCase()))
        if (!isMyTemplateName(name)) return null
        const path = join(deps.root(), name)
        try {
          await copyFile(source, path, constants.COPYFILE_EXCL)
          return { name, path }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          taken.add(name.toLowerCase())
        }
      }
    },

    /** take a template out (an added one the person cancelled) */
    async remove(name: unknown): Promise<boolean> {
      const path = pathOf(name)
      if (!path) return false
      await rm(path, { force: true })
      return true
    },
  }
}

export type MyTemplates = ReturnType<typeof createMyTemplates>
