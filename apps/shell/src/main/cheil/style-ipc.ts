/** Cheil fork: home-only style library. The renderer never supplies file paths. */
import type { IpcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { lstat, readFile, writeFile, rm } from 'node:fs/promises'
import { readDesignMarkdown } from '../../../../slides/src/shared/design-reference'
import { designReferenceStore } from '../../../../slides/src/main/design-reference-store'
import { prepareDesignHandoff, validateDesignStart } from './design-studio'
import { extname, dirname, join } from 'node:path'
import {
  CHEIL_STYLE_CHANNEL,
  type DocumentStyle,
  type StyleDraft,
  type StyleRequest,
  type StyleReply,
  type StyleSelection,
} from '../../shared/cheil-style-api'
import { createStyleStore, readStyleDocument } from './style-store'
import { styleMarkdown } from './document-style'
import { readReferenceTemplate } from '../../shared/reference-template'
import { styleInstruction } from './style-instructions'
import { createStyleCatalog } from './style-catalog'
import { createStyledStarter, styleAttribution } from './style-starter'

export interface StyleIpcDeps {
  ipc: Pick<IpcMain, 'handle'>
  isHome(sender: unknown): boolean
  root(): string
  pickFile(extensions: string[]): Promise<string | null>
  pickSave(extension: string): Promise<string | null>
  referenceImage?(
    bytes: Uint8Array,
    name: string,
  ): Promise<{ profile: DocumentStyle; selection: StyleSelection }>
  readDraft?(path: string): Promise<string | null>
  extract(path: string): Promise<DocumentStyle | null>
  openDesign?(handoff: import('@genoffice/electron-utils/generate-handoff').GenerateHandoff): void
  openDocument(path: string): boolean
  openExternal(url: string): Promise<void>
  pinterest?: (
    req: import('../../shared/cheil-pinterest-api').PinterestRequest,
  ) => Promise<import('../../shared/cheil-pinterest-api').PinterestState>
  fetcher?: typeof fetch
}
export function registerStyleIpc(deps: StyleIpcDeps) {
  const store = createStyleStore(deps.root),
    catalog = createStyleCatalog(deps.fetcher)
  const drafts = new Map<string, StyleDraft>()
  let active = 0
  const draft = (profile: DocumentStyle, selection: StyleSelection = {}): StyleDraft => {
    if (drafts.size >= 12) drafts.delete(drafts.keys().next().value!)
    const d = { id: randomUUID(), profile, selection }
    drafts.set(d.id, d)
    return d
  }
  const current = (req: {
    draft: string
    name: string
    selection: StyleSelection
    template?: unknown
  }) => {
    const d = drafts.get(req.draft)
    if (!d) throw Error('invalid-style-draft')
    return readStyleDocument(
      styleMarkdown(
        {
          ...d.profile,
          name: req.name,
          ...(req.template !== undefined ? { template: readReferenceTemplate(req.template) } : {}),
        },
        req.selection,
      ),
    )
  }
  const saveFile = async (
    extension: string,
    content: string | Uint8Array,
    attribution?: string,
  ): Promise<{ canceled?: boolean; path?: string }> => {
    const path = await deps.pickSave(extension)
    if (!path) return { canceled: true }
    if (extname(path).toLowerCase() !== `.${extension}`) throw Error('invalid-save-extension')
    const source = attribution ? `${path}.source-${randomUUID().slice(0, 8)}.txt` : null
    if (source) await writeFile(source, attribution!, { flag: 'wx' })
    try {
      await writeFile(path, content)
    } catch (error) {
      if (source) await rm(source, { force: true })
      throw error
    }
    return { path }
  }
  deps.ipc.handle(
    CHEIL_STYLE_CHANNEL,
    async (event: { sender: unknown }, req: StyleRequest): Promise<StyleReply> => {
      if (
        !deps.isHome(event.sender) ||
        !req ||
        typeof req !== 'object' ||
        typeof req.op !== 'string'
      )
        return { ok: false, reason: 'invalid' }
      if (active >= 2) return { ok: false, reason: 'unavailable' }
      active++
      try {
        if (
          req.op === 'designList' ||
          req.op === 'designImport' ||
          req.op === 'designOpen' ||
          req.op === 'designCreate'
        ) {
          const userRoot = dirname(deps.root()),
            designs = designReferenceStore(join(userRoot, 'style-templates'))
          if (req.op === 'designImport') {
            const path = await deps.pickFile(['md'])
            if (!path) return { ok: true, canceled: true }
            const info = await lstat(path)
            if (!info.isFile() || info.size > 160000) return { ok: false, reason: 'invalid' }
            designs.save(readDesignMarkdown(await readFile(path, 'utf8')))
            return { ok: true, designs: designs.list() }
          }
          if (req.op === 'designList') return { ok: true, designs: designs.list() }
          if (req.op === 'designOpen') {
            designs.load(req.key)
            return { ok: true, opened: deps.openDocument(designs.pathOf(req.key)) }
          }
          if (!deps.openDesign) return { ok: false, reason: 'unavailable' }
          validateDesignStart(req)
          const result = req.key
            ? undefined
            : await deps.pinterest?.({
                op: 'pinterest',
                action: 'references',
                board: req.board,
                pins: req.pins,
              })
          if (!req.key && (!result?.references || result.error))
            return { ok: false, reason: 'unavailable' }
          const handoff = await prepareDesignHandoff(userRoot, req, result?.references)
          deps.openDesign(handoff)
          return { ok: true, opened: true }
        }
        if (req.op === 'pinterest') {
          if (!deps.pinterest) return { ok: false, reason: 'unavailable' }
          const pinterest = await deps.pinterest(req)
          if (
            (req.action === 'style' || req.action === 'reference') &&
            pinterest.style &&
            !pinterest.error
          ) {
            const { profile, selection } = pinterest.style
            const saved = await store.save(profile, selection)
            return {
              ok: true,
              pinterest: { connected: pinterest.connected },
              saved,
              draft: draft(saved.profile, saved.selection),
            }
          }
          return { ok: true, pinterest }
        }
        if (req.op === 'list') return { ok: true, styles: await store.list() }
        if (req.op === 'referenceImage') {
          if (!deps.referenceImage) return { ok: false, reason: 'unavailable' }
          const path = await deps.pickFile(['png', 'jpg', 'jpeg', 'webp'])
          if (!path) return { ok: true, canceled: true }
          const info = await lstat(path)
          if (!info.isFile() || info.size > 10_000_000) return { ok: false, reason: 'invalid' }
          const data = await deps.referenceImage(await readFile(path), 'Reference')
          return { ok: true, draft: draft(data.profile, data.selection) }
        }
        if (req.op === 'draftText') {
          if (!deps.readDraft) return { ok: false, reason: 'unavailable' }
          const path = await deps.pickFile(['txt', 'md', 'docx', 'pptx'])
          if (!path) return { ok: true, canceled: true }
          const text = await deps.readDraft(path)
          if (text === null || text.length > 30000) return { ok: false, reason: 'unreadable' }
          return { ok: true, text }
        }
        if (req.op === 'extract') {
          const path = await deps.pickFile(['docx', 'pptx', 'xlsx'])
          if (!path) return { ok: true, canceled: true }
          if (!/\.(docx|pptx|xlsx)$/i.test(path)) return { ok: false, reason: 'invalid' }
          const profile = await deps.extract(path)
          return profile ? { ok: true, draft: draft(profile) } : { ok: false, reason: 'unreadable' }
        }
        if (req.op === 'import') {
          const path = await deps.pickFile(['md'])
          if (!path) return { ok: true, canceled: true }
          const info = await lstat(path)
          if (!info.isFile() || info.size > 100_000) return { ok: false, reason: 'invalid' }
          const data = readStyleDocument(await readFile(path, 'utf8'))
          return { ok: true, draft: draft(data.profile, data.selection) }
        }
        if (req.op === 'load') {
          const saved = await store.load(req.id)
          return { ok: true, saved, draft: draft(saved.profile, saved.selection) }
        }
        if (req.op === 'open') {
          await store.load(req.id)
          return { ok: true, opened: deps.openDocument(store.pathOf(req.id)!) }
        }
        if (req.op === 'save') {
          const data = current(req)
          return {
            ok: true,
            saved: await store.save(data.profile, data.selection, req.id, req.version),
          }
        }
        if (req.op === 'export' || req.op === 'instruction' || req.op === 'create') {
          const data = current(req)
          if (req.op === 'instruction')
            return {
              ok: true,
              text:
                styleInstruction(styleMarkdown(data.profile, data.selection)) +
                '\n\n' +
                styleAttribution(data.profile),
            }
          if (req.op === 'export') {
            const out = await saveFile('md', styleMarkdown(data.profile, data.selection))
            return { ok: true, canceled: out.canceled }
          }
          if (req.op !== 'create') return { ok: false, reason: 'invalid' }
          const bytes = await createStyledStarter(
            data.profile,
            data.selection,
            req.format,
            req.title,
            req.body,
          )
          const out = await saveFile(req.format, bytes, styleAttribution(data.profile))
          return {
            ok: true,
            canceled: out.canceled,
            opened: out.path ? deps.openDocument(out.path) : undefined,
          }
        }
        if (req.op === 'catalogSearch')
          return { ok: true, entries: await catalog.search(req.query) }
        if (req.op === 'catalogLoad')
          return { ok: true, draft: draft(await catalog.load(req.slug)) }
        return { ok: false, reason: 'invalid' }
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        const reason =
          message === 'style-conflict'
            ? 'conflict'
            : message === 'unsafe-logo-svg'
              ? 'unsupported'
              : message.includes('public-source')
                ? 'unavailable'
                : message === 'unreadable-reference'
                  ? 'unreadable'
                  : message.startsWith('invalid-') || message.startsWith('select-')
                    ? 'invalid'
                    : 'failed'
        return { ok: false, reason }
      } finally {
        active--
      }
    },
  )
}
