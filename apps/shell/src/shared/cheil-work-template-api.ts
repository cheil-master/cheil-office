/** Cheil fork: reusable work documents, independent of the legacy blank-making flow. */
import type { MyTemplate } from './cheil-campaign-api'

export const WORK_TEMPLATE_CHANNEL = 'cheil:work-templates'
export const WORK_TEMPLATE_BRIDGE = 'aiOfficeWorkTemplates'

export type WorkTemplateRequest =
  | { action: 'list' }
  | { action: 'add' }
  | { action: 'use'; name: string }
  // Cheil fork: mutations only address the version shown on the home card.
  | { action: 'rename'; name: string; title: string; updatedAt: string }
  | { action: 'delete'; name: string; updatedAt: string }

export type WorkTemplateFailure =
  | 'canceled'
  | 'invalid'
  | 'unreadable'
  | 'too-large'
  | 'not-found'
  | 'failed'
  | 'exists'
  | 'changed'

export type WorkTemplateReply =
  { ok: true; templates: MyTemplate[]; added?: string } | { ok: false; reason: WorkTemplateFailure }

export interface WorkTemplateApi {
  request(input: WorkTemplateRequest): Promise<WorkTemplateReply>
}
