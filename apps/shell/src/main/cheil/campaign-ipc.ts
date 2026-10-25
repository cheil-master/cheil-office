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
  type CampaignTask,
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
    campaignId: string,
  ): Promise<boolean>
  /** the local day as YYYY-MM-DD (the documents' 작성일) */
  today(): string
  /**
   * Plan item 3: the campaign and template title of an editor tab a set
   * opened (the shell keeps the map while the tab lives); null for any other
   */
  campaignOfSender(sender: unknown): { id: string; title: string } | null
}

const refused: CampaignResult = { ok: false, reason: 'not-found' }

/** most to-dos one mail adds, and the longest task, owner */
const TASKS_MAX = 20
const TASK_MAX = 300
const OWNER_MAX = 60
const DUE_RE = /^\d{4}-\d{2}-\d{2}$/

/** The to-dos the screen sent, checked; null when unusable */
export function campaignTasksOf(raw: unknown): CampaignTask[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > TASKS_MAX) return null
  const tasks: CampaignTask[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const { task, owner, due } = entry as Record<string, unknown>
    if (typeof task !== 'string' || !task.trim() || task.length > TASK_MAX) return null
    if (owner !== undefined && (typeof owner !== 'string' || owner.length > OWNER_MAX)) return null
    if (due !== undefined && due !== '' && (typeof due !== 'string' || !DUE_RE.test(due))) {
      return null
    }
    tasks.push({
      task: task.replace(/\s+/g, ' ').trim(),
      owner: typeof owner === 'string' ? owner.trim() : '',
      due: typeof due === 'string' ? due : '',
    })
  }
  return tasks
}

const count = (v: unknown, max = 1_000): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null

/** The timeline line for a fill an editor reported; null for a report that is not one */
export function campaignRecordText(title: string, raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'card') {
    const filled = count(r.filled)
    return filled === null ? null : `${title}: 캠페인 카드로 공통 칸 ${filled}개를 채움`
  }
  if (r.kind === 'fill') {
    const [total, filled, open] = [count(r.total), count(r.filled), count(r.open)]
    if (total === null || filled === null || open === null) return null
    const left = open > 0 ? `, ${open}개는 [확인 필요]` : ''
    return `${title}: 빠른 채우기 — 양식 칸 ${total}개 중 ${filled}개를 자료로 채움${left}`
  }
  return null
}

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
      const campaignId = found.campaign.id
      // the set's line goes first: each tab records its own card fill once it has loaded
      const started = await store.record(campaignId, {
        kind: 'document',
        text: `문서 세트를 엽니다: ${items.map((item) => item.title).join(', ')}`,
      })
      if (!started.ok) return started
      const failed: string[] = []
      for (const item of items) {
        const ok = await deps.openTemplate(item, cheil, campaignId).catch(() => false)
        if (!ok) failed.push(item.title)
      }
      const opened = items.length - failed.length
      const after = failed.length
        ? await store.record(campaignId, {
            kind: 'document',
            text: `열지 못한 양식: ${failed.join(', ')}`,
          })
        : await store.get(campaignId)
      if (opened === 0) return { ok: false as const, reason: 'failed' as const }
      return after.ok ? { ok: true as const, opened, campaign: after.campaign } : after
    }),
  )
  // plan item 4 → 3: to-dos the person confirmed from a pasted mail
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.addTasks,
    homeOnly(async (id: unknown, rawTasks: unknown) => {
      const tasks = campaignTasksOf(rawTasks)
      if (!tasks) return { ok: false as const, reason: 'invalid' as const }
      let last: Awaited<ReturnType<CampaignStore['record']>> | null = null
      for (const t of tasks) {
        last = await store.record(id as string, {
          kind: 'task',
          text: t.owner ? `${t.task} (담당 ${t.owner})` : t.task,
          ...(t.due ? { due: t.due } : {}),
        })
        if (!last.ok) return last
      }
      return last?.ok
        ? { ok: true as const, added: tasks.length, campaign: last.campaign }
        : { ok: false as const, reason: 'failed' as const }
    }),
  )
  // plan item 3: an editor tab a set opened reports a fill it finished; any other tab is ignored
  ipc.handle(CHEIL_CAMPAIGN_CHANNELS.record, async (event: { sender: unknown }, raw: unknown) => {
    const tab = deps.campaignOfSender(event.sender)
    if (!tab) return { ok: false, reason: 'not-found' }
    const text = campaignRecordText(tab.title, raw)
    if (!text) return { ok: false, reason: 'invalid' }
    const recorded = await store.record(tab.id, { kind: 'fill', text })
    return recorded.ok ? { ok: true } : recorded
  })
}
