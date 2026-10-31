/** Cheil fork: exact-text, home-only answer drafts; consent never becomes a setting. */
import { createSemantic } from './wiki-semantic'
import { randomUUID } from 'node:crypto'
import { gradeOutbound, GRADE } from '../../../../../packages/ai-provider/src/cheil-grade'
import {
  consentForWikiExcerpts,
  type CheilExcerptConsent,
} from '../../../../../packages/ai-provider/src/cheil-consent'
import { wikiPrompt } from '../../shared/wiki-prompt'
import type { WikiReply, WikiRequest, WikiExcerpt } from '../../shared/cheil-wiki-api'
export function createWikiAnswers(deps: {
  request(req: WikiRequest): Promise<WikiReply>
  target(
    settings: unknown,
  ): { ok: true; provider: string; local: boolean } | { ok: false; error: string }
  chat(
    request: { settings: unknown; system: string; user: string; json: boolean },
    consent: CheilExcerptConsent | undefined,
    provider: string,
  ): Promise<{ ok: boolean; content?: string; error?: string }>
}) {
  const semantic = createSemantic(deps)
  let draft: {
    id: string
    settings: unknown
    provider: string
    local: boolean
    question: string
    campaignId?: string
    excerpts: WikiExcerpt[]
    expires: number
    system: string
    user: string
  } | null = null
  return async (req: WikiRequest): Promise<WikiReply> => {
    if (req.op === 'prepareSemantic' || req.op === 'runSemantic' || req.op === 'semanticDismiss')
      return semantic(req)
    if (req.op === 'prepareAnswer') {
      draft = null
      if (
        typeof req.query !== 'string' ||
        !req.query.trim() ||
        req.query.length > 2000 ||
        JSON.stringify(req.settings ?? null).length > 100_000
      )
        return { ok: false, reason: 'invalid' }
      const target = deps.target(req.settings)
      if (!target.ok) return { ok: false, reason: 'failed', error: target.error }
      const context = await deps.request({
        op: 'context',
        query: req.query,
        campaignId: req.campaignId,
      })
      if (!context.ok) return context
      if (!context.excerpts?.length) return { ok: false, reason: 'empty' }
      const prompt = wikiPrompt(req.query, context.excerpts),
        verdict = gradeOutbound([prompt.system, prompt.user])
      const blocked = !target.local && (verdict.pii || verdict.rule >= GRADE.TOP)
      const id = randomUUID()
      if (!blocked)
        draft = {
          id,
          settings: req.settings,
          provider: target.provider,
          local: target.local,
          question: req.query,
          campaignId: req.campaignId,
          excerpts: context.excerpts,
          expires: Date.now() + 300_000,
          ...prompt,
        }
      return {
        ok: true,
        preview: {
          id,
          question: req.query,
          excerpts: context.excerpts,
          provider: target.provider,
          local: target.local,
          blocked,
          labels: [
            ...new Set([
              ...verdict.hits.map((h) => h.label),
              ...verdict.combos.map((c) => c.label),
            ]),
          ],
        },
      }
    }
    if (req.op === 'answer') {
      const current = draft
      if (!current || current.id !== req.draftId || current.expires < Date.now())
        return { ok: false, reason: 'conflict' }
      if (!current.local && req.approved !== true) return { ok: false, reason: 'consent-required' }
      draft = null
      for (const ref of current.excerpts) {
        const r = await deps.request({ op: 'read', id: ref.id, campaignId: current.campaignId })
        if (!r.ok || r.page?.version !== ref.version) return { ok: false, reason: 'conflict' }
      }
      const consent = current.local
        ? undefined
        : consentForWikiExcerpts(current.system, current.user)
      const reply = await deps.chat(
        { settings: current.settings, system: current.system, user: current.user, json: false },
        consent,
        current.provider,
      )
      return reply.ok && reply.content
        ? { ok: true, answer: reply.content, excerpts: current.excerpts }
        : { ok: false, reason: 'failed', error: reply.error }
    }
    return { ok: false, reason: 'invalid' }
  }
}
