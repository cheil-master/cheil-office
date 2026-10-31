/** Cheil fork: local extracts only; no model calls, credentials or raw transcript archive. */
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWriteFile } from '../atomic-write'
import type { JournalEntry, JournalProvider, JournalView } from '../../shared/cheil-journal-api'

export const JOURNAL_PORT = 41871
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
type Interval = { start: number; end: number | null }
interface State {
  version: 1
  token: string
  intervals: Interval[]
}
interface Message {
  role: string
  content: string
  createdAt: number
  externalId?: string
}
interface Conversation {
  externalId: string
  metadata?: { url?: string }
  messages: Message[]
}
const digest = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 28)

export function journalDay(at: number): string {
  return new Date(at + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** An extract, not a claim that a model inferred understanding or a verified outcome. */
export function journalExtract(text: string, limit: number): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s*[#>*-]+\s*/gm, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= limit) return plain
  const prefix = plain.slice(0, limit - 1)
  const boundary = Math.max(
    prefix.lastIndexOf('. '),
    prefix.lastIndexOf('다. '),
    prefix.lastIndexOf('。'),
  )
  return `${boundary > limit / 2 ? prefix.slice(0, boundary + 1) : prefix}…`
}

function validUrl(provider: JournalProvider, id: string, raw: unknown): string {
  const fallback =
    provider === 'chatgpt'
      ? `https://chatgpt.com/c/${encodeURIComponent(id)}`
      : `https://claude.ai/chat/${encodeURIComponent(id)}`
  if (typeof raw !== 'string') return fallback
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
      return fallback
    if (
      provider === 'chatgpt' &&
      url.hostname === 'chatgpt.com' &&
      /^\/c\/[\w-]+$/.test(url.pathname)
    )
      return url.href
    if (
      provider === 'claude' &&
      url.hostname === 'claude.ai' &&
      /^\/chat\/[\w-]+$/.test(url.pathname)
    )
      return url.href
  } catch {
    /* The generated source URL is used instead. */
  }
  return fallback
}

function markdown(day: string, entries: JournalEntry[]): string {
  const safe = (value: string) =>
    value
      .replace(/[<>\\]/g, '')
      .replaceAll('[', '')
      .replaceAll(']', '')
      .replace(/\r?\n/g, ' ')
  return [
    '---',
    'type: llm-journal',
    `date: ${day}`,
    'timezone: Asia/Seoul',
    'summary: local-extract',
    '---',
    '',
    `# ${day} · LLM 업무 일지`,
    '',
    '> 기록 모드가 켜진 동안의 질문과 답변을 짧게 발췌한 기록입니다. 이해·해결·검증 여부를 추정하지 않습니다.',
    '',
    ...entries.flatMap((entry) => [
      `## ${new Date(entry.at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} · ${entry.provider === 'chatgpt' ? 'ChatGPT' : 'Claude'}`,
      '',
      `- 질문: ${safe(entry.question)}`,
      `- 답변 요지(발췌): ${safe(entry.answer)}`,
      `- [원본 대화](${entry.url})`,
      '',
    ]),
  ].join('\n')
}

export class JournalStore {
  private state: State | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private connectedAt: number | null = null
  private providers: JournalView['providers'] = {}
  constructor(
    readonly root: string,
    private now = () => Date.now(),
  ) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.catch(() => {})
    return next
  }
  private async load(): Promise<State> {
    if (this.state) return this.state
    await mkdir(join(this.root, 'days'), { recursive: true })
    try {
      const raw = JSON.parse(await readFile(join(this.root, 'state.json'), 'utf8')) as State
      if (
        raw.version !== 1 ||
        !/^[a-f0-9]{64}$/.test(raw.token) ||
        !Array.isArray(raw.intervals) ||
        raw.intervals.some(
          (i) =>
            !Number.isFinite(i.start) ||
            (i.end !== null && (!Number.isFinite(i.end) || i.end < i.start)),
        )
      )
        throw Error('invalid')
      this.state = raw
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Invalid journal state; existing data was preserved', { cause: error })
      this.state = { version: 1, token: randomBytes(32).toString('hex'), intervals: [] }
      await this.saveState()
    }
    return this.state!
  }
  private async saveState() {
    await atomicWriteFile(join(this.root, 'state.json'), Buffer.from(JSON.stringify(this.state)))
  }
  async connection() {
    const state = await this.load()
    return { port: JOURNAL_PORT, token: state.token }
  }
  async capture() {
    const state = await this.load()
    const current = state.intervals.at(-1)
    return { enabled: current?.end === null, since: current?.end === null ? current.start : null }
  }
  async setEnabled(enabled: boolean) {
    return this.serial(async () => {
      const state = await this.load()
      const current = state.intervals.at(-1)
      if (enabled && current?.end !== null) state.intervals.push({ start: this.now(), end: null })
      if (!enabled && current?.end === null) current.end = Math.max(current.start, this.now())
      await this.saveState()
    })
  }
  async touch(provider?: JournalProvider, status = 'ok') {
    this.connectedAt = this.now()
    if (provider)
      this.providers[provider] = {
        at: this.now(),
        status: ['ok', 'signed-out', 'failed', 'syncing'].includes(status) ? status : 'failed',
      }
  }
  private async readDay(day: string): Promise<JournalEntry[]> {
    if (!DAY_RE.test(day)) throw Error('Invalid day')
    try {
      const entries = JSON.parse(await readFile(join(this.root, 'days', `${day}.json`), 'utf8'))
      if (!Array.isArray(entries)) throw Error('Invalid journal day')
      return entries as JournalEntry[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }
  async view(day = journalDay(this.now()), ready = true): Promise<JournalView> {
    await this.queue
    const capture = await this.capture()
    const days = (await readdir(join(this.root, 'days')))
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.slice(0, 10))
      .sort()
      .reverse()
    return {
      ...capture,
      port: JOURNAL_PORT,
      connectedAt: this.connectedAt,
      providers: this.providers,
      days,
      entries: await this.readDay(day),
      ready,
    }
  }
  pathOf(day: string) {
    if (!DAY_RE.test(day)) throw Error('Invalid day')
    return join(this.root, 'days', `${day}.md`)
  }
  async ingest(raw: unknown): Promise<number> {
    return this.serial(async () => {
      const state = await this.load()
      if (state.intervals.at(-1)?.end !== null) throw Error('paused')
      if (!raw || typeof raw !== 'object') throw Error('invalid')
      const data = raw as Record<string, unknown>
      const provider: JournalProvider =
        data.adapter === 'chatgpt-web'
          ? 'chatgpt'
          : data.adapter === 'claude-web'
            ? 'claude'
            : (() => {
                throw Error('invalid')
              })()
      if (
        typeof data.source !== 'string' ||
        !/^(chatgpt|claude)-web(?:-[a-z0-9]{1,12})?$/.test(data.source) ||
        !data.source.startsWith(provider)
      )
        throw Error('invalid')
      if (!Array.isArray(data.conversations) || data.conversations.length > 20)
        throw Error('invalid')
      const activeAt = (at: number) =>
        Number.isFinite(at) &&
        at <= this.now() + 60_000 &&
        state.intervals.some((i) => at >= i.start && (i.end === null || at < i.end))
      const changed = new Map<string, JournalEntry[]>()
      let accepted = 0
      for (const rawConversation of data.conversations) {
        const conversation = rawConversation as Conversation
        if (
          !conversation ||
          typeof conversation.externalId !== 'string' ||
          !/^[\w-]{1,150}$/.test(conversation.externalId) ||
          !Array.isArray(conversation.messages) ||
          conversation.messages.length > 2000
        )
          throw Error('invalid')
        let question: Message | null = null
        let answers: string[] = []
        const flush = async () => {
          if (!question || !answers.length) return
          const day = journalDay(question.createdAt)
          const entries = changed.get(day) ?? (await this.readDay(day))
          const id = digest(
            `${data.source}:${conversation.externalId}:${question.externalId || `${question.createdAt}:${question.content}`}`,
          )
          const entry: JournalEntry = {
            id,
            provider,
            at: question.createdAt,
            question: journalExtract(question.content, 160),
            answer: journalExtract(answers.join('\n'), 280),
            url: validUrl(provider, conversation.externalId, conversation.metadata?.url),
          }
          if (!entry.question || !entry.answer) return
          const previous = entries.findIndex((item) => item.id === id)
          if (previous < 0) entries.push(entry)
          else entries[previous] = entry
          changed.set(day, entries)
          accepted++
        }
        for (const message of conversation.messages) {
          if (
            !message ||
            typeof message.content !== 'string' ||
            message.content.length > 256_000 ||
            !Number.isFinite(message.createdAt)
          )
            continue
          if (message.role === 'user') {
            await flush()
            question = activeAt(message.createdAt) ? message : null
            answers = []
          } else if (
            message.role === 'assistant' &&
            question &&
            message.createdAt >= question.createdAt &&
            activeAt(message.createdAt)
          ) {
            const interval = state.intervals.find(
              (i) =>
                question!.createdAt >= i.start && (i.end === null || question!.createdAt < i.end),
            )
            if (interval && (interval.end === null || message.createdAt < interval.end))
              answers.push(message.content)
          }
        }
        await flush()
      }
      for (const [day, entries] of changed) {
        entries.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
        await atomicWriteFile(
          join(this.root, 'days', `${day}.json`),
          Buffer.from(JSON.stringify(entries)),
        )
        await atomicWriteFile(this.pathOf(day), Buffer.from(markdown(day, entries)))
      }
      await this.touch(provider)
      return accepted
    })
  }
}
