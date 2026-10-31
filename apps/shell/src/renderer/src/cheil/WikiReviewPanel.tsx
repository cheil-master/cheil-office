import { TaskAiPicker, useTaskAi } from './TaskAiPicker'
/** Cheil fork: explicit per-item review with source and version context. */
import { KakaoSend } from './KakaoSend'
import { readAiSettings } from '../settings-ai'
import type { WikiPreview } from '../../../shared/cheil-wiki-api'
import { useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type { WikiPage, WikiReview, WikiRequest, WikiReply } from '../../../shared/cheil-wiki-api'
import { wikiWords } from './wiki-words'
import { OptionsDialog } from './OptionsDialog'
export function WikiReviewPanel({
  lang,
  pages,
  campaignId,
  call,
  onSaved,
  entryLabel,
  reviewId,
}: {
  entryLabel?: string
  reviewId?: string
  lang: Lang
  pages: WikiPage[]
  campaignId?: string
  call: (r: WikiRequest) => Promise<WikiReply>
  onSaved: (p?: WikiPage) => void
}) {
  const w = wikiWords(lang),
    l = w.reviewLabels.split('|'),
    h = w.reviewHistoryLabels.split('|')
  const [open, setOpen] = useState(false),
    [source, setSource] = useState(''),
    [target, setTarget] = useState('')
  const taskAi = useTaskAi()
  const [items, setItems] = useState<WikiReview[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [preview, setPreview] = useState<WikiPreview | null>(null)
  const [approved, setApproved] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [selectedReview, setSelectedReview] = useState<string | null>(null)
  // Cheil fork: creation order stays stable when an older review is acted on.
  const ordered = [...items].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  const active = ordered.find((r) => r.id === selectedReview) ?? ordered[0]
  const date = (value: string) =>
    new Date(value).toLocaleString(lang, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  const counts = (r: WikiReview) =>
    ['pending', 'held', 'rejected', 'applied']
      .map((status, i) => l[12 + i] + ' ' + r.items.filter((x) => x.status === status).length)
      .join(' · ')
  const row = (r: WikiReview, index: number) => (
    <button
      key={r.id}
      type="button"
      className="cheil-wiki-review-version"
      aria-pressed={active?.id === r.id}
      onClick={() => setSelectedReview(r.id)}
    >
      <strong>
        {h[3]} {ordered.length - index} {index === 0 ? '· ' + h[2] : ''}
      </strong>
      <time dateTime={r.createdAt}>{date(r.createdAt)}</time>
      <span>
        {r.sourceTitle} → {r.targetTitle}
      </span>
      <small>{counts(r)}</small>
    </button>
  )
  const available = campaignId ? pages.filter((p) => p.campaignIds.includes(campaignId)) : pages
  async function run(req: WikiRequest) {
    setBusy(true)
    setError('')
    try {
      const r = await call(req)
      if (req.op === 'runSemantic') {
        setPreview(null)
        setApproved(false)
      }
      if (!r.ok) {
        setError(r.reason === 'conflict' ? w.conflict : w.error)
        return
      }
      if (r.preview) {
        setPreview(r.preview)
        setApproved(false)
      }
      if (r.review) {
        setPreview(null)
        setSelectedReview(r.review.id)
      }
      if (r.reviews) setItems(r.reviews)
      if (r.review) setItems((prev) => [r.review!, ...prev.filter((v) => v.id !== r.review!.id)])
      if (r.review || r.page) onSaved(r.page)
    } catch {
      setError(w.error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => {
          setSelectedReview(reviewId ?? null)
          setOpen(true)
          void run({ op: 'reviews', campaignId })
        }}
      >
        {entryLabel ?? l[0]}
      </button>
      <OptionsDialog
        open={open}
        title={l[0]!}
        onClose={() => {
          if (!busy) {
            setOpen(false)
            setPreview(null)
            setApproved(false)
            void call({ op: 'semanticDismiss' })
          }
        }}
      >
        <details className="cheil-wiki-review-create">
          <summary>{h[5]}</summary>
          <div className="cheil-wiki-import">
            <label>
              {w.source}
              <select
                aria-label={w.source}
                disabled={busy}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value)
                  setPreview(null)
                  setApproved(false)
                  void call({ op: 'semanticDismiss' })
                }}
              >
                <option value="">—</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {l[1]}
              <select
                aria-label={l[1]}
                disabled={busy}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setPreview(null)
                  setApproved(false)
                  void call({ op: 'semanticDismiss' })
                }}
              >
                <option value="">—</option>
                {available
                  .filter((p) => p.kind === 'page' && p.id !== source)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || !source || !target || source === target}
              onClick={() =>
                void run({ op: 'compare', sourceId: source, targetId: target, campaignId })
              }
            >
              {l[2]}
            </button>
          </div>
          <p>{w.compareHint}</p>
          <p>{w.aiHint}</p>
          <TaskAiPicker task={taskAi} disabled={busy} />
          <button
            className="btn btn-primary"
            disabled={busy || !source || !target || source === target}
            onClick={async () => {
              setBusy(true)
              try {
                await run({
                  op: 'prepareSemantic',
                  sourceId: source,
                  targetId: target,
                  settings: taskAi.settings
                    ? taskAi.apply(taskAi.settings)
                    : await readAiSettings(),
                  campaignId,
                })
              } catch {
                setError(w.error)
              } finally {
                setBusy(false)
              }
            }}
          >
            AI · {l[2]}
          </button>
          {preview && (
            <section className="cheil-wiki-preview">
              <h4>{w.preview}</h4>
              <p>
                {preview.provider} · {preview.local ? w.localOnly : w.external}
              </p>
              {preview.blocked && <p role="alert">{w.blocked}</p>}
              {preview.excerpts.map((e) => (
                <details key={e.id} open>
                  <summary>{e.title}</summary>
                  <pre>{e.text}</pre>
                </details>
              ))}
              {!preview.local && (
                <label>
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  {w.consent}
                </label>
              )}
              <p>{w.onceOnly}</p>
              <button
                className="btn btn-primary"
                disabled={busy || preview.blocked || (!preview.local && !approved)}
                onClick={() => void run({ op: 'runSemantic', draftId: preview.id, approved })}
              >
                {busy ? w.working : w.generate}
              </button>
            </section>
          )}
        </details>
        {error && <p role="alert">{error}</p>}
        {!items.length && <p>{l[11]}</p>}
        {ordered.length > 0 && (
          <nav aria-label={w.history} className="cheil-wiki-review-history">
            <h4>{h[0]}</h4>
            <p>{h[4]}</p>
            {ordered.slice(0, 3).map((r, i) => row(r, i))}
            {ordered.length > 3 && (
              <details>
                <summary>
                  {h[1]} ({ordered.length - 3})
                </summary>
                <div className="cheil-wiki-review-older">
                  {ordered.slice(3).map((r, i) => row(r, i + 3))}
                </div>
              </details>
            )}
          </nav>
        )}
        {(active ? [active] : []).map((review) => (
          <section key={review.id} className="cheil-wiki-preview">
            <h4>
              {review.sourceTitle} → {review.targetTitle}
            </h4>
            <p>
              {date(review.createdAt)} · {review.sourceVersion.slice(0, 8)} →{' '}
              {review.targetVersion.slice(0, 8)}
            </p>
            <p>
              {counts(review)} · {h[6]}
            </p>
            {review.items.map((item) => (
              <details key={item.id} className="cheil-wiki-review-item">
                <summary>
                  <strong>
                    {
                      w.changeKinds.split('|')[
                        ['new', 'supplement', 'decision', 'conflict', 'duplicate'].indexOf(
                          item.kind,
                        )
                      ]
                    }
                  </strong>
                  <span>
                    {' '}
                    · {item.reason || item.after.split('\n')[0]} ·{' '}
                    {l[12 + ['pending', 'held', 'rejected', 'applied'].indexOf(item.status)]}
                  </span>
                </summary>
                <p>
                  {l[9]}: {l[12 + ['pending', 'held', 'rejected', 'applied'].indexOf(item.status)]}
                </p>
                <p>
                  {w.source}: {review.sourceTitle} · {l[10]} {item.line}
                </p>
                {item.reason && <p>{item.reason}</p>}
                <p>{l[3]}</p>
                <pre>{item.before || '—'}</pre>
                <p>{l[4]}</p>
                <pre>{item.after}</pre>
                <label>
                  {l[5]}
                  <textarea
                    aria-label={l[5]}
                    disabled={busy || item.status === 'applied' || item.status === 'rejected'}
                    value={edits[item.id] ?? item.after}
                    onChange={(e) => setEdits({ ...edits, [item.id]: e.target.value })}
                  />
                </label>
                <p>{item.replace ? l[16] : l[17]}</p>
                <div className="cheil-wiki-actions">
                  {(['apply', 'hold', 'reject'] as const).map((action, i) => (
                    <button
                      key={action}
                      className={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'}
                      disabled={
                        busy ||
                        item.status === 'applied' ||
                        item.status === 'rejected' ||
                        (action === 'hold' && item.status === 'held')
                      }
                      onClick={() =>
                        void run({
                          op: 'reviewItem',
                          reviewId: review.id,
                          itemId: item.id,
                          revision: review.revision,
                          action,
                          text: edits[item.id] ?? item.after,
                          campaignId,
                        })
                      }
                    >
                      {l[6 + i]}
                    </button>
                  ))}
                </div>
                <KakaoSend
                  lang={lang}
                  call={call}
                  text={review.targetTitle + '\n' + (item.reason || '') + '\n' + item.after}
                />
                <details>
                  <summary>{w.history}</summary>
                  {item.history.map((h, i) => (
                    <p key={i}>
                      {h.at} ·{' '}
                      {
                        l[
                          6 +
                            ['apply', 'hold', 'reject'].indexOf(
                              h.action === 'apply-recovered' ? 'apply' : h.action,
                            )
                        ]
                      }
                      {h.text && <pre>{h.text}</pre>}
                    </p>
                  ))}
                </details>
              </details>
            ))}
          </section>
        ))}
      </OptionsDialog>
    </>
  )
}
