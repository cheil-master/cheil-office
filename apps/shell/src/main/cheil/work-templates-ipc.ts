/** Cheil fork: home-only file import and reusable copies; never accept a source path from a page. */
import type { IpcMain } from 'electron'
import { link, lstat, readdir, rename, unlink } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { createMyTemplates, isMyTemplateName } from './my-templates'
import { WORK_TEMPLATE_CHANNEL, type WorkTemplateReply } from '../../shared/cheil-work-template-api'

export const WORK_TEMPLATE_MAX_BYTES = 50 * 1024 * 1024

export interface WorkTemplatesIpcDeps {
  ipc: Pick<IpcMain, 'handle'>
  isHome(sender: unknown): boolean
  root(): string
  pickDocument(): Promise<string | null>
  readText(path: string): Promise<string | null>
  openCopy(source: { path: string; fileName: string }): Promise<boolean>
  /** Cheil fork: move only the registered library copy to the system trash. */
  trashFile(path: string): Promise<void>
}

/** Cheil fork: keep the original extension and reject Windows device/path names. */
export function workTemplateName(title: unknown, original: string): string | null {
  if (typeof title !== 'string') return null
  const trimmed = title.trim()
  if (!trimmed || trimmed.length > 150 || /[. ]$/.test(trimmed)) return null
  // eslint-disable-next-line no-control-regex
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/.test(trimmed)) return null
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(trimmed)) return null
  const name = trimmed + extname(original)
  return isMyTemplateName(name) ? name : null
}

export function registerWorkTemplatesIpc(deps: WorkTemplatesIpcDeps) {
  const store = createMyTemplates({ root: deps.root })
  let working = false
  deps.ipc.handle(
    WORK_TEMPLATE_CHANNEL,
    async (event, raw: unknown): Promise<WorkTemplateReply> => {
      if (!deps.isHome(event.sender)) return { ok: false, reason: 'not-found' }
      if (!raw || typeof raw !== 'object') return { ok: false, reason: 'invalid' }
      const req = raw as { action?: unknown; name?: unknown; title?: unknown; updatedAt?: unknown }
      if (req.action === 'list') return { ok: true, templates: await store.list() }
      if (
        typeof req.action !== 'string' ||
        !['add', 'use', 'rename', 'delete'].includes(req.action)
      )
        return { ok: false, reason: 'invalid' }
      // Cheil fork: serialize file selection, use and mutations to avoid racing the same library file.
      if (working) return { ok: false, reason: 'failed' }
      working = true
      try {
        if (req.action === 'add') {
          const source = await deps.pickDocument()
          if (!source) return { ok: false, reason: 'canceled' }
          if (!isMyTemplateName(basename(source))) return { ok: false, reason: 'invalid' }
          const info = await lstat(source)
          if (!info.isFile() || info.isSymbolicLink()) return { ok: false, reason: 'invalid' }
          if (info.size > WORK_TEMPLATE_MAX_BYTES) return { ok: false, reason: 'too-large' }
          // An empty document is a valid template; an unreadable one is not.
          if ((await deps.readText(source)) === null) return { ok: false, reason: 'unreadable' }
          const added = await store.add(source)
          if (!added) return { ok: false, reason: 'failed' }
          return { ok: true, added: added.name, templates: await store.list() }
        }
        if (req.action === 'use' || req.action === 'rename' || req.action === 'delete') {
          const path = store.pathOf(req.name)
          if (!path) return { ok: false, reason: 'invalid' }
          const info = await lstat(path).catch(() => null)
          if (!info?.isFile() || info.isSymbolicLink()) return { ok: false, reason: 'not-found' }
          if (req.action !== 'use') {
            if (typeof req.updatedAt !== 'string') return { ok: false, reason: 'invalid' }
            if (req.updatedAt !== info.mtime.toISOString()) return { ok: false, reason: 'changed' }
          }
          if (req.action === 'delete') {
            await deps.trashFile(path)
            return { ok: true, templates: await store.list() }
          }
          if (req.action === 'rename') {
            const name = workTemplateName(req.title, req.name as string)
            if (!name) return { ok: false, reason: 'invalid' }
            if (name !== req.name) {
              const caseOnly =
                process.platform === 'win32' &&
                name.toLowerCase() === (req.name as string).toLowerCase()
              const taken = await readdir(deps.root())
              if (
                !caseOnly &&
                taken.some(
                  (other) => other !== req.name && other.toLowerCase() === name.toLowerCase(),
                )
              )
                return { ok: false, reason: 'exists' }
              const target = join(deps.root(), name)
              if (caseOnly) await rename(path, target)
              else {
                // Creating a link fails if the destination exists, so another file is never overwritten.
                try {
                  await link(path, target)
                } catch (error) {
                  if ((error as NodeJS.ErrnoException).code === 'EEXIST')
                    return { ok: false, reason: 'exists' }
                  throw error
                }
                try {
                  await unlink(path)
                } catch (error) {
                  await unlink(target).catch(() => undefined)
                  throw error
                }
              }
            }
            return { ok: true, templates: await store.list() }
          }
          const opened = await deps.openCopy({ path, fileName: req.name as string })
          return opened
            ? { ok: true, templates: await store.list() }
            : { ok: false, reason: 'failed' }
        }
        return { ok: false, reason: 'invalid' }
      } catch {
        return { ok: false, reason: 'failed' }
      } finally {
        working = false
      }
    },
  )
}
