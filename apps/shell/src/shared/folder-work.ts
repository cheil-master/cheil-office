/** Cheil fork: selected-folder drafts reuse the common AI connection. */
export interface FolderWorkRequest {
  op: 'pick' | 'run' | 'save'
  id?: string
  query?: string
  settings?: unknown
  resultId?: string
}
export interface FolderWorkReply {
  ok: boolean
  id?: string
  folder?: string
  text?: string
  files?: string[]
  skipped?: number
  resultId?: string
  output?: string
  error?: string
}
