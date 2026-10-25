/**
 * Cheil fork: campaign history (plan item 2).
 *
 * A campaign is a folder of its own under "Cheil 캠페인" in the person's
 * Documents: `campaign.json` holds the card (what is typed once for the whole
 * campaign: name, client, period, budget, target, KPI, ...) and
 * `timeline.jsonl` the history, one event per line. The home's "내 캠페인"
 * lists them; opening one shows its card and timeline.
 *
 * The screen names a campaign by its folder name only; the main process finds
 * the folder under the campaigns root and never takes a path from the screen.
 */
import type { CheilCampaignCard } from '../../../../packages/ui/src/cheil-fields'

export type { CheilCampaignCard }

export const CHEIL_CAMPAIGN_CHANNELS = {
  list: 'cheil:campaigns-list',
  create: 'cheil:campaign-create',
  get: 'cheil:campaign-get',
  update: 'cheil:campaign-update',
  note: 'cheil:campaign-note',
  openFolder: 'cheil:campaign-open-folder',
  openHistory: 'cheil:campaign-open-history',
} as const

/** What happened, for the timeline's mark and wording */
export type CampaignEventKind =
  /** the campaign was made */
  | 'created'
  /** card fields changed (`changes` lists them) */
  | 'card'
  /** a person's note */
  | 'note'
  /** a template was filled for this campaign (plan item 3 onward) */
  | 'fill'
  /** a document was saved into the campaign folder */
  | 'document'
  /** a mail draft was made */
  | 'mail'
  /** the pre-send check ran */
  | 'check'
  /** a client's change request was applied */
  | 'revise'
  /** a to-do with a due date, read from a pasted mail */
  | 'task'

export const CAMPAIGN_EVENT_KINDS: readonly CampaignEventKind[] = [
  'created',
  'card',
  'note',
  'fill',
  'document',
  'mail',
  'check',
  'revise',
  'task',
]

export interface CampaignCardChange {
  field: keyof CheilCampaignCard
  from: string
  to: string
}

export interface CampaignEvent {
  /** ISO time */
  at: string
  kind: CampaignEventKind
  /** one line a person reads */
  text: string
  /** card changes, for `card` */
  changes?: CampaignCardChange[]
  /** file names in the campaign folder the event is about */
  files?: string[]
  /** a task's due day (YYYY-MM-DD) */
  due?: string
}

export interface CampaignSummary {
  /** the campaign's folder name under the campaigns root */
  id: string
  card: CheilCampaignCard
  createdAt: string
  updatedAt: string
  /** the newest timeline event */
  last: CampaignEvent | null
  events: number
}

export interface CampaignDetail extends CampaignSummary {
  /** oldest first */
  timeline: CampaignEvent[]
}

export type CampaignFailReason =
  /** no campaign by that id */
  | 'not-found'
  /** the card or note is not acceptable (no campaign name, a bad date, too long) */
  | 'invalid'
  /** the disk refused */
  | 'failed'

export type CampaignResult<T = object> =
  ({ ok: true } & T) | { ok: false; reason: CampaignFailReason }

export interface CheilCampaignApi {
  list(): Promise<CampaignResult<{ campaigns: CampaignSummary[] }>>
  create(card: CheilCampaignCard): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  get(id: string): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  /** the whole card; only fields that differ go into the timeline */
  update(id: string, card: CheilCampaignCard): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  note(id: string, text: string): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  /** the campaign's folder in the file manager */
  openFolder(id: string): Promise<CampaignResult>
  /** write "캠페인 이력.md" (card and timeline) into the folder and open it in a tab */
  openHistory(id: string): Promise<CampaignResult>
}

export const CHEIL_CAMPAIGN_BRIDGE_KEY = 'aiOfficeCheilCampaigns'
