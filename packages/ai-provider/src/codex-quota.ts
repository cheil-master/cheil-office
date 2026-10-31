/** Cheil fork: retain actual account limit buckets and window durations. */
export interface CodexQuotaWindow {
  bucket: string
  minutes: number | null
  usedPercent: number
  resetsAt: number | null
}
export function codexQuotaWindows(response: unknown): CodexQuotaWindow[] {
  const obj = (v: unknown): Record<string, unknown> | null =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  const root = obj(response)
  if (!root) return []
  const all = obj(root.rateLimitsByLimitId),
    fallback = obj(root.rateLimits)
  const buckets =
    all && Object.keys(all).length
      ? Object.entries(all)
      : fallback
        ? [['codex', fallback] as const]
        : []
  const windows: CodexQuotaWindow[] = []
  for (const [bucket, raw] of buckets.slice(0, 20)) {
    const limit = obj(raw)
    for (const key of ['primary', 'secondary']) {
      const win = obj(limit?.[key])
      const used = win?.usedPercent
      if (typeof used !== 'number' || !Number.isFinite(used)) continue
      const minutes = win?.windowDurationMins,
        resets = win?.resetsAt
      windows.push({
        bucket,
        minutes: typeof minutes === 'number' && minutes > 0 ? minutes : null,
        usedPercent: Math.max(0, Math.min(100, used)),
        resetsAt:
          typeof resets === 'number' && Number.isFinite(resets) && resets > 0
            ? resets * 1000
            : null,
      })
    }
  }
  return windows
}
