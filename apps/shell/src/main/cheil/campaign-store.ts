/**
 * Cheil fork: campaign history on disk (plan item 2).
 *
 *   <root>/<folder>/campaign.json    the card, made and last-changed times
 *   <root>/<folder>/timeline.jsonl   one event per line, oldest first
 *   <root>/<folder>/캠페인 이력.md    written on request: card and timeline for a person
 *
 * The root is "Cheil 캠페인" in the person's Documents (the shell decides).
 * A campaign's id is its folder name; every call resolves it under the root
 * again and refuses anything that is not one plain folder name there. Writes
 * to one campaign run one after another. No Electron import: the tests run
 * this on a temp folder.
 */
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  CHEIL_FIELDS,
  EMPTY_CHEIL_CARD,
  cheilBudgetText,
  type CheilCampaignCard,
} from '../../../../../packages/ui/src/cheil-fields'
import {
  CAMPAIGN_EVENT_KINDS,
  type CampaignCardChange,
  type CampaignDetail,
  type CampaignEvent,
  type CampaignEventKind,
  type CampaignResult,
  type CampaignSummary,
} from '../../shared/cheil-campaign-api'

export const CAMPAIGN_FILE = 'campaign.json'
export const TIMELINE_FILE = 'timeline.jsonl'
export const HISTORY_FILE = '캠페인 이력.md'

/** longest card values (characters) */
const NAME_MAX = 100
const SHORT_MAX = 200
const LONG_MAX = 1_000
/** longest note or event line */
const TEXT_MAX = 2_000
/** most events read back for a campaign (the newest kept) */
const TIMELINE_MAX = 2_000
/** longest folder name made from a card */
const FOLDER_MAX = 80

const CARD_KEYS = Object.keys(EMPTY_CHEIL_CARD) as Array<keyof CheilCampaignCard>
const LONG_KEYS = new Set<keyof CheilCampaignCard>(['target', 'kpi'])
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** the card's labels: the common blanks' own, and the period's two ends */
export const CARD_LABELS: Record<keyof CheilCampaignCard, string> = {
  ...(Object.fromEntries(
    CHEIL_FIELDS.filter((f) => f.key in EMPTY_CHEIL_CARD).map((f) => [f.key, f.label]),
  ) as Record<Exclude<keyof CheilCampaignCard, 'start' | 'end'>, string>),
  start: '시작일',
  end: '종료일',
}

export interface CampaignStoreDeps {
  /** the campaigns root; made on the first campaign */
  root(): string
  /** write a whole file so a crash leaves the old one or the new one */
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  now(): Date
}

const fail = (reason: 'not-found' | 'invalid' | 'failed') => ({ ok: false as const, reason })

function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** A card from the screen, cleaned; null when it cannot be kept */
export function cleanCard(raw: unknown): CheilCampaignCard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const card = { ...EMPTY_CHEIL_CARD }
  for (const key of CARD_KEYS) {
    const value = input[key]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') return null
    const text = LONG_KEYS.has(key)
      ? value.replace(/\r\n?/g, '\n').trim()
      : value.replace(/\s+/g, ' ').trim()
    const max = key === 'campaign' ? NAME_MAX : LONG_KEYS.has(key) ? LONG_MAX : SHORT_MAX
    if (text.length > max) return null
    card[key] = text
  }
  if (!card.campaign) return null
  for (const key of ['start', 'end'] as const) {
    if (card[key] && !isValidDate(card[key])) return null
  }
  if (card.start && card.end && card.start > card.end) return null
  return card
}

/** A folder name made from a card: client - campaign, no path or reserved characters */
export function campaignFolderName(card: CheilCampaignCard): string {
  const title = card.client ? `${card.client} - ${card.campaign}` : card.campaign
  let name = title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, FOLDER_MAX)
    .replace(/[. ]+$/, '')
  // Windows device names cannot be folders
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = `${name} 캠페인`
  return name || '캠페인'
}

/** A plain folder name under the root, never a path */
export function isCampaignId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= 200 &&
    id === basename(id) &&
    !/[\\/]/.test(id) &&
    id !== '.' &&
    id !== '..' &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f]/.test(id)
  )
}

interface CampaignFile {
  format: 'cheil-campaign'
  version: 1
  card: CheilCampaignCard
  createdAt: string
  updatedAt: string
}

function readCampaignFile(text: string): CampaignFile | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const file = parsed as Partial<CampaignFile>
  if (file.format !== 'cheil-campaign') return null
  // a card edited by hand keeps what can be read; an unreadable one is skipped
  const card = cleanCard(file.card)
  if (!card) return null
  const createdAt = typeof file.createdAt === 'string' ? file.createdAt : ''
  const updatedAt = typeof file.updatedAt === 'string' ? file.updatedAt : createdAt
  return { format: 'cheil-campaign', version: 1, card, createdAt, updatedAt }
}

