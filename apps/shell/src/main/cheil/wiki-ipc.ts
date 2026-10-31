/** Cheil fork: home-only wiki gateway. File conversion and campaign scope stay in main. */
import type { IpcMain } from 'electron'
import type { WikiReply, WikiRequest } from '../../shared/cheil-wiki-api'
import type { createWikiAnswers } from './wiki-answer'
import type { createWikiStore } from './wiki-store'
export function registerWikiIpc(deps: {
  ipc: Pick<IpcMain, 'handle'>
  isHome(sender: unknown): boolean
  store: ReturnType<typeof createWikiStore>
  kakao?(req: WikiRequest): Promise<WikiReply>
  ocr?(req: WikiRequest): Promise<WikiReply>
  answers?: ReturnType<typeof createWikiAnswers>
  pickFiles(): Promise<string[]>
  openFolder(path: string): Promise<string>
  openExternal(url: string): Promise<void>
  root(): string
  pickRoot?(): Promise<string | null>
  setRoot?(path: string): Promise<void>
}) {
  deps.ipc.handle(
    'cheil:wiki',
    async (event: { sender: unknown }, req: WikiRequest): Promise<WikiReply> => {
      if (!deps.isHome(event.sender) || !req || typeof req !== 'object')
        return { ok: false, reason: 'invalid' }
      if (req.op === 'commitSemantic') return { ok: false, reason: 'invalid' }
      try {
        if (req.op.startsWith('kakao'))
          return deps.kakao ? await deps.kakao(req) : { ok: false, reason: 'invalid' }
        if (req.op.startsWith('ocr'))
          return deps.ocr ? await deps.ocr(req) : { ok: false, reason: 'invalid' }
        if (
          req.op === 'prepareAnswer' ||
          req.op === 'answer' ||
          req.op === 'prepareSemantic' ||
          req.op === 'runSemantic' ||
          req.op === 'semanticDismiss'
        )
          return deps.answers ? await deps.answers(req) : { ok: false, reason: 'invalid' }
        if (req.op === 'chooseRoot') {
          if (!deps.pickRoot || !deps.setRoot) return { ok: false, reason: 'invalid' }
          const folder = await deps.pickRoot()
          if (!folder) return { ok: true }
          return deps.store.switchRoot(() => deps.setRoot!(folder))
        }
        if (req.op === 'pickFiles') {
          const paths = await deps.pickFiles()
          return deps.store.request({ op: 'addFiles', paths, campaignId: req.campaignId })
        }
        if (req.op === 'openFolder' || req.op === 'openObsidian') {
          const ready = await deps.store.request({ op: 'list' })
          if (!ready.ok) return ready
          if (req.op === 'openFolder')
            return (await deps.openFolder(deps.root()))
              ? { ok: false, reason: 'failed' }
              : { ok: true }
          await deps.openExternal(`obsidian://open?path=${encodeURIComponent(deps.root())}`)
          return { ok: true }
        }
        return await deps.store.request(req)
      } catch {
        return { ok: false, reason: 'failed' }
      }
    },
  )
}
