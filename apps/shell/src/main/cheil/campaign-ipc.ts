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
import {
  CHEIL_MAIL_AUDIENCES,
  CHEIL_MAIL_SITUATIONS,
  CHEIL_MAIL_STRENGTHS,
  cheilMailAudienceName,
  cheilMailSituationName,
  cheilMailStrengthName,
  type CheilMailAudience,
  type CheilMailSituation,
  type CheilMailStrength,
} from '../../../../../packages/ui/src/cheil-mail-draft'
import {
  cheilCardChanges,
  cheilChangeCounts,
  cheilFieldValues,
  cheilPropagatePairs,
  cheilReplaceText,
  type CheilPropagatePair,
} from '../../../../../packages/ui/src/cheil-fields'
import {
  CHEIL_PROPAGATE_CHANNEL,
  CHEIL_PROPAGATED_CHANNEL,
  CHEIL_PROPAGATE_READY_CHANNEL,
} from '../../../../../packages/electron-utils/src/user-skills-channels'
import {
  CHEIL_CAMPAIGN_CHANNELS,
  type CampaignPropagation,
  type CampaignResult,
  type CampaignSetItem,
  type CampaignTask,
} from '../../shared/cheil-campaign-api'
import type { CampaignStore } from './campaign-store'
import { REOPEN_MAX } from './campaign-files'

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
   * Write a template's copy into the campaign's folder and open it in a tab,
   * its request waiting unsent and the card's values handed to its panel;
   * false when it did not open
   */
  openTemplate(
    item: CampaignSetItem,
    cheil: { campaign: string; values: Record<string, string> },
    campaignId: string,
  ): Promise<boolean>
  /** the local day as YYYY-MM-DD (the documents' 작성일) */
  today(): string
  /**
   * Plan item 3: the campaign and title of an editor tab whose document is in
   * a campaign's folder (plan item 5: the folder decides); null for any other
   */
  campaignOfSender(sender: unknown): { id: string; title: string } | null
  /** Plan item 5: the open tabs of the campaign's documents */
  campaignTabs(campaignId: string): CampaignTab[]
  /** Plan item 5: the campaign's documents no tab shows */
  closedDocuments(campaignId: string): Promise<Array<{ path: string; title: string }>>
  /** a closed document's text, to look for the old values; null when it cannot be read */
  readText(path: string): Promise<string | null>
  /** open a closed document in a tab again; null when it did not open */
  reopen(path: string): Promise<CampaignTab | null>
  /** bring the home back to the front (it lists what the change did) */
  showHome(): void
  /** Plan items 6, 7: the file names of the campaign's documents, open or not */
  documentNames(campaignId: string): Promise<string[]>
}

/** An open tab of a campaign's document: its webContents id, title, and a way to message it */
export interface CampaignTab {
  senderId: number
  title: string
  send(channel: string, payload: unknown): void
}

/** how long a tab may take to answer a card change before it is listed as not answering */
export const PROPAGATE_TIMEOUT_MS = 10_000
/** the same for a closed document opened again: it reads its file first */
export const REOPEN_TIMEOUT_MS = 30_000

