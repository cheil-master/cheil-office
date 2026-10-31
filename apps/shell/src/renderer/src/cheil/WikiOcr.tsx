/** Cheil fork: a session-only key and exact page-image consent, independent of chat subscriptions. */
import { useEffect, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type { WikiPage, WikiReply, WikiRequest } from '../../../shared/cheil-wiki-api'
import { wikiWords } from './wiki-words'
export function WikiOcr({
  lang,
  page,
  campaignId,
  busy,
  setBusy,
  call,
  onSaved,
}: {
  lang: Lang
  page: WikiPage
  campaignId?: string
  busy: boolean
  setBusy(value: boolean): void
  call(req: WikiRequest): Promise<WikiReply>
  onSaved(page: WikiPage): void
}) {
  const w = wikiWords(lang)
  const [endpoint, setEndpoint] = useState('')
  const [key, setKey] = useState('')
  const [connected, setConnected] = useState('')
  const [numbers, setNumbers] = useState('')
  const [message, setMessage] = useState('')
  const [approved, setApproved] = useState(false)
  const [preview, setPreview] = useState<NonNullable<
    Extract<WikiReply, { ok: true }>['ocrPreview']
  > | null>(null)
  useEffect(() => {
    setPreview(null)
    setApproved(false)
    setMessage('')
    setNumbers((page.extraction?.unreadablePages ?? []).slice(0, 5).join(','))
    void call({ op: 'ocrDismiss' })
  }, [page.id, page.version, call, page.extraction])
  useEffect(() => {
    void call({ op: 'ocrStatus' }).then((r) => {
      if (r.ok) {
        setConnected(r.ocrEndpoint ?? '')
        setEndpoint(r.ocrEndpoint ?? '')
      }
    })
  }, [call])
  const fail = (r: WikiReply) =>
    setMessage(
      !r.ok && r.reason === 'conflict'
        ? w.conflict
        : !r.ok && r.reason === 'ocr-blocked'
          ? w.blocked
          : w.ocrError,
    )
  return (
    <details className="cheil-wiki-preview cheil-wiki-ocr">
      <summary>{w.ocrTitle}</summary>
      <p>{w.ocrHint}</p>
      <fieldset disabled={busy}>
        <legend>Azure Document Intelligence</legend>
        <p>{connected || w.ocrDisconnected}</p>
        <label>
          {w.ocrEndpoint}
          <input
            value={endpoint}
            onChange={(e) => {
              setEndpoint(e.target.value)
              setPreview(null)
              setApproved(false)
            }}
            placeholder="https://…cognitiveservices.azure.com"
          />
        </label>
        <label>
          {w.ocrKey}
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <p>{w.ocrSession}</p>
        <button
          className="btn btn-secondary"
          disabled={!endpoint || !key}
          onClick={async () => {
            const r = await call({ op: 'ocrConfigure', endpoint, key })
            setKey('')
            setPreview(null)
            setApproved(false)
            if (r.ok) {
              setConnected(endpoint)
              setMessage(w.saved)
            } else fail(r)
          }}
        >
          {w.ocrSave}
        </button>
        {connected && (
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await call({ op: 'ocrConfigure', endpoint: '', key: '' })
              setConnected('')
              setPreview(null)
              setApproved(false)
            }}
          >
            {w.ocrDisconnect}
          </button>
        )}
        <label>
          {w.ocrPages}
          <input
            value={numbers}
            onChange={(e) => {
              setNumbers(e.target.value)
              setPreview(null)
              setApproved(false)
              void call({ op: 'ocrDismiss' })
            }}
            placeholder="1,3,5"
          />
        </label>
        <p>
          {w.ocrPageHint} {page.extraction?.totalPages ?? '?'}
        </p>
        <button
          className="btn btn-secondary"
          disabled={!connected || !numbers.trim()}
          onClick={async () => {
            const parts = numbers.split(',').map((n) => n.trim())
            if (parts.some((n) => !/^\d+$/.test(n))) {
              setMessage(w.ocrError)
              return
            }
            setBusy(true)
            setMessage('')
            setPreview(null)
            setApproved(false)
            try {
              const r = await call({
                op: 'ocrPrepare',
                id: page.id,
                expectedVersion: page.version,
                pages: parts.map(Number),
                campaignId,
              })
              if (r.ok && r.ocrPreview) setPreview(r.ocrPreview)
              else fail(r)
            } finally {
              setBusy(false)
            }
          }}
        >
          {w.ocrPreviewLabel}
        </button>
        {preview && (
          <section>
            <p>
              {preview.endpoint} · {preview.images.length}
            </p>
            <p>{w.ocrConsentHint}</p>
            {preview.images.map((i) => (
              <figure key={i.page}>
                <figcaption>PDF {i.page}</figcaption>
                <img
                  style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }}
                  src={`data:image/png;base64,${i.png}`}
                  alt={`PDF ${i.page}`}
                />
              </figure>
            ))}
            <label>
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              {w.ocrConsent}
            </label>
            <button
              className="btn btn-primary"
              disabled={!approved}
              onClick={async () => {
                setBusy(true)
                setMessage('')
                try {
                  const r = await call({ op: 'ocrRun', draftId: preview.id, approved })
                  setPreview(null)
                  setApproved(false)
                  if (r.ok && r.page) {
                    onSaved(r.page)
                    setMessage(w.saved)
                  } else fail(r)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {w.ocrRun}
            </button>
          </section>
        )}
      </fieldset>
      {busy && <p role="status">{w.working}</p>}
      {message && <p role="status">{message}</p>}
    </details>
  )
}
