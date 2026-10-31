/** Cheil fork: a small journal independent of document-editing AI. */
import { useEffect, useState } from 'react'
import { useI18n } from '../locale'
import {
  JOURNAL_BRIDGE,
  type JournalApi,
  type JournalRequest,
  type JournalView,
} from '../../../shared/cheil-journal-api'
import { journalWords } from './journal-words'
import './LlmJournalPanel.css'

export function LlmJournalPanel() {
  const { lang } = useI18n()
  const w = journalWords(lang)
  const api = (window as unknown as Record<string, JournalApi | undefined>)[JOURNAL_BRIDGE]
  const [view, setView] = useState<JournalView | null>(null)
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const run = async (request: JournalRequest) => {
    if (!api) return
    setBusy(true)
    setMessage('')
    try {
      const result = await api.request(request)
      if (result.ok) {
        setView(result.view)
        if (request.op === 'copy-connection') setMessage(w.copied)
      } else setMessage(w.failed)
    } catch {
      setMessage(w.failed)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let live = true
    const refresh = () => {
      void api
        ?.request({ op: 'status', ...(day ? { day } : {}) })
        .then((result) => {
          if (live && result.ok) setView(result.view)
        })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [api, day])
  const dateText = (at: number | null) =>
    at ? new Date(at).toLocaleString(lang, { timeZone: 'Asia/Seoul' }) : '—'
  const selectedDay = day || new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  return (
    <main className="content cheil-tool cheil-journal" data-testid="cheil-tool-journal">
      <header className="cheil-journal-header">
        <div>
          <h2 className="cheil-tool-title">{w.title}</h2>
          <p>{w.intro}</p>
        </div>
        <button
          className={`btn ${view?.enabled ? 'primary' : ''}`}
          role="switch"
          aria-checked={!!view?.enabled}
          disabled={!view?.ready || busy}
          onClick={() => void run({ op: 'record', enabled: !view?.enabled })}
          data-testid="journal-toggle"
        >
          {view?.enabled ? w.stop : w.start}
        </button>
      </header>
      <p className="cheil-journal-note">{w.local}</p>
      <div className="cheil-journal-status">
        <span>
          {w.since}: {dateText(view?.since ?? null)}
        </span>
        <span>
          {w.connection}: {dateText(view?.connectedAt ?? null)}
        </span>
      </div>
      <div className="cheil-journal-providers">
        {(['chatgpt', 'claude'] as const).map((provider) => (
          <span key={provider}>
            {provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} ·{' '}
            {view?.providers[provider]?.status === 'ok'
              ? w.received
              : view?.providers[provider]?.status === 'signed-out'
                ? w.signIn
                : view?.providers[provider]?.status === 'failed'
                  ? w.failed
                  : w.waiting}
          </span>
        ))}
      </div>
      {view?.pairingCode ? (
        <div className="cheil-journal-note" role="status">
          <p>
            {w.setup} · <strong>{view.pairingCode}</strong>
          </p>
          <button
            className="btn primary"
            disabled={busy}
            data-testid="journal-confirm-pair"
            onClick={() => void run({ op: 'pair-confirm', code: view.pairingCode! })}
          >
            {w.connect}
          </button>
        </div>
      ) : null}
      {view && !view.ready ? <p role="alert">{w.unavailable}</p> : null}
      <details className="cheil-journal-connect">
        <summary>{w.setup}</summary>
        <ol>
          <li>{w.step1}</li>
          <li>{w.step2}</li>
          <li>{w.step3}</li>
        </ol>
        <div className="cheil-journal-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => void run({ op: 'extension-folder' })}
          >
            {w.extension}
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void run({ op: 'copy-connection' })}
          >
            {w.copy}
          </button>
        </div>
      </details>
      <div className="cheil-journal-actions">
        <label>
          {w.day}{' '}
          <input type="date" value={selectedDay} onChange={(event) => setDay(event.target.value)} />
        </label>
        <button
          className="btn"
          disabled={busy || !view?.entries.length}
          onClick={() => void run({ op: 'open', day: selectedDay })}
        >
          {w.open}
        </button>
        <button className="btn" onClick={() => void run({ op: 'folder' })}>
          {w.folder}
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!view?.entries.length ? (
        <p className="cheil-journal-empty">{w.empty}</p>
      ) : (
        <div className="cheil-journal-entries">
          {view.entries.map((entry) => (
            <article key={entry.id}>
              <header>
                {entry.provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} ·{' '}
                {new Date(entry.at).toLocaleTimeString(lang, {
                  timeZone: 'Asia/Seoul',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </header>
              <p>
                <strong>{w.question}</strong> {entry.question}
              </p>
              <p>
                <strong>{w.answer}</strong> {entry.answer}
              </p>
              <small>{entry.url}</small>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
