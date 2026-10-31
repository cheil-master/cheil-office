/** Cheil fork: local, forward-only web conversation journal. */
export const JOURNAL_CHANNEL = 'cheil:llm-journal'
export const JOURNAL_BRIDGE = 'aiOfficeLlmJournal'
export type JournalProvider = 'chatgpt' | 'claude'
export interface JournalEntry {
  id: string
  provider: JournalProvider
  at: number
  question: string
  answer: string
  url: string
}
export interface JournalView {
  enabled: boolean
  since: number | null
  port: number
  connectedAt: number | null
  providers: Partial<Record<JournalProvider, { at: number; status: string }>>
  days: string[]
  entries: JournalEntry[]
  ready: boolean
  pairingCode?: string | null
}
export type JournalRequest =
  | { op: 'status'; day?: string }
  | { op: 'record'; enabled: boolean }
  | { op: 'copy-connection' }
  | { op: 'pair-confirm'; code: string }
  | { op: 'extension-folder' }
  | { op: 'folder' }
  | { op: 'open'; day: string }
export type JournalReply =
  { ok: true; view: JournalView } | { ok: false; reason: 'invalid' | 'failed' }
export interface JournalApi {
  request(request: JournalRequest): Promise<JournalReply>
}
