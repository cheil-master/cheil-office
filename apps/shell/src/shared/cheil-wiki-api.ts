/** Cheil fork: local Markdown wiki contract; paths are never supplied for writes. */
export interface WikiExtraction {
  body: string
  extraction?: {
    cloudPages?: number[]
    revision?: number
    totalPages: number
    ocrPages: number
    unreadablePages: number[]
    truncated: boolean
  }
}
export interface WikiPreview {
  id: string
  question: string
  excerpts: WikiExcerpt[]
  provider: string
  local: boolean
  blocked: boolean
  labels: string[]
}
export const wikiTypes = [
  'advertiser',
  'brand',
  'product',
  'campaign',
  'decision',
  'insight',
  'method',
] as const
export interface WikiKnowledge {
  type: (typeof wikiTypes)[number]
  aliases: string[]
  relatedIds: string[]
  reuse: 'campaign' | 'brand' | 'advertiser' | 'common'
  status: 'draft'
}
export interface WikiJob {
  id: string
  origin: string
  snapshot?: string
  campaignId?: string
  status: 'queued' | 'extracting' | 'failed' | 'complete'
  pageId?: string
  updatedAt: string
}
export interface WikiReview {
  id: string
  fingerprint?: string
  sourceId: string
  sourceTitle: string
  sourceVersion: string
  targetId: string
  targetTitle: string
  targetVersion: string
  createdAt: string
  revision: number
  items: Array<{
    id: string
    kind: 'new' | 'supplement' | 'decision' | 'conflict' | 'duplicate'
    reason?: string
    before: string
    after: string
    sourceLines?: number[]
    line: number
    replace: boolean
    status: 'pending' | 'held' | 'rejected' | 'applied'
    history: Array<{ action: string; at: string; text?: string; version?: string }>
  }>
}
export interface WikiPage {
  appliedReviews?: string[]
  knowledge?: WikiKnowledge
  snapshot?: string
  extractionSnapshot?: string
  extraction?: WikiExtraction['extraction']
  id: string
  title: string
  kind: 'source' | 'page'
  campaignIds: string[]
  sourceIds: string[]
  sourceVersions: Record<string, string>
  createdAt: string
  updatedAt: string
  originMissing?: boolean
  origin?: string
  originHash?: string
  previousId?: string
  generated: boolean
  needsReview: boolean
  version: string
  body: string
  stale?: boolean
}
export type WikiScope = { campaignId?: string }
export type WikiRequest =
  | { op: 'kakaoStatus' }
  | { op: 'kakaoConnect'; token: string }
  | { op: 'kakaoSend'; text: string; approved: boolean }
  | ({ op: 'prepareSemantic'; sourceId: string; targetId: string; settings: unknown } & WikiScope)
  | { op: 'runSemantic'; draftId: string; approved: boolean }
  | { op: 'semanticDismiss' }
  | ({
      op: 'commitSemantic'
      expectedRoot: string
      sourceId: string
      targetId: string
      sourceVersion: string
      targetVersion: string
      items: WikiReview['items']
    } & WikiScope)
  | ({ op: 'compare'; sourceId: string; targetId: string } & WikiScope)
  | ({ op: 'reviews' } & WikiScope)
  | ({
      op: 'reviewItem'
      reviewId: string
      itemId: string
      revision: number
      action: 'apply' | 'hold' | 'reject'
      text?: string
    } & WikiScope)
  | { op: 'jobs' }
  | { op: 'retryImport'; jobId: string }
  | ({
      op: 'createKnowledge'
      title: string
      body: string
      knowledge: WikiKnowledge
      sources: Array<{ id: string; version: string }>
    } & WikiScope)
  | ({
      op: 'setKnowledge'
      expectedKnowledge?: WikiKnowledge
      id: string
      expectedVersion: string
      knowledge: WikiKnowledge
    } & WikiScope)
  | { op: 'ocrConfigure'; endpoint: string; key: string }
  | { op: 'ocrStatus' | 'ocrDismiss' }
  | ({ op: 'ocrPrepare'; id: string; expectedVersion: string; pages: number[] } & WikiScope)
  | { op: 'ocrRun'; draftId: string; approved: boolean }
  | ({ op: 'list'; query?: string } & WikiScope)
  | ({ op: 'read'; id: string } & WikiScope)
  | ({ op: 'addText'; title: string; body: string } & WikiScope)
  | ({ op: 'addFiles'; paths: string[] } & WikiScope)
  | ({ op: 'pickFiles' } & WikiScope)
  | ({ op: 'save'; id: string; title: string; body: string; expectedVersion: string } & WikiScope)
  | { op: 'link'; id: string; campaignId: string; linked: boolean }
  | ({ op: 'context'; query: string } & WikiScope)
  | ({ op: 'prepareAnswer'; query: string; settings: unknown } & WikiScope)
  | { op: 'answer'; draftId: string; approved: boolean }
  | ({ op: 'reindex'; id: string; expectedVersion: string } & WikiScope)
  | ({
      op: 'saveAnswer'
      title: string
      body: string
      sources: Array<{ id: string; version: string }>
    } & WikiScope)
  | { op: 'history'; id: string }
  | { op: 'restore'; id: string; version: string; expectedVersion: string }
  | { op: 'trash'; id: string; expectedVersion: string }
  | { op: 'chooseRoot' }
  | { op: 'openFolder' }
  | { op: 'openObsidian' }
export interface WikiExcerpt {
  id: string
  title: string
  version: string
  text: string
  location?: string
}
export type WikiReply =
  | {
      ok: true
      kakaoConnected?: boolean
      reviews?: WikiReview[]
      review?: WikiReview
      jobs?: WikiJob[]
      ocrEndpoint?: string
      ocrPreview?: { id: string; endpoint: string; images: Array<{ page: number; png: string }> }
      preview?: WikiPreview
      answer?: string
      root?: string
      pages?: WikiPage[]
      page?: WikiPage
      excerpts?: WikiExcerpt[]
      versions?: string[]
      results?: Array<{
        name: string
        ok: boolean
        id?: string
        duplicate?: boolean
        reason?: string
      }>
    }
  | {
      ok: false
      error?: string
      reason:
        | 'invalid'
        | 'failed'
        | 'not-found'
        | 'conflict'
        | 'empty'
        | 'unsupported'
        | 'unreadable'
        | 'consent-required'
        | 'ocr-not-configured'
        | 'ocr-blocked'
        | 'ocr-failed'
    }
