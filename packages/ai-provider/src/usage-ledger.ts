/** Cheil fork: in-memory counters; no prompts, keys or account identifiers. */
import type { AiSubscriptionUsage, AiTokenUsage } from './types'
export interface LocalUsage {
  provider: string
  requests: number
  inputTokens: number
  outputTokens: number
  tokenReports: number
  since: number
  updatedAt: number
  windows: AiSubscriptionUsage[]
}
const ledger = new Map<string, LocalUsage>()
function entry(provider: string) {
  let row = ledger.get(provider)
  if (!row) {
    row = {
      provider,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokenReports: 0,
      since: Date.now(),
      updatedAt: Date.now(),
      windows: [],
    }
    ledger.set(provider, row)
  }
  return row
}
export function recordAiRequest(provider: string) {
  const row = entry(provider)
  row.requests++
  row.updatedAt = Date.now()
}
export function recordAiTokens(provider: string, usage: AiTokenUsage) {
  const row = entry(provider)
  const safe = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0)
  row.inputTokens += safe(usage.inputTokens)
  row.outputTokens += safe(usage.outputTokens)
  row.tokenReports++
  row.updatedAt = Date.now()
}
export function recordAiWindows(provider: string, windows: AiSubscriptionUsage[]) {
  const row = entry(provider)
  row.windows = structuredClone(windows)
  row.updatedAt = Date.now()
}
export function localAiUsage() {
  return structuredClone([...ledger.values()])
}
export function clearAiUsage(provider: string) {
  ledger.delete(provider)
}
