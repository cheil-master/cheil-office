/** Cheil fork: home usage dashboard without authentication material. */
export interface HomeAiUsage {
  updatedAt: number
  codex?: {
    windows: Array<{
      bucket: string
      minutes: number | null
      usedPercent: number
      resetsAt: number | null
    }>
    updatedAt: number
    error?: string
  }
  local: Array<{
    provider: string
    requests: number
    inputTokens: number
    outputTokens: number
    tokenReports: number
    since: number
    updatedAt: number
    windows: Array<{ provider: string; window: string; utilization: number; resetsAt: number }>
  }>
}
