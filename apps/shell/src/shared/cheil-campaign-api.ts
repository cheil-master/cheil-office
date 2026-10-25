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
  openSet: 'cheil:campaign-open-set',
  addTasks: 'cheil:campaign-add-tasks',
  /** plan items 6, 7: the folder's document names, and a mail draft the person took */
  documents: 'cheil:campaign-documents',
  mailDrafted: 'cheil:campaign-mail-drafted',
  /** plan item 13: the person's own templates in "Cheil 양식" */
  myTemplates: 'cheil:my-templates-list',
  myTemplateAdd: 'cheil:my-template-add',
  myTemplateApply: 'cheil:my-template-apply',
  myTemplateDiscard: 'cheil:my-template-discard',
  myTemplateOpen: 'cheil:my-template-open',
  /** plan item 13: the campaigns as notes in the person's Obsidian vault */
  obsidian: 'cheil:obsidian-get',
  obsidianPick: 'cheil:obsidian-pick',
  obsidianClear: 'cheil:obsidian-clear',
  /** from an editor tab (plan item 3); the same name as electron-utils' CHEIL_RECORD_CHANNEL */
  record: 'cheil:campaign-record',
} as const

/**
 * Plan item 5: a card edit carried into the campaign's documents, the Word,
 * PowerPoint and Excel files in its folder. Each open one replaced the old
 * values; a closed one that held an old value was opened again and changed
 * (`reopened`: not saved yet). `answered` is false for one that did not
 * answer in time.
 */
export interface CampaignPropagation {
  tabs: Array<{
    title: string
    answered: boolean
    reopened?: boolean
    items: Array<{ label: string; from: string; to: string; count: number }>
  }>
  /** fields emptied on the card: the documents keep what they have */
  cleared: string[]
  /** closed documents that could not be read or opened again: the person checks them */
  left?: string[]
}

/** One of the person's own templates (plan item 13) */
export interface MyTemplate {
  /** the file name in "Cheil 양식" */
  name: string
  title: string
  updatedAt: string
}

/** A value of an added report that may become a blank: what the rules found */
export interface MyTemplateCandidate {
  find: string
  blank: string
  kind: 'field' | 'money' | 'rate' | 'date'
  count: number
}

/** A mail draft the person copied (plan items 6, 7), for its timeline line */
export interface CampaignMailDraft {
  /** situation, audience and strength codes (`send`, `client`, `firm`, ...) */
  situation: string
  audience: string
  strength: string
  subject: string
  /** the body, for the campaign's mail note in Obsidian (plan item 13) */
  body?: string
}

/** A to-do read from a received mail, as the person confirmed it (plan item 3) */
export interface CampaignTask {
  task: string
  /** who does it; empty when the mail does not say */
  owner: string
  /** YYYY-MM-DD, or empty */
  due: string
}

/** One template of a document set: its builtin skill, the chip's title, the waiting request */
export interface CampaignSetItem {
  /** a Cheil template skill (`cheil-brief`, ...) */
  skill: string
  title: string
  /** the request left in the new tab's composer (not sent) */
  text: string
}

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
  /** the person closed the file dialog */
  | 'canceled'
  /** the file's text could not be read (DRM, a password, a broken file) */
  | 'unreadable'

export type CampaignResult<T = object> =
  ({ ok: true } & T) | { ok: false; reason: CampaignFailReason }

export interface CheilCampaignApi {
  list(): Promise<CampaignResult<{ campaigns: CampaignSummary[] }>>
  create(card: CheilCampaignCard): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  get(id: string): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  /**
   * the whole card; only fields that differ go into the timeline. A change to
   * a common field is carried into the campaign's open documents (plan item 5)
   */
  update(
    id: string,
    card: CheilCampaignCard,
  ): Promise<CampaignResult<{ campaign: CampaignDetail; propagation?: CampaignPropagation }>>
  note(id: string, text: string): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  /** the campaign's folder in the file manager */
  openFolder(id: string): Promise<CampaignResult>
  /** write "캠페인 이력.md" (card and timeline) into the folder and open it in a tab */
  openHistory(id: string): Promise<CampaignResult>
  /**
   * Plan item 4: open each template as a new tab whose common blanks the
   * campaign's card fills (no model), with its request waiting unsent; the
   * timeline records the set. Plan item 5: each is a file in the campaign's
   * folder, saved in place.
   */
  openSet(
    id: string,
    items: CampaignSetItem[],
  ): Promise<CampaignResult<{ opened: number; campaign: CampaignDetail }>>
  /** Plan item 3: to-dos the person confirmed, each a timeline line with its due day */
  addTasks(
    id: string,
    tasks: CampaignTask[],
    /** the mail they came from, for the campaign's mail note in Obsidian (plan item 13) */
    mail?: string,
  ): Promise<CampaignResult<{ added: number; campaign: CampaignDetail }>>
  /** Plan item 13: the Obsidian vault the campaigns are written into, if any */
  obsidian(): Promise<CampaignResult<{ vault: string | null }>>
  /** Plan item 13: pick the vault folder (a dialog); every campaign is written into it */
  obsidianPick(): Promise<CampaignResult<{ vault: string | null; written: number }>>
  /** Plan item 13: stop writing into the vault (the notes already there stay) */
  obsidianClear(): Promise<CampaignResult>
  /** Plan item 13: the person's own templates, the last saved first */
  myTemplates(): Promise<CampaignResult<{ templates: MyTemplate[] }>>
  /**
   * Plan item 13: pick a report (a file dialog), copy it into "Cheil 양식"
   * and find the values that may become blanks; nothing is changed yet
   */
  myTemplateAdd(): Promise<CampaignResult<{ name: string; candidates: MyTemplateCandidate[] }>>
  /**
   * Plan item 13: open the copy in its editor and turn each value into its
   * blank everywhere (one undo step, not saved: the person checks and saves)
   */
  myTemplateApply(
    name: string,
    pairs: Array<{ find: string; blank: string }>,
  ): Promise<CampaignResult<{ answered: boolean; changed: number }>>
  /** Plan item 13: drop a copy the person decided not to keep */
  myTemplateDiscard(name: string): Promise<CampaignResult>
  /** Plan item 13: open a template itself, to edit it */
  myTemplateOpen(name: string): Promise<CampaignResult>
  /** Plan items 6, 7: the Word, PowerPoint and Excel files in the campaign's folder */
  documents(id: string): Promise<CampaignResult<{ names: string[] }>>
  /** Plan items 6, 7: a mail draft the person copied goes into the timeline */
  mailDrafted(
    id: string,
    draft: CampaignMailDraft,
  ): Promise<CampaignResult<{ campaign: CampaignDetail }>>
  /**
   * One model call (the shared `ai:chat`: the stored provider, the
   * confidentiality line), for reading to-dos out of a pasted mail and for
   * mail drafts
   */
  aiChat(request: {
    settings: unknown
    system: string
    user: string
    json: boolean
  }): Promise<{ ok: boolean; content?: string; error?: string }>
}

export const CHEIL_CAMPAIGN_BRIDGE_KEY = 'aiOfficeCheilCampaigns'
