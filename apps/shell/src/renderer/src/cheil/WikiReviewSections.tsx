/** Cheil fork: pending proposals and actual application history are separate. */
import { useEffect, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type { WikiPage, WikiReply, WikiRequest, WikiReview } from '../../../shared/cheil-wiki-api'
import { KakaoSend } from './KakaoSend'
import { wikiWords } from './wiki-words'
import { WikiReviewPanel } from './WikiReviewPanel'
export function WikiReviewSections({
  lang,
  pages,
  campaignId,
  call,
  onSaved,
}: {
  lang: Lang
  pages: WikiPage[]
  campaignId?: string
  call: (req: WikiRequest) => Promise<WikiReply>
  onSaved: (p?: WikiPage) => void
}) {
  const w = wikiWords(lang),
    labels = w.listSections.split('|')
  const [reviews, setReviews] = useState<WikiReview[]>([]),
    [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    void call({ op: 'reviews', campaignId }).then((r) => {
      if (cancelled) return
      setError(!r.ok)
      if (r.ok) setReviews(r.reviews ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [call, campaignId, pages])
  const sorted = [...reviews].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  const seen = new Set<string>()
  const latest = sorted.filter((r) => {
    const key = JSON.stringify([r.sourceId, r.targetId])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const pending = (r: WikiReview) =>
    r.items.filter((i) => i.status === 'pending' || i.status === 'held').length
  const waiting = latest.filter((r) => pending(r) > 0)
  const logs = reviews
    .flatMap((r) =>
      r.items.flatMap((i) =>
        i.history
          .filter((h) => h.action === 'apply' || h.action === 'apply-recovered')
          .map((h) => ({ r, i, h })),
      ),
    )
    .sort((a, b) => b.h.at.localeCompare(a.h.at))
  const panel = (entryLabel: string, reviewId?: string) => (
    <WikiReviewPanel
      lang={lang}
      pages={pages}
      campaignId={campaignId}
      call={call}
      onSaved={onSaved}
      entryLabel={entryLabel}
      reviewId={reviewId}
    />
  )
  return (
    <>
      <details className="cheil-wiki-section" data-wiki-section="pending">
        <summary>
          {labels[1]} · {waiting.reduce((n, r) => n + pending(r), 0)}
        </summary>
        {error && <p role="alert">{w.error}</p>}
        {waiting.map((r) => (
          <div key={r.id}>
            <p>{new Date(r.createdAt).toLocaleString(lang)}</p>
            {panel(r.sourceTitle + ' → ' + r.targetTitle + ' · ' + pending(r), r.id)}
          </div>
        ))}
        {!waiting.length && <p>{w.reviewLabels.split('|')[11]}</p>}
        {panel(w.reviewHistoryLabels.split('|')[5]!)}
        {reviews.length > 0 && (
          <details>
            <summary>
              {labels[3]} · {reviews.length}
            </summary>
            {panel(w.history)}
          </details>
        )}
      </details>
      <details className="cheil-wiki-section" data-wiki-section="log">
        <summary>
          {labels[2]} · {logs.length}
        </summary>
        {error && <p role="alert">{w.error}</p>}
        {!logs.length && <p>—</p>}
        {logs.map(({ r, i, h }, index) => (
          <details key={r.id + i.id + index}>
            <summary>
              {new Date(h.at).toLocaleString(lang)} · {r.targetTitle}
            </summary>
            <p>
              {w.source}: {r.sourceTitle}
            </p>
            <p>{w.reviewLabels.split('|')[3]}</p>
            <pre>{i.before || '—'}</pre>
            <p>{w.reviewLabels.split('|')[15]}</p>
            <pre>{h.text ?? i.after}</pre>
            <KakaoSend lang={lang} call={call} text={r.targetTitle + '\n' + (h.text ?? i.after)} />
          </details>
        ))}
      </details>
    </>
  )
}
