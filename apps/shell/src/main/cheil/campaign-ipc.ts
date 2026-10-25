/**
 * Cheil fork: the home's "내 캠페인" channels (plan item 2).
 *
 * Only the home (the shell window's own page) may call them. The screen names
 * a campaign by its folder name; the store resolves it under the campaigns
 * root again on every call. No Electron import: the shell injects the gate,
 * the folder opener and the document opener.
 */
import type { IpcMain } from 'electron'
import { CHEIL_CAMPAIGN_CHANNELS, type CampaignResult } from '../../shared/cheil-campaign-api'
import type { CampaignStore } from './campaign-store'

export interface CheilCampaignIpcDeps {
  ipc: Pick<IpcMain, 'handle'>
  store: CampaignStore
  /** true for the home page's own webContents */
  isHome(sender: unknown): boolean
  /** show a folder in the file manager; '' when it opened */
  openFolder(path: string): Promise<string>
  /** open a document in a tab; false when nothing opened */
  openDocument(path: string): boolean
}

const refused: CampaignResult = { ok: false, reason: 'not-found' }

export function registerCheilCampaignIpc(deps: CheilCampaignIpcDeps): void {
  const { ipc, store } = deps
  const homeOnly =
    <A extends unknown[], R>(handler: (...args: A) => Promise<R>) =>
    (event: { sender: unknown }, ...args: A): Promise<R | CampaignResult> =>
      deps.isHome(event.sender) ? handler(...args) : Promise.resolve(refused)

  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.list,
    homeOnly(() => store.list()),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.create,
    homeOnly((card: unknown) => store.create(card)),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.get,
    homeOnly((id: unknown) => store.get(id)),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.update,
    homeOnly((id: unknown, card: unknown) => store.update(id, card)),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.note,
    homeOnly((id: unknown, text: unknown) => store.note(id, text)),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.openFolder,
    homeOnly(async (id: unknown): Promise<CampaignResult> => {
      const found = await store.get(id)
      if (!found.ok) return found
      const folder = store.folderOf(found.campaign.id)
      if (!folder) return refused
      const error = await deps.openFolder(folder).catch(() => 'failed')
      return error ? { ok: false, reason: 'failed' } : { ok: true }
    }),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.openHistory,
    homeOnly(async (id: unknown): Promise<CampaignResult> => {
      const written = await store.writeHistory(id)
      if (!written.ok) return written
      return deps.openDocument(written.path) ? { ok: true } : { ok: false, reason: 'failed' }
    }),
  )
}
