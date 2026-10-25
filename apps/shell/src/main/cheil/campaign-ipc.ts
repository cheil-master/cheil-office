/**
 * Cheil fork: the home's "내 캠페인" channels (plan item 2).
 *
 * Only the home (the shell window's own page) may call them. The screen names
 * a campaign by its folder name; the store resolves it under the campaigns
 * root again on every call. No Electron import: the shell injects the gate,
 * the folder opener and the document opener.
 */
import type { IpcMain } from 'electron'
import { CHEIL_FILL_SKILLS } from '../../../../../packages/ui/src/cheil-fill'
import { cheilFieldValues } from '../../../../../packages/ui/src/cheil-fields'
import {
  CHEIL_CAMPAIGN_CHANNELS,
  type CampaignResult,
  type CampaignSetItem,
} from '../../shared/cheil-campaign-api'
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
  /**
   * Open a template's copy as a new tab, its request waiting unsent and the
   * card's values handed to its panel; false when it did not open
   */
  openTemplate(
    item: CampaignSetItem,
    cheil: { campaign: string; values: Record<string, string> },
  ): Promise<boolean>
  /** the local day as YYYY-MM-DD (the documents' 작성일) */
  today(): string
}

const refused: CampaignResult = { ok: false, reason: 'not-found' }

/** most templates one set opens, and the longest title and request taken */
const SET_MAX = 6
const TITLE_MAX = 100
const TEXT_MAX = 4_000

/** The set the screen asked for, checked: known Cheil templates, each once; null when unusable */
export function campaignSetItemsOf(raw: unknown): CampaignSetItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > SET_MAX) return null
  const items: CampaignSetItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const { skill, title, text } = entry as Record<string, unknown>
    if (typeof skill !== 'string' || !CHEIL_FILL_SKILLS.has(skill)) return null
    if (typeof title !== 'string' || !title.trim() || title.length > TITLE_MAX) return null
    if (typeof text !== 'string' || text.length > TEXT_MAX) return null
    if (items.some((item) => item.skill === skill)) return null
    items.push({ skill, title: title.trim(), text })
  }
  return items
}

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
  // plan item 4: the card's values are worked out here from the stored card, never taken from the page
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.openSet,
    homeOnly(async (id: unknown, rawItems: unknown) => {
      const items = campaignSetItemsOf(rawItems)
      if (!items) return { ok: false as const, reason: 'invalid' as const }
      const found = await store.get(id)
      if (!found.ok) return found
      const { card } = found.campaign
      const cheil = {
        campaign: card.campaign,
        values: Object.fromEntries(cheilFieldValues(card, deps.today())),
      }
      const opened: string[] = []
      for (const item of items) {
        if (await deps.openTemplate(item, cheil).catch(() => false)) opened.push(item.title)
      }
      if (opened.length === 0) return { ok: false as const, reason: 'failed' as const }
      const recorded = await store.record(found.campaign.id, {
        kind: 'fill',
        text: `문서 세트를 열었습니다: ${opened.join(', ')} — 캠페인 카드로 공통 칸을 채움`,
      })
      return recorded.ok
        ? { ok: true as const, opened: opened.length, campaign: recorded.campaign }
        : recorded
    }),
  )
}