function readEvent(line: string): CampaignEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const e = parsed as Partial<CampaignEvent>
  if (typeof e.at !== 'string' || typeof e.text !== 'string') return null
  if (!CAMPAIGN_EVENT_KINDS.includes(e.kind as CampaignEventKind)) return null
  const event: CampaignEvent = { at: e.at, kind: e.kind as CampaignEventKind, text: e.text }
  if (Array.isArray(e.changes)) {
    event.changes = e.changes.filter(
      (c): c is CampaignCardChange =>
        !!c &&
        CARD_KEYS.includes(c.field) &&
        typeof c.from === 'string' &&
        typeof c.to === 'string',
    )
  }
  if (Array.isArray(e.files)) event.files = e.files.filter((f) => typeof f === 'string')
  if (typeof e.due === 'string' && isValidDate(e.due)) event.due = e.due
  return event
}

function parseTimeline(text: string): CampaignEvent[] {
  const events: CampaignEvent[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const event = readEvent(line)
    if (event) events.push(event)
  }
  return events.slice(-TIMELINE_MAX)
}

/** The card fields that differ, in card order */
export function cardChanges(
  before: CheilCampaignCard,
  after: CheilCampaignCard,
): CampaignCardChange[] {
  return CARD_KEYS.filter((key) => before[key] !== after[key]).map((field) => ({
    field,
    from: before[field],
    to: after[field],
  }))
}

const shown = (field: keyof CheilCampaignCard, value: string) =>
  !value ? '(비어 있음)' : field === 'budget' ? cheilBudgetText(value) : value

/** "총예산 5억 원 → 6억 원, 타깃 …" */
export function cardChangeText(changes: readonly CampaignCardChange[]): string {
  const parts = changes.map(
    (c) => `${CARD_LABELS[c.field]} ${shown(c.field, c.from)} → ${shown(c.field, c.to)}`,
  )
  return `카드 수정: ${parts.join(', ')}`.slice(0, TEXT_MAX)
}

const EVENT_LABELS: Record<CampaignEventKind, string> = {
  created: '만듦',
  card: '카드',
  note: '메모',
  fill: '채우기',
  document: '문서',
  mail: '메일',
  check: '점검',
  revise: '수정 반영',
  task: '할 일',
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, '<br>') || ' '

/** "캠페인 이력.md": the card as a table, then the timeline, for a person to read or hand over */
export function historyMarkdown(detail: CampaignDetail): string {
  const { card } = detail
  const lines = [`# ${card.client ? `${card.client} · ` : ''}${card.campaign}`, '']
  lines.push('| 항목 | 내용 |', '| --- | --- |')
  for (const key of CARD_KEYS)
    lines.push(`| ${CARD_LABELS[key]} | ${cell(shown(key, card[key]))} |`)
  lines.push('', `## 타임라인 (${detail.timeline.length}건)`, '')
  for (const event of detail.timeline) {
    const when = localTime(event.at)
    const due = event.due ? ` (마감 ${event.due})` : ''
    const files = event.files?.length ? ` — ${event.files.join(', ')}` : ''
    lines.push(
      `- ${when} · **${EVENT_LABELS[event.kind]}** ${event.text.replace(/\n/g, ' ')}${due}${files}`,
    )
  }
  lines.push(
    '',
    `_Cheil 기획 오피스가 ${localTime(new Date().toISOString())}에 만든 파일. 이력의 원본은 같은 폴더의 ${TIMELINE_FILE}._`,
    '',
  )
  return lines.join('\n')
}

