/** Cheil fork: preview exact page pixels, then one-use explicit cloud OCR consent. */
import { randomUUID } from 'node:crypto'
import type { WikiPage, WikiReply, WikiRequest } from '../../shared/cheil-wiki-api'
import { azureEndpoint, analyzeAzurePage } from './azure-ocr'
import { gradeOutbound, GRADE } from '../../../../../packages/ai-provider/src/cheil-grade'
export function createWikiCloudOcr(deps: {
  request(req: WikiRequest): Promise<WikiReply>
  render(path: string, pages: number[]): Promise<Array<{ page: number; png: string }> | null>
  fingerprint(path: string): Promise<string>
  apply(page: WikiPage, replacements: Array<{ page: number; text: string }>): Promise<WikiReply>
  analyze?: typeof analyzeAzurePage
}) {
  let config: { endpoint: string; key: string } | null = null
  let draft: {
    id: string
    page: WikiPage
    images: Array<{ page: number; png: string }>
    hash: string
    expires: number
    campaignId?: string
  } | null = null
  let busy = false
  return async (req: WikiRequest): Promise<WikiReply> => {
    if (busy) return { ok: false, reason: 'conflict' }
    if (req.op === 'ocrConfigure') {
      draft = null
      if (req.endpoint === '' && req.key === '') {
        config = null
        return { ok: true }
      }
      try {
        if (typeof req.key !== 'string' || !req.key.trim() || req.key.length > 512) throw Error()
        config = { endpoint: azureEndpoint(req.endpoint), key: req.key.trim() }
        return { ok: true }
      } catch {
        return { ok: false, reason: 'invalid' }
      }
    }
    if (req.op === 'ocrStatus') return { ok: true, ocrEndpoint: config?.endpoint ?? '' }
    if (req.op === 'ocrDismiss') {
      draft = null
      return { ok: true }
    }
    if (!config) return { ok: false, reason: 'ocr-not-configured' }
    if (req.op === 'ocrPrepare') {
      draft = null
      if (
        !Array.isArray(req.pages) ||
        !req.pages.length ||
        req.pages.length > 5 ||
        req.pages.some((p) => !Number.isInteger(p) || p < 1 || p > 250) ||
        new Set(req.pages).size !== req.pages.length
      )
        return { ok: false, reason: 'invalid' }
      busy = true
      try {
        const r = await deps.request({ op: 'read', id: req.id, campaignId: req.campaignId })
        if (
          !r.ok ||
          !r.page?.origin ||
          !/\.pdf$/i.test(r.page.origin) ||
          r.page.version !== req.expectedVersion
        )
          return { ok: false, reason: 'conflict' }
        const page = r.page
        if (req.pages.some((p) => p > (page.extraction?.totalPages ?? 0)))
          return { ok: false, reason: 'invalid' }
        const verdict = gradeOutbound([page.body])
        if (verdict.pii || verdict.rule >= GRADE.TOP) return { ok: false, reason: 'ocr-blocked' }
        const hash = await deps.fingerprint(page.origin!)
        if (hash !== page.originHash) return { ok: false, reason: 'conflict' }
        const images = await deps.render(page.origin!, req.pages)
        if (
          !images ||
          images.length !== req.pages.length ||
          images.some((i) => !req.pages.includes(i.page)) ||
          images.reduce((n, i) => n + i.png.length, 0) > 50_000_000
        )
          return { ok: false, reason: 'failed' }
        if (hash !== (await deps.fingerprint(page.origin!)))
          return { ok: false, reason: 'conflict' }
        const id = randomUUID()
        draft = {
          id,
          page,
          images,
          hash,
          expires: Date.now() + 300_000,
          campaignId: req.campaignId,
        }
        return { ok: true, ocrPreview: { id, endpoint: config.endpoint, images } }
      } finally {
        busy = false
      }
    }
    if (req.op === 'ocrRun') {
      const current = draft
      if (!current || current.id !== req.draftId || current.expires < Date.now())
        return { ok: false, reason: 'conflict' }
      if (req.approved !== true) return { ok: false, reason: 'consent-required' }
      draft = null
      busy = true
      try {
        const r = await deps.request({
          op: 'read',
          id: current.page.id,
          campaignId: current.campaignId,
        })
        if (
          !r.ok ||
          r.page?.version !== current.page.version ||
          (await deps.fingerprint(current.page.origin!)) !== current.hash
        )
          return { ok: false, reason: 'conflict' }
        const replacements: Array<{ page: number; text: string }> = []
        for (const image of current.images) {
          const text = await (deps.analyze ?? analyzeAzurePage)(
            config,
            Buffer.from(image.png, 'base64'),
          )
          replacements.push({ page: image.page, text })
        }
        if ((await deps.fingerprint(current.page.origin!)) !== current.hash)
          return { ok: false, reason: 'conflict' }
        return await deps.apply(current.page, replacements)
      } catch {
        return { ok: false, reason: 'ocr-failed' }
      } finally {
        busy = false
      }
    }
    return { ok: false, reason: 'invalid' }
  }
}
