/** Cheil fork: manual knowledge organization and durable import queue. */
import { useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import { wikiTypes } from '../../../shared/cheil-wiki-api'
import type {
  WikiPage,
  WikiRequest,
  WikiReply,
  WikiKnowledge,
  WikiJob,
} from '../../../shared/cheil-wiki-api'
import { wikiWords } from './wiki-words'
import { OptionsDialog } from './OptionsDialog'

export function WikiStructure({
  lang,
  pages,
  selected,
  campaignId,
  call,
  onSaved,
}: {
  lang: Lang
  pages: WikiPage[]
  selected: WikiPage | null
  campaignId?: string
  call: (req: WikiRequest) => Promise<WikiReply>
  onSaved: (page?: WikiPage) => void
}) {
  const w = wikiWords(lang)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<WikiPage | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<WikiKnowledge['type']>('campaign')
  const [reuse, setReuse] = useState<WikiKnowledge['reuse']>('campaign')
  const [aliases, setAliases] = useState('')
  const [related, setRelated] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [jobs, setJobs] = useState<WikiJob[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const labels = w.knowledgeTypes.split('|')
  const visible = campaignId ? pages.filter((p) => p.campaignIds.includes(campaignId)) : pages
  function begin(page: WikiPage | null) {
    setTarget(page)
    setTitle(page?.title ?? '')
    setBody('')
    setType(page?.knowledge?.type ?? 'campaign')
    setReuse(page?.knowledge?.reuse ?? 'campaign')
    setAliases(page?.knowledge?.aliases.join('\n') ?? '')
    setRelated(page?.knowledge?.relatedIds ?? [])
    setSources(selected && !page ? [selected.id] : [])
    setError('')
    setOpen(true)
  }
  return (
    <section className="cheil-wiki-structure">
      <div className="cheil-wiki-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={() => begin(null)}>
          {w.newKnowledge}
        </button>
        {selected && (
          <button className="btn btn-secondary" disabled={busy} onClick={() => begin(selected)}>
            {w.knowledgeType} · {w.related}
          </button>
        )}
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await call({ op: 'jobs' })
              if (r.ok) setJobs(r.jobs ?? [])
              else setError(w.error)
            } finally {
              setBusy(false)
            }
          }}
        >
          {w.importJobs}
        </button>
      </div>
      {selected && (
        <p className="cheil-wiki-meta">
          {selected.knowledge
            ? labels[wikiTypes.indexOf(selected.knowledge.type)]
            : selected.kind === 'source'
              ? w.source
              : w.page}
          {' · '}
          {w.review}
          {' · '}
          {selected.snapshot ? w.snapshotSaved : w.snapshotMissing}
        </p>
      )}
      {selected && (
        <div className="cheil-wiki-actions">
          {visible
            .filter(
              (p) =>
                selected.knowledge?.relatedIds.includes(p.id) ||
                p.knowledge?.relatedIds.includes(selected.id),
            )
            .map((p) => (
              <button key={p.id} className="btn btn-secondary" onClick={() => onSaved(p)}>
                {w.related}: {p.title}
              </button>
            ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <OptionsDialog
        open={open}
        title={target ? w.organize : w.newKnowledge}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
      >
        <div className="cheil-wiki-import">
          {!target && (
            <>
              <label>
                {w.titleField}
                <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                {w.bodyField}
                <textarea
                  rows={5}
                  value={body}
                  maxLength={1000000}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            {w.knowledgeType}
            <select value={type} onChange={(e) => setType(e.target.value as WikiKnowledge['type'])}>
              {wikiTypes.map((t, i) => (
                <option key={t} value={t}>
                  {labels[i]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {w.aliases}
            <textarea rows={2} value={aliases} onChange={(e) => setAliases(e.target.value)} />
          </label>
          <label>
            {w.reuseScope}
            <select
              value={reuse}
              onChange={(e) => setReuse(e.target.value as WikiKnowledge['reuse'])}
            >
              {(['campaign', 'brand', 'advertiser', 'common'] as const).map((t, i) => (
                <option key={t} value={t}>
                  {w.reuseLabels.split('|')[i]}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{w.related}</legend>
            {visible
              .filter((p) => p.id !== target?.id)
              .map((p) => (
                <label className="cheil-wiki-check" key={p.id}>
                  <input
                    type="checkbox"
                    checked={related.includes(p.id)}
                    onChange={(e) =>
                      setRelated(
                        e.target.checked ? [...related, p.id] : related.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.title}
                </label>
              ))}
          </fieldset>
          {!target && (
            <fieldset>
              <legend>{w.source}</legend>
              {visible.map((p) => (
                <label className="cheil-wiki-check" key={p.id}>
                  <input
                    type="checkbox"
                    checked={sources.includes(p.id)}
                    onChange={(e) =>
                      setSources(
                        e.target.checked ? [...sources, p.id] : sources.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.title}
                </label>
              ))}
            </fieldset>
          )}
          <p>{w.review}</p>
          {error && <p role="alert">{error}</p>}
          <button
            className="btn btn-primary"
            disabled={busy || (!target && (!title.trim() || !body.trim()))}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                const knowledge: WikiKnowledge = {
                  type,
                  reuse,
                  aliases: aliases.split('\n').filter(Boolean),
                  relatedIds: related,
                  status: 'draft',
                }
                const r = await call(
                  target
                    ? {
                        op: 'setKnowledge',
                        id: target.id,
                        expectedVersion: target.version,
                        expectedKnowledge: target.knowledge,
                        knowledge,
                        campaignId,
                      }
                    : {
                        op: 'createKnowledge',
                        title,
                        body,
                        knowledge,
                        campaignId,
                        sources: sources.map((id) => ({
                          id,
                          version: pages.find((p) => p.id === id)!.version,
                        })),
                      },
                )
                if (r.ok) {
                  setOpen(false)
                  onSaved(r.page)
                } else setError(r.reason === 'conflict' ? w.conflict : w.error)
              } finally {
                setBusy(false)
              }
            }}
          >
            {w.save}
          </button>
        </div>
      </OptionsDialog>
      <OptionsDialog open={jobs !== null} title={w.importJobs} onClose={() => setJobs(null)}>
        {!jobs?.length && <p>{w.empty}</p>}
        {jobs?.map((j) => (
          <div key={j.id}>
            <p>{j.origin}</p>
            <p>{j.status === 'complete' ? w.saved : j.status === 'failed' ? w.error : w.working}</p>
            {j.status !== 'complete' && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const r = await call({ op: 'retryImport', jobId: j.id })
                    if (r.ok) onSaved(r.page)
                    else setError(w.error)
                    const list = await call({ op: 'jobs' })
                    if (list.ok) setJobs(list.jobs ?? [])
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {w.retryImport}
              </button>
            )}
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
      </OptionsDialog>
    </section>
  )
}