/** "2026-10-25 16:40" in this PC's time zone */
export function localTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function createCampaignStore(deps: CampaignStoreDeps) {
  const locks = new Map<string, Promise<unknown>>()
  const encoder = new TextEncoder()

  /** one write at a time per campaign */
  function serial<T>(id: string, work: () => Promise<T>): Promise<T> {
    const previous = locks.get(id) ?? Promise.resolve()
    const next = previous.then(work, work)
    const settled = next.then(
      () => undefined,
      () => undefined,
    )
    locks.set(id, settled)
    void settled.then(() => {
      if (locks.get(id) === settled) locks.delete(id)
    })
    return next
  }

  const folderOf = (id: string) => join(deps.root(), id)

  async function readCampaign(id: string): Promise<CampaignFile | null> {
    if (!isCampaignId(id)) return null
    try {
      return readCampaignFile(await readFile(join(folderOf(id), CAMPAIGN_FILE), 'utf8'))
    } catch {
      return null
    }
  }

  async function readTimeline(id: string): Promise<CampaignEvent[]> {
    try {
      return parseTimeline(await readFile(join(folderOf(id), TIMELINE_FILE), 'utf8'))
    } catch {
      return []
    }
  }

  async function writeCampaign(id: string, file: CampaignFile): Promise<void> {
    await deps.writeFile(
      join(folderOf(id), CAMPAIGN_FILE),
      encoder.encode(`${JSON.stringify(file, null, 2)}\n`),
    )
  }

  async function appendEvent(id: string, event: CampaignEvent): Promise<void> {
    await appendFile(join(folderOf(id), TIMELINE_FILE), `${JSON.stringify(event)}\n`, 'utf8')
  }

  async function detailOf(id: string): Promise<CampaignDetail | null> {
    const file = await readCampaign(id)
    if (!file) return null
    const timeline = await readTimeline(id)
    return {
      id,
      card: file.card,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      last: timeline[timeline.length - 1] ?? null,
      events: timeline.length,
      timeline,
    }
  }

  const nowIso = () => deps.now().toISOString()

  /** Add one event to a campaign that exists; the card's "last changed" moves with it */
  async function record(
    id: string,
    event: Omit<CampaignEvent, 'at'>,
  ): Promise<CampaignResult<{ campaign: CampaignDetail }>> {
    if (!isCampaignId(id)) return fail('not-found')
    const text = event.text.replace(/\r\n?/g, '\n').trim().slice(0, TEXT_MAX)
    if (!text || !CAMPAIGN_EVENT_KINDS.includes(event.kind)) return fail('invalid')
    return serial(id, async () => {
      const file = await readCampaign(id)
      if (!file) return fail('not-found')
      const at = nowIso()
      try {
        await appendEvent(id, { ...event, text, at })
        await writeCampaign(id, { ...file, updatedAt: at })
      } catch {
        return fail('failed')
      }
      const campaign = await detailOf(id)
      return campaign ? { ok: true as const, campaign } : fail('failed')
    })
  }

  return {
    folderOf(id: string): string | null {
      return isCampaignId(id) ? folderOf(id) : null
    },

    async list(): Promise<CampaignResult<{ campaigns: CampaignSummary[] }>> {
      let entries: Array<{ name: string; isDirectory(): boolean }>
      try {
        entries = await readdir(deps.root(), { withFileTypes: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, campaigns: [] }
        return fail('failed')
      }
      const campaigns: CampaignSummary[] = []
      for (const entry of entries) {
        if (!entry.isDirectory() || !isCampaignId(entry.name)) continue
        const detail = await detailOf(entry.name)
        if (!detail) continue
        const { timeline: _timeline, ...summary } = detail
        campaigns.push(summary)
      }
      const when = (c: CampaignSummary) => c.last?.at ?? c.updatedAt
      campaigns.sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0))
      return { ok: true, campaigns }
    },

    async create(raw: unknown): Promise<CampaignResult<{ campaign: CampaignDetail }>> {
      const card = cleanCard(raw)
      if (!card) return fail('invalid')
      const base = campaignFolderName(card)
      try {
        await mkdir(deps.root(), { recursive: true })
      } catch {
        return fail('failed')
      }
      // a folder of its own: "<name>", then "<name> (2)", ...
      let id = ''
      for (let n = 1; n <= 99 && !id; n++) {
        const candidate = n === 1 ? base : `${base} (${n})`
        try {
          await mkdir(folderOf(candidate))
          id = candidate
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return fail('failed')
        }
      }
      if (!id) return fail('failed')
      const at = nowIso()
      try {
        await writeCampaign(id, {
          format: 'cheil-campaign',
          version: 1,
          card,
          createdAt: at,
          updatedAt: at,
        })
        await appendEvent(id, {
          at,
          kind: 'created',
          text: `캠페인을 만들었습니다: ${card.campaign}`,
        })
      } catch {
        return fail('failed')
      }
      const campaign = await detailOf(id)
      return campaign ? { ok: true, campaign } : fail('failed')
    },

    async get(id: unknown): Promise<CampaignResult<{ campaign: CampaignDetail }>> {
      if (!isCampaignId(id)) return fail('not-found')
      const campaign = await detailOf(id)
      return campaign ? { ok: true, campaign } : fail('not-found')
    },

    async update(id: unknown, raw: unknown): Promise<CampaignResult<{ campaign: CampaignDetail }>> {
      if (!isCampaignId(id)) return fail('not-found')
      const card = cleanCard(raw)
      if (!card) return fail('invalid')
      return serial(id, async () => {
        const file = await readCampaign(id)
        if (!file) return fail('not-found')
        const changes = cardChanges(file.card, card)
        if (changes.length > 0) {
          const at = nowIso()
          try {
            await writeCampaign(id, { ...file, card, updatedAt: at })
            await appendEvent(id, { at, kind: 'card', text: cardChangeText(changes), changes })
          } catch {
            return fail('failed')
          }
        }
        const campaign = await detailOf(id)
        return campaign ? { ok: true as const, campaign } : fail('failed')
      })
    },

    async note(id: unknown, text: unknown): Promise<CampaignResult<{ campaign: CampaignDetail }>> {
      if (!isCampaignId(id)) return fail('not-found')
      if (typeof text !== 'string' || text.length > TEXT_MAX) return fail('invalid')
      return record(id, { kind: 'note', text })
    },

    record,

    /** Write "캠페인 이력.md" into the folder; its path, for the shell to open */
    async writeHistory(id: unknown): Promise<CampaignResult<{ path: string }>> {
      if (!isCampaignId(id)) return fail('not-found')
      const campaign = await detailOf(id)
      if (!campaign) return fail('not-found')
      const path = join(folderOf(id), HISTORY_FILE)
      try {
        await deps.writeFile(path, encoder.encode(historyMarkdown(campaign)))
      } catch {
        return fail('failed')
      }
      return { ok: true, path }
    },
  }
}

export type CampaignStore = ReturnType<typeof createCampaignStore>
