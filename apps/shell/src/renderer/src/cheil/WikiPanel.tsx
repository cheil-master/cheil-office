import { TaskAiPicker, useTaskAi } from './TaskAiPicker'
/** Cheil fork: one local wiki view, also embedded in each campaign. */
import { useCallback, useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import type { Lang } from '@genoffice/i18n'
import { Markdown } from '@genoffice/ui'
import type { CheilCampaignApi, CampaignSummary } from '../../../shared/cheil-campaign-api'
import type {
  WikiPage,
  WikiReply,
  WikiRequest,
  WikiExcerpt,
  WikiPreview,
} from '../../../shared/cheil-wiki-api'
import { readAiSettings } from '../settings-ai'
import { wikiWords } from './wiki-words'
import { searchWiki } from '../../../shared/wiki-search'
import './WikiPanel.css'
import { WikiReviewSections } from './WikiReviewSections'
import { KakaoSend } from './KakaoSend'
import { WikiStructure } from './WikiStructure'
import { WikiOcr } from './WikiOcr'
import { OptionsDialog } from './OptionsDialog'

export { wikiPrompt } from '../../../shared/wiki-prompt'
export function WikiPanel({
  lang,
  api,
  campaignId,
}: {
  lang: Lang
  api: CheilCampaignApi
  campaignId?: string
}) {
  const w = wikiWords(lang)
  const [scope, setScope] = useState(campaignId ?? '')
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [pages, setPages] = useState<WikiPage[]>([])
  const [allPages, setAllPages] = useState<WikiPage[]>([])
  const [root, setRoot] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<WikiPage | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const taskAi = useTaskAi()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{
    text: string
    sources: WikiExcerpt[]
    question: string
  } | null>(null)
  const [preview, setPreview] = useState<WikiPreview | null>(null)
  const [approved, setApproved] = useState(false)
  useEffect(() => {
    setPreview(null)
    setApproved(false)
    setAnswer(null)
  }, [question, scope])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const call = useCallback(
    async (request: WikiRequest): Promise<WikiReply> =>
      api.wiki(request).catch(() => ({ ok: false, reason: 'failed' })),
    [api],
  )
  const refresh = useCallback(async () => {
    const [reply, global, cs] = await Promise.all([
      call({ op: 'list', campaignId: scope || undefined }),
      call({ op: 'list' }),
      api.list().catch(() => null),
    ])
    if (reply.ok) {
      setPages(reply.pages ?? [])
      setRoot(reply.root ?? '')
    } else setMessage(w.error)
    if (global.ok) setAllPages(global.pages ?? [])
    if (cs?.ok) setCampaigns(cs.campaigns)
  }, [call, api, scope, w.error])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const dirty = editing && selected && (title !== selected.title || body !== selected.body)
  const canLeave = () => !dirty || window.confirm(w.discard)
  const select = (page: WikiPage) => {
    if (!canLeave()) return false
    setSelected(page)
    setTitle(page.title)
    setBody(page.body)
    setEditing(false)
    setVersions([])
    setDeleteOpen(false)
    setMessage('')
    return true
  }
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!dirty) return
    const guard = (event: MouseEvent | KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const leaving =
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !!target?.closest(
              '.nav-item, .tab-item, .cheil-campaign-view-head .cheil-icon-btn, .modal-overlay',
            ) && !target?.closest('.cheil-wiki')
      if (leaving && !window.confirm(w.discard)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    document.addEventListener('click', guard, true)
    document.addEventListener('keydown', guard, true)
    return () => {
      document.removeEventListener('click', guard, true)
      document.removeEventListener('keydown', guard, true)
    }
  }, [dirty, w.discard])
  const run = async (request: WikiRequest) => {
    setBusy(true)
    setMessage('')
    try {
      const reply = await call(request)
      if (!reply.ok) {
        setMessage(reply.reason === 'conflict' ? w.conflict : w.error)
        return reply
      }
      if (reply.results)
        setMessage(
          reply.results
            .map(
              (r) =>
                `${r.name}: ${r.ok ? (r.duplicate ? w.duplicate : r.reason === 'partial' ? w.saved + ' · ' + w.incomplete : w.saved) : r.reason === 'too-large' ? w.fileLarge : w.error}`,
            )
            .join('\n'),
        )
      else setMessage(w.saved)
      await refresh()
      return reply
    } finally {
      setBusy(false)
    }
  }
  const addFiles = async (paths?: string[]) => {
    await run(
      paths
        ? { op: 'addFiles', paths, campaignId: scope || undefined }
        : { op: 'pickFiles', campaignId: scope || undefined },
    )
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const home = (window as unknown as { aiOffice?: { pathForFile?(f: File): string } }).aiOffice
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => home?.pathForFile?.(f) ?? '')
      .filter(Boolean)
    if (paths.length && !busy) void addFiles(paths)
  }
  const ask = async () => {
    if (!question.trim() || busy) return
    setBusy(true)
    setMessage('')
    setAnswer(null)
    try {
      const baseSettings = await readAiSettings()
      const settings = baseSettings ? taskAi.apply(baseSettings) : baseSettings
      const r = await call({
        op: 'prepareAnswer',
        query: question,
        settings,
        campaignId: scope || undefined,
      })
      if (r.ok && r.preview) {
        setPreview(r.preview)
        setApproved(false)
      } else setMessage(r.ok ? w.error : r.reason === 'empty' ? w.noEvidence : r.error || w.error)
    } catch {
      setMessage(w.error)
    } finally {
      setBusy(false)
    }
  }
  const markdown = (text: string) => (
    <Markdown
      text={text.replace(/\[\[([^\]\n]+)\]\]/g, (whole, ref: string) => {
        const [id, label] = ref.split('|')
        const target = allPages.find((p) => p.id === id || p.title === id)
        return target
          ? `[${(label || target.title).replace(/[[\]]/g, '')}](wiki://${target.id})`
          : whole
      })}
      navs={[
        {
          scheme: 'wiki://',
          onNavigate: (href) => {
            const p = allPages.find((p) => p.id === href.slice(7))
            if (p) select(p)
          },
        },
      ]}
    />
  )
  const resultIds = query.trim()
    ? [...new Set(searchWiki(pages, query, 1000).map((s) => s.id))]
    : []
  const literalMatches = pages.filter((p) =>
    query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((w) =>
        `${p.title}\n${p.knowledge?.aliases.join(' ') ?? ''}\n${p.body}`.toLowerCase().includes(w),
      ),
  )
  const filtered = query.trim()
    ? resultIds.length
      ? resultIds.map((id) => pages.find((p) => p.id === id)!)
      : literalMatches
    : pages
  const linkedNames =
    selected?.campaignIds.map((id) => campaigns.find((c) => c.id === id)?.card.campaign ?? id) ?? []
  const references = selected
    ? allPages.filter(
        (p) => p.sourceIds.includes(selected.id) || p.body.includes(`[[${selected.id}`),
      )
    : []
  return (
    <section
      className={`cheil-wiki${campaignId ? ' cheil-wiki-embedded' : ''}`}
      data-testid="cheil-wiki"
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={drop}
    >
      <header className="cheil-wiki-head">
        <div className="cheil-wiki-heading">
          <h2>{campaignId ? w.materials : w.title}</h2>
          <p>{w.intro}</p>
        </div>
        <div className="cheil-wiki-actions">
          <button
            className="btn btn-primary"
            disabled={busy}
            aria-expanded={importOpen}
            onClick={() => setImportOpen(!importOpen)}
          >
            {w.add}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void refresh()}>
            {w.refresh}
          </button>
          <button
            className="btn btn-secondary"
            aria-haspopup="dialog"
            onClick={() => setOptionsOpen(true)}
          >
            {w.options}
          </button>
          <OptionsDialog open={optionsOpen} title={w.options} onClose={() => setOptionsOpen(false)}>
            <KakaoSend lang={lang} call={call} />
            <div className="cheil-wiki-options">
              <p>{root}</p>
              <button className="btn btn-secondary" onClick={() => void run({ op: 'openFolder' })}>
                {w.folder}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => void run({ op: 'openObsidian' })}
              >
                {w.obsidian}
              </button>
              <p>{w.obsidianHint}</p>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={async () => {
                  if (!canLeave()) return
                  const reply = await run({ op: 'chooseRoot' })
                  if (reply.ok && reply.root) {
                    setSelected(null)
                    setEditing(false)
                    setAnswer(null)
                  }
                }}
              >
                {w.changeFolder}
              </button>
            </div>
          </OptionsDialog>
        </div>
      </header>
      {pages.length > 0 && (
        <section className="cheil-wiki-ask" aria-label={w.ask}>
          <TaskAiPicker task={taskAi} disabled={busy || !!preview} />
          <h3>{w.ask}</h3>
          <p>{w.aiHint}</p>
          <p className="cheil-wiki-ask-scope">
            {w.scope}: {scope ? campaigns.find((c) => c.id === scope)?.card.campaign : w.all}
          </p>
          <textarea
            aria-label={w.question}
            disabled={busy}
            placeholder={w.question}
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !question.trim()}
            onClick={() => void ask()}
          >
            {busy ? w.working : w.ask}
          </button>
          {preview && (
            <section className="cheil-wiki-preview" aria-label={w.preview}>
              <h4>{w.preview}</h4>
              <p>{preview.question}</p>
              <p>
                {preview.provider} · {preview.local ? w.localOnly : w.external}
              </p>
              {preview.labels.length > 0 && <p>{preview.labels.join(' · ')}</p>}
              {preview.blocked && <p role="alert">{w.blocked}</p>}
              <ol>
                {preview.excerpts.map((source, i) => (
                  <li key={`${source.id}:${i}`}>
                    <strong>{source.title}</strong>
                    <p>{source.location}</p>
                    <pre>{source.text}</pre>
                  </li>
                ))}
              </ol>
              {!preview.local && !preview.blocked && (
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
                onClick={async () => {
                  setBusy(true)
                  setMessage('')
                  try {
                    const r = await call({ op: 'answer', draftId: preview.id, approved })
                    if (r.ok && r.answer && r.excerpts) {
                      setAnswer({
                        text: r.answer,
                        sources: r.excerpts,
                        question: preview.question,
                      })
                      setPreview(null)
                    } else
                      setMessage(
                        r.ok ? w.error : r.reason === 'conflict' ? w.conflict : r.error || w.error,
                      )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? w.working : w.generate}
              </button>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                {w.dismiss}
              </button>
            </section>
          )}
          {answer && (
            <div className="cheil-wiki-answer">
              <div className="cheil-wiki-body">{markdown(answer.text)}</div>
              <KakaoSend lang={lang} call={call} text={answer.text} />
              <ol>
                {answer.sources.map((s) => (
                  <li key={`${s.id}:${s.location}`}>
                    <button
                      className="cheil-kb-link"
                      onClick={() => {
                        const p = allPages.find((p) => p.id === s.id)
                        if (p) select(p)
                      }}
                    >
                      {s.title}
                    </button>
                    <p>{s.location}</p>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
              <p>{w.review}</p>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run({
                    op: 'saveAnswer',
                    title: answer.question.slice(0, 200),
                    body: `${answer.text}\n\n${answer.sources.map((s, i) => `[${i + 1}] [[${s.id}|${s.title}]]`).join('\n')}`,
                    sources: answer.sources
                      .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
                      .map((s) => ({ id: s.id, version: s.version })),
                    campaignId: scope || undefined,
                  })
                  if (r.ok && r.page) {
                    select(r.page)
                    setAnswer(null)
                  }
                }}
              >
                {w.saveAnswer}
              </button>
              <button className="btn btn-secondary" onClick={() => setAnswer(null)}>
                {w.dismiss}
              </button>
            </div>
          )}
        </section>
      )}
      <OptionsDialog open={importOpen} title={w.add} onClose={() => setImportOpen(false)}>
        <div className="cheil-wiki-import">
          <p>{w.drop}</p>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void addFiles()}>
            {w.files}
          </button>
          <input
            aria-label={w.titleField}
            placeholder={w.titleField}
            value={newTitle}
            maxLength={200}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            aria-label={w.bodyField}
            placeholder={w.bodyField}
            rows={4}
            maxLength={1000000}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !newTitle.trim() || !newBody.trim()}
            onClick={async () => {
              const r = await run({
                op: 'addText',
                title: newTitle,
                body: newBody,
                campaignId: scope || undefined,
              })
              if (r.ok) {
                setNewTitle('')
                setNewBody('')
                setImportOpen(false)
              }
            }}
          >
            {w.save}
          </button>
        </div>
      </OptionsDialog>
      {message && (
        <p role="status" className="cheil-wiki-message">
          {message}
        </p>
      )}
      <div className="cheil-wiki-grid">
        <aside className="cheil-wiki-list" aria-label={w.library}>
          <div className="cheil-wiki-library-head">
            <h3>{w.library}</h3>
            <span>{pages.length}</span>
          </div>
          <input
            aria-label={w.search}
            placeholder={w.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!campaignId && (
            <select
              aria-label={w.scope}
              value={scope}
              disabled={busy}
              onChange={(e) => {
                if (!canLeave()) return
                setScope(e.target.value)
                setSelected(null)
                setAnswer(null)
                setEditing(false)
              }}
            >
              <option value="">{w.all}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.card.campaign}
                </option>
              ))}
            </select>
          )}
          <p className="cheil-wiki-meta">
            {filtered.length} ·{' '}
            {scope ? campaigns.find((c) => c.id === scope)?.card.campaign : w.all}
          </p>
          {!filtered.length && (
            <p className="cheil-wiki-list-empty">{query.trim() ? w.noResults : w.empty}</p>
          )}
          <details
            key={'sources-' + scope}
            open
            className="cheil-wiki-section"
            data-wiki-section="sources"
          >
            <summary>
              {w.listSections.split('|')[0]} · {filtered.filter((p) => p.kind !== 'page').length}
            </summary>
            {filtered
              .filter((p) => p.kind !== 'page')
              .map((p) => (
                <div className="cheil-wiki-list-item" key={p.id}>
                  <button
                    className={`cheil-wiki-row${selected?.id === p.id ? ' active' : ''}`}
                    onClick={() => select(p)}
                  >
                    <strong>{p.title}</strong>
                    <span>
                      {p.kind === 'page' ? w.page : w.source}
                      {p.stale ? ` · ${w.stale}` : ''}
                    </span>
                  </button>
                  <button
                    className="cheil-wiki-list-delete"
                    disabled={busy}
                    title={w.remove + ': ' + p.title}
                    aria-label={w.remove + ': ' + p.title}
                    onClick={() => {
                      if (select(p)) setDeleteOpen(true)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </details>
          <details
            key={'knowledge-' + scope}
            className="cheil-wiki-section"
            data-wiki-section="knowledge"
          >
            <summary>
              {w.page} · {filtered.filter((p) => p.kind === 'page').length}
            </summary>
            <p className="cheil-wiki-meta">{w.knowledgeHelp}</p>
            {filtered
              .filter((p) => p.kind === 'page')
              .map((p) => (
                <div className="cheil-wiki-list-item" key={p.id}>
                  <button
                    className={`cheil-wiki-row${selected?.id === p.id ? ' active' : ''}`}
                    onClick={() => select(p)}
                  >
                    <strong>{p.title}</strong>
                    <span>
                      {p.kind === 'page' ? w.page : w.source}
                      {p.stale ? ` · ${w.stale}` : ''}
                    </span>
                  </button>
                  <button
                    className="cheil-wiki-list-delete"
                    disabled={busy}
                    title={w.remove + ': ' + p.title}
                    aria-label={w.remove + ': ' + p.title}
                    onClick={() => {
                      if (select(p)) setDeleteOpen(true)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </details>
          <WikiReviewSections
            key={scope}
            lang={lang}
            pages={pages}
            campaignId={scope || undefined}
            call={call}
            onSaved={(p) => {
              if (p) select(p)
              void refresh()
            }}
          />
          <details className="cheil-wiki-section">
            <summary>{w.organize}</summary>
            <p className="cheil-wiki-meta">{w.manageHelp}</p>
            <WikiStructure
              lang={lang}
              pages={allPages}
              selected={selected}
              campaignId={scope || undefined}
              call={call}
              onSaved={(p) => {
                if (p) select(p)
                void refresh()
              }}
            />
          </details>
          {scope && (
            <button
              className="btn btn-secondary"
              disabled={busy}
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen(!linkOpen)}
            >
              {w.linkExisting}
            </button>
          )}
          {scope && linkOpen && (
            <div className="cheil-wiki-linklist">
              {allPages
                .filter((p) => !p.campaignIds.includes(scope))
                .map((p) => (
                  <button
                    className="cheil-wiki-row"
                    key={p.id}
                    disabled={busy}
                    onClick={() =>
                      void run({ op: 'link', id: p.id, campaignId: scope, linked: true })
                    }
                  >
                    {p.title} ＋
                  </button>
                ))}
            </div>
          )}
        </aside>
        <div className="cheil-wiki-main">
          <article className="cheil-wiki-reader">
            {selected ? (
              <>
                <div className="cheil-wiki-actions">
                  <h3>{selected.title}</h3>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      if (editing && !canLeave()) return
                      setEditing(!editing)
                    }}
                  >
                    {w.edit}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => setDeleteOpen(true)}
                  >
                    {w.remove}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (!canLeave()) return
                      const r = await call({
                        op: 'read',
                        id: selected.id,
                        campaignId: scope || undefined,
                      })
                      if (r.ok && r.page) select(r.page)
                    }}
                  >
                    {w.reload}
                  </button>
                </div>
                <OptionsDialog
                  open={deleteOpen}
                  title={w.remove}
                  onClose={() => setDeleteOpen(false)}
                >
                  <p className="cheil-delete-title">{selected.title}</p>
                  <div role="alert">
                    <p>{w.deleteHint}</p>
                    <p>
                      {linkedNames.join(' · ') || w.common} · {w.related}: {references.length}
                    </p>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (!canLeave()) return
                        const r = await run({
                          op: 'trash',
                          id: selected.id,
                          expectedVersion: selected.version,
                        })
                        if (r.ok) {
                          setSelected(null)
                          setEditing(false)
                        }
                      }}
                    >
                      {w.confirmDelete}
                    </button>
                  </div>
                </OptionsDialog>
                <p className="cheil-wiki-meta">
                  {selected.updatedAt.slice(0, 10)} · {linkedNames.join(' · ') || w.common}
                  {selected.needsReview ? ` · ${w.review}` : ''}
                  {selected.stale ? ` · ${w.stale}` : ''}
                </p>
                {editing ? (
                  <div className="cheil-wiki-editor">
                    <input
                      aria-label={w.editTitle}
                      value={title}
                      maxLength={200}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <textarea
                      aria-label={w.editBody}
                      value={body}
                      maxLength={1000000}
                      rows={16}
                      onChange={(e) => setBody(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={async () => {
                        const r = await run({
                          op: 'save',
                          id: selected.id,
                          title,
                          body,
                          expectedVersion: selected.version,
                          campaignId: scope || undefined,
                        })
                        if (r.ok && r.page) {
                          setSelected(r.page)
                          setEditing(false)
                        }
                      }}
                    >
                      {w.save}
                    </button>
                  </div>
                ) : (
                  <div className="cheil-wiki-body">{markdown(selected.body)}</div>
                )}
                {selected.origin && (
                  <p className="cheil-wiki-meta">
                    {w.original}: {selected.origin}
                    {selected.originMissing ? ` · ${w.originalMissing}` : ''}
                  </p>
                )}
                <div className="cheil-wiki-evidence">
                  {selected.sourceIds.map((id) => {
                    const p = allPages.find((p) => p.id === id)
                    return p ? (
                      <button className="btn btn-secondary" key={id} onClick={() => select(p)}>
                        {w.source}: {p.title}
                      </button>
                    ) : (
                      <span key={id}>{w.missing}</span>
                    )
                  })}
                  {references.map((p) => (
                    <button className="btn btn-secondary" key={p.id} onClick={() => select(p)}>
                      {w.related}: {p.title}
                    </button>
                  ))}
                </div>
                <details>
                  <summary>{w.history}</summary>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      const r = await call({ op: 'history', id: selected.id })
                      if (r.ok) setVersions(r.versions ?? [])
                    }}
                  >
                    {w.refresh}
                  </button>
                  {versions.map((v) => (
                    <button
                      className="btn btn-secondary"
                      key={v}
                      disabled={busy}
                      onClick={async () => {
                        if (!canLeave() || !window.confirm(w.restoreConfirm)) return
                        const r = await run({
                          op: 'restore',
                          id: selected.id,
                          version: v,
                          expectedVersion: selected.version,
                        })
                        if (r.ok && r.page) {
                          setSelected(r.page)
                          setEditing(false)
                          setTitle(r.page.title)
                          setBody(r.page.body)
                        }
                      }}
                    >
                      {w.restore} · {v.slice(0, 8)}
                    </button>
                  ))}
                </details>
                <details>
                  <summary>{w.connections}</summary>
                  {campaigns.map((c) => (
                    <label className="cheil-wiki-check" key={c.id}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={selected.campaignIds.includes(c.id)}
                        onChange={async (e) => {
                          const linked = e.target.checked
                          const before = selected
                          setSelected({
                            ...selected,
                            campaignIds: linked
                              ? [...selected.campaignIds, c.id]
                              : selected.campaignIds.filter((id) => id !== c.id),
                          })
                          const r = await run({
                            op: 'link',
                            id: selected.id,
                            campaignId: c.id,
                            linked,
                          })
                          if (r.ok && r.page) setSelected(r.page)
                          else setSelected(before)
                        }}
                      />
                      {c.card.campaign}
                    </label>
                  ))}
                </details>
              </>
            ) : (
              <div className="cheil-wiki-empty">
                <span className="cheil-wiki-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 6h9l2 2 2-2h9v21h-9l-2 2-2-2H5zM16 8v21M8 12h5m-5 5h5m6-5h5m-5 5h5" />
                  </svg>
                </span>
                <h3>{pages.length ? w.select : w.start}</h3>
                <p>{pages.length ? w.intro : w.drop}</p>
                {!pages.length && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => setImportOpen(true)}
                  >
                    {w.add}
                  </button>
                )}
                <ol className="cheil-wiki-steps">
                  <li>{w.add}</li>
                  <li>{w.page}</li>
                  <li>{w.ask}</li>
                </ol>
              </div>
            )}
            {selected?.origin && /\.pdf$/i.test(selected.origin) && !editing && (
              <WikiOcr
                key={selected.id}
                lang={lang}
                page={selected}
                campaignId={scope || undefined}
                busy={busy}
                setBusy={setBusy}
                call={call}
                onSaved={(p) => {
                  select(p)
                  setPreview(null)
                  setAnswer(null)
                  void refresh()
                }}
              />
            )}
            {selected?.extraction && (
              <p>
                {w.pdfStatus}: {selected.extraction.ocrPages}/{selected.extraction.totalPages}
                {!!selected.extraction.cloudPages?.length &&
                  ` · Azure OCR: ${selected.extraction.cloudPages.join(', ')}`}
                {!!selected.extraction.unreadablePages.length &&
                  ` · ${w.incomplete}: ${selected.extraction.unreadablePages.join(', ')}`}
                {(selected.extraction.unreadablePages.length > 0 ||
                  selected.extraction.truncated) &&
                  ` · ${w.incomplete}`}
              </p>
            )}
            {selected?.origin && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={async () => {
                  if (!canLeave()) return
                  const r = await run({
                    op: 'reindex',
                    id: selected.id,
                    expectedVersion: selected.version,
                    campaignId: scope || undefined,
                  })
                  if (r.ok && r.page) select(r.page)
                }}
              >
                {w.reindex}
              </button>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
