/** Cheil fork: one-use, five-minute consent for exact previewed wiki excerpts only. */
import { createHash } from 'node:crypto'
import { assertCheilEgressAllowed, gradeOutbound, GRADE } from './cheil-grade'
export type CheilExcerptConsent = Readonly<{ kind: 'wiki-excerpts' }>
const grants = new WeakMap<CheilExcerptConsent, { digest: string; expires: number }>()
const digest = (system: string, user: string) =>
  createHash('sha256')
    .update(JSON.stringify([system, user]))
    .digest('hex')
export function consentForWikiExcerpts(system: string, user: string): CheilExcerptConsent {
  const verdict = gradeOutbound([system, user])
  if (verdict.pii || verdict.rule >= GRADE.TOP) throw new Error('wiki-sensitive-content')
  const token = Object.freeze({ kind: 'wiki-excerpts' as const })
  grants.set(token, { digest: digest(system, user), expires: Date.now() + 300_000 })
  return token
}
export function assertWikiEgress(
  baseUrl: string,
  system: string,
  user: string,
  consent?: CheilExcerptConsent,
) {
  const grant = consent && grants.get(consent)
  if (consent) grants.delete(consent)
  if (grant && grant.expires > Date.now() && grant.digest === digest(system, user)) {
    const verdict = gradeOutbound([system, user])
    if (!verdict.pii && verdict.rule < GRADE.TOP) return
  }
  assertCheilEgressAllowed(baseUrl, [user])
}