const senderIdOf = (sender: unknown): number | null => {
  const id = (sender as { id?: unknown } | null)?.id
  return typeof id === 'number' ? id : null
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

const SUBJECT_MAX = 200

/** The timeline line for a mail draft the person copied; null for one that is not */
export function campaignMailText(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const { situation, audience, strength, subject } = raw as Record<string, unknown>
  if (!CHEIL_MAIL_SITUATIONS.includes(situation as CheilMailSituation)) return null
  if (!CHEIL_MAIL_AUDIENCES.includes(audience as CheilMailAudience)) return null
  if (!CHEIL_MAIL_STRENGTHS.includes(strength as CheilMailStrength)) return null
  if (typeof subject !== 'string' || subject.length > SUBJECT_MAX) return null
  const kind = [
    `${cheilMailAudienceName(audience as CheilMailAudience)}용`,
    cheilMailSituationName(situation as CheilMailSituation),
    cheilMailStrengthName(strength as CheilMailStrength),
  ].join(' · ')
  const title = subject.replace(/\s+/g, ' ').trim()
  return `메일 초안(${kind})${title ? `: ${title}` : ''}`
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
  /** plan item 5: card changes waiting for a tab's answer, by request id */
  const pending = new Map<
    string,
    { senderId: number; size: number; resolve: (counts: number[] | null) => void }
  >()
  let requests = 0
  /** plan item 5: tabs whose editor listens for card changes, by webContents id */
  const listening = new Set<number>()
  const wakers = new Map<number, Set<() => void>>()

  /** true once the tab listens; false when it did not within `ms` */
  const whenListening = (senderId: number, ms: number) =>
    new Promise<boolean>((resolve) => {
      if (listening.has(senderId)) return resolve(true)
      const waiting = wakers.get(senderId) ?? new Set<() => void>()
      wakers.set(senderId, waiting)
      const settle = (ok: boolean) => {
        clearTimeout(timer)
        waiting.delete(wake)
        if (waiting.size === 0 && wakers.get(senderId) === waiting) wakers.delete(senderId)
        resolve(ok)
      }
      const wake = () => settle(true)
      const timer = setTimeout(() => settle(false), ms)
      waiting.add(wake)
    })

  /** Send one tab the pairs once it listens; what it changed, or not answered within `ms` */
  const reach = (tab: CampaignTab, pairs: CheilPropagatePair[], ms: number, reopened = false) =>
    new Promise<CampaignPropagation['tabs'][number]>((resolve) => {
      const requestId = `p${++requests}-${tab.senderId}`
      let settled = false
      const done = (counts: number[] | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pending.delete(requestId)
        resolve({
          title: tab.title,
          answered: counts !== null,
          ...(reopened ? { reopened: true } : {}),
          items: cheilChangeCounts(pairs, counts ?? []),
        })
      }
      const timer = setTimeout(() => done(null), ms)
      pending.set(requestId, { senderId: tab.senderId, size: pairs.length, resolve: done })
      void whenListening(tab.senderId, ms).then((ok) => {
        if (!ok || settled) return done(null)
        try {
          tab.send(CHEIL_PROPAGATE_CHANNEL, { requestId, pairs })
        } catch {
          done(null)
        }
      })
    })

  /**
   * The campaign's closed documents holding an old value, opened again and
   * changed (not saved: the person checks and saves them); the ones that
   * could not be read or opened again are left for the person
   */
  const reachClosed = async (campaignId: string, pairs: CheilPropagatePair[]) => {
    const left: string[] = []
    const holding: Array<{ path: string; title: string }> = []
    const replacements = pairs.map((p) => ({ find: p.find, replace: p.to }))
    for (const doc of await deps.closedDocuments(campaignId).catch(() => [])) {
      const text = await deps.readText(doc.path).catch(() => null)
      if (text === null) left.push(doc.title)
      else if (cheilReplaceText(text, replacements).counts.some((n) => n > 0)) holding.push(doc)
    }
    const opened: CampaignTab[] = []
    for (const [i, doc] of holding.entries()) {
      const tab = i < REOPEN_MAX ? await deps.reopen(doc.path).catch(() => null) : null
      if (tab) opened.push(tab)
      else left.push(doc.title)
    }
    if (opened.length > 0) deps.showHome()
    const tabs = await Promise.all(opened.map((tab) => reach(tab, pairs, REOPEN_TIMEOUT_MS, true)))
    return { tabs, left }
  }

  /** Every document of the campaign that holds an old value: what each changed, or not answered */
  const propagate = async (campaignId: string, pairs: CheilPropagatePair[]) => {
    const [open, closed] = await Promise.all([
      Promise.all(
        deps.campaignTabs(campaignId).map((tab) => reach(tab, pairs, PROPAGATE_TIMEOUT_MS)),
      ),
      reachClosed(campaignId, pairs),
    ])
    return { tabs: [...open, ...closed.tabs], left: closed.left }
  }
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
    homeOnly(async (id: unknown, card: unknown) => {
      const before = await store.get(id)
      const updated = await store.update(id, card)
      if (!updated.ok || !before.ok) return updated
      // plan item 5: the common fields that changed go into the campaign's documents
      const { changes, cleared } = cheilCardChanges(
        before.campaign.card,
        updated.campaign.card,
        deps.today(),
      )
      if (changes.length === 0 && cleared.length === 0) return updated
      const pairs = cheilPropagatePairs(changes)
      const { tabs, left } =
        pairs.length > 0
          ? await propagate(updated.campaign.id, pairs)
          : { tabs: [], left: [] as string[] }
      let campaign = updated.campaign
      for (const tab of tabs) {
        const done = tab.items.filter((item) => item.count > 0)
        if (done.length === 0) continue
        const recorded = await store.record(campaign.id, {
          kind: 'document',
          text: `카드 변경 반영: ${tab.title} — ${done
            .map((i) => `${i.label} ${i.from || '(빈칸)'} → ${i.to} ${i.count}곳`)
            .join(', ')}${tab.reopened ? ' (닫혀 있던 문서를 열어 바꿈, 저장 전)' : ''}`,
        })
        if (recorded.ok) campaign = recorded.campaign
      }
      if (left.length > 0) {
        const recorded = await store.record(campaign.id, {
          kind: 'document',
          text: `카드 변경을 확인하지 못한 문서: ${left.join(', ')} — 직접 확인 필요`,
        })
        if (recorded.ok) campaign = recorded.campaign
      }
      return {
        ok: true as const,
        campaign,
        propagation: { tabs, cleared, ...(left.length > 0 ? { left } : {}) },
      }
    }),
  )
  // plan item 5: a tab's editor starts or stops listening for card changes
  ipc.handle(CHEIL_PROPAGATE_READY_CHANNEL, (event: { sender: unknown }, on: unknown) => {
    const senderId = senderIdOf(event.sender)
    if (senderId === null) return
    if (on !== true) {
      listening.delete(senderId)
      return
    }
    listening.add(senderId)
    for (const wake of [...(wakers.get(senderId) ?? [])]) wake()
  })
  // plan item 5: a tab answers how many places each pair changed
  ipc.handle(CHEIL_PROPAGATED_CHANNEL, (event: { sender: unknown }, raw: unknown) => {
    const answer = raw as { requestId?: unknown; counts?: unknown } | null
    const requestId = typeof answer?.requestId === 'string' ? answer.requestId : ''
    const waiting = pending.get(requestId)
    if (!waiting || waiting.senderId !== senderIdOf(event.sender)) return
    pending.delete(requestId)
    const counts = Array.isArray(answer?.counts) ? answer.counts : []
    waiting.resolve(
      waiting.size === counts.length
        ? counts.map((n) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0))
        : null,
    )
  })
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
        text: `문서 세트를 캠페인 폴더에 만들어 엽니다: ${items.map((item) => item.title).join(', ')}`,
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
  // plan items 6, 7: what a mail draft may name as attached, and the draft the person took
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.documents,
    homeOnly(async (id: unknown): Promise<CampaignResult<{ names: string[] }>> => {
      const found = await store.get(id)
      if (!found.ok) return found
      const names = await deps.documentNames(found.campaign.id).catch(() => [])
      return { ok: true, names }
    }),
  )
  ipc.handle(
    CHEIL_CAMPAIGN_CHANNELS.mailDrafted,
    homeOnly(async (id: unknown, raw: unknown) => {
      const text = campaignMailText(raw)
      if (!text) return { ok: false as const, reason: 'invalid' as const }
      return store.record(id as string, { kind: 'mail', text })
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
