/** Cheil fork: independent job snapshots; changing the default never reroutes an active request. */
import { useState, useSyncExternalStore } from 'react'
import type { CheilCampaignApi } from '../../../shared/cheil-campaign-api'
import { useAiSettings } from '../FreeAiCards'
import { TaskAiPicker, useTaskAi } from './TaskAiPicker'
import type { FolderWorkReply } from '../../../shared/folder-work'

type FolderJob = {
  id: string
  provider: string
  query: string
  busy: boolean
  reply?: FolderWorkReply
}
let storedJobs: FolderJob[] = []
const listeners = new Set<() => void>()
function setJobs(update: (prev: FolderJob[]) => FolderJob[]) {
  storedJobs = update(storedJobs)
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
let storedDraft: FolderWorkReply | null = null
export function CommonFolderWork() {
  const settings = useAiSettings()
  const [draft, setDraft] = useState<FolderWorkReply | null>(storedDraft)
  const [query, setQuery] = useState('')
  const taskAi = useTaskAi()
  const [notice, setNotice] = useState('')
  const [picking, setPicking] = useState(false)
  const jobs = useSyncExternalStore(subscribe, () => storedJobs)
  const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
    .aiOfficeCheilCampaigns
  const run = async () => {
    if (!settings || !draft?.id || !query.trim()) return
    const id = crypto.randomUUID()
    if (!taskAi.valid) return
    const snapshot = taskAi.apply(settings)
    const chosen = taskAi.label
    const prompt = query
    setJobs((prev) => [{ id, provider: chosen, query: prompt, busy: true }, ...prev])
    const reply = await api
      .folderWork({ op: 'run', id: draft.id, query: prompt, settings: snapshot })
      .catch((e) => ({ ok: false, error: String(e) }))
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, busy: false, reply } : j)))
  }
  return (
    <section className="cheil-common-folder">
      <h3>공통 AI로 폴더 자료 작업</h3>
      <p>
        문서·My Wiki와 같은 연결을 사용합니다. 원자료를 읽고 초안을 만든 뒤 새 Markdown 파일로
        저장합니다. 원본 수정·명령 실행은 하지 않습니다.
      </p>
      <button
        className="set-btn"
        disabled={picking}
        onClick={async () => {
          setPicking(true)
          try {
            const r = await api.folderWork({ op: 'pick' })
            storedDraft = r.ok ? r : null
            setDraft(storedDraft)
            setNotice(r.error ?? '')
          } catch (e) {
            setNotice(String(e))
          } finally {
            setPicking(false)
          }
        }}
      >
        {picking ? '자료 읽는 중…' : '작업 폴더 선택'}
      </button>
      {draft && (
        <>
          <p>
            {draft.folder} · {draft.files?.length}개 자료 · 제외 {draft.skipped ?? 0}개 (최대
            20개·10만 자·하위 폴더 제외)
          </p>
          <details>
            <summary>AI에 보낼 추출 본문 확인</summary>
            <pre>{draft.text}</pre>
          </details>
          <TaskAiPicker task={taskAi} />
          <textarea
            aria-label="폴더 작업 요청"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회의록을 비교해 캠페인별 할 일 초안을 작성해줘"
          />
          <button
            className="set-btn primary"
            disabled={!query.trim() || !settings}
            onClick={() => void run()}
          >
            본문을 확인했으며 선택한 AI로 요청
          </button>
          <p>
            외부 AI는 이 본문과 요청을 전송합니다. 사용량에 따라 비용·한도가 적용됩니다. 다른 AI를
            선택해 별도 작업을 동시에 시작할 수 있습니다.
          </p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {jobs.map((job) => (
        <article key={job.id}>
          <strong>
            {job.provider} · {job.busy ? '작업 중' : job.reply?.ok ? '완료' : '실패'}
          </strong>
          <p>{job.query}</p>
          {job.reply && (
            <>
              <pre>{job.reply.text ?? job.reply.error}</pre>
              {job.reply.resultId && (
                <button
                  className="set-btn"
                  onClick={async () => {
                    const r = await api.folderWork({ op: 'save', resultId: job.reply?.resultId })
                    setNotice(r.output ? '저장됨: ' + r.output : (r.error ?? '저장 실패'))
                  }}
                >
                  결과를 새 파일로 저장
                </button>
              )}
            </>
          )}
        </article>
      ))}
    </section>
  )
}
