/** Cheil fork: extract appearance, keep editable Markdown, and create styled starter documents. */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../locale'
import {
  CHEIL_STYLE_BRIDGE,
  type CheilStyleApi,
  type StyleDraft,
  type SavedStyle,
  type StyleSelection,
  type StyleRequest,
  type StyleReply,
} from '../../../shared/cheil-style-api'
import { styleWords } from './style-words'
import './DocumentStyles.css'
import { ReferenceEditor } from './ReferenceEditor'
import { referenceWords } from './reference-words'
import { readReferenceTemplate, type ReferenceTemplate } from '../../../shared/reference-template'
import { DesignStudio } from './DesignStudio'
import { PinterestPanel } from './PinterestPanel'
export function styleBridge(): CheilStyleApi | undefined {
  return (window as unknown as Record<string, CheilStyleApi | undefined>)[CHEIL_STYLE_BRIDGE]
}
function initialSelection(d: StyleDraft): StyleSelection {
  const p = d.profile,
    colors = p.colors.map((c) => c.value)
  const chroma = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return Math.max(...c) - Math.min(...c)
  }
  const sizes = p.sizes.map((s) => Number(s.value))
  const closest = (target: number) =>
    sizes.length
      ? sizes.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
      : target
  const font = p.fonts.find((f) => /^[\p{L}\p{N} ._()-]{1,80}$/u.test(f.value))?.value ?? 'Arial'
  return {
    font,
    headingPt: closest(28),
    bodyPt: closest(12),
    accent: colors.find((c) => chroma(c) > 35) ?? colors[0] ?? '#315C4C',
    text: '#25332D',
    background: '#FFFFFF',
    ...d.selection,
  }
}
export function DocumentStyles({ onBack }: { onBack(): void }) {
  const { lang } = useI18n(),
    w = styleWords(lang),
    rw = referenceWords(lang),
    id = useId(),
    api = styleBridge()
  const [template, setTemplate] = useState<ReferenceTemplate | undefined>()
  const [documentTitle, setDocumentTitle] = useState(w.documentTitle),
    [documentBody, setDocumentBody] = useState(w.documentBody)
  const [styles, setStyles] = useState<SavedStyle[]>([]),
    [saved, setSaved] = useState<SavedStyle | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  const [draft, setDraft] = useState<StyleDraft | null>(null),
    [choice, setChoice] = useState<StyleSelection>({}),
    [name, setName] = useState('')
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState('')
  const [entries, setEntries] = useState<Array<{ slug: string; name: string }>>([]),
    [format, setFormat] = useState<'docx' | 'pptx' | 'xlsx'>('pptx')
  useEffect(() => {
    let live = true
    void api
      ?.request({ op: 'list' })
      .then((r) => {
        if (live && r.ok) setStyles(r.styles ?? [])
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [api])
  const accept = (r: Extract<StyleReply, { ok: true }>) => {
    if (!r.draft) return
    setDraft(r.draft)
    setTemplate(r.draft.profile.template)
    if (r.draft.profile.template) setFormat('pptx')
    setChoice(initialSelection(r.draft))
    setName(r.draft.profile.name === 'My style' ? w.title : r.draft.profile.name)
    setSaved(r.saved ?? null)
  }
  const request = async (req: StyleRequest) => {
    if (!api || busy) return
    setBusy(true)
    setMessage('')
    try {
      const r = await api.request(req)
      if (!r.ok) {
        setMessage(
          r.reason === 'conflict'
            ? w.conflict
            : r.reason === 'unreadable'
              ? req.op === 'referenceImage'
                ? rw.unreadable
                : w.unreadable
              : w.failed,
        )
        return
      }
      if (r.canceled) return
      accept(r)
      if (req.op === 'draftText' && r.text !== undefined) setDocumentBody(r.text)
      if (r.saved) {
        setSaved(r.saved)
        setStyles((prev) => [r.saved!, ...prev.filter((s) => s.id !== r.saved!.id)])
        setMessage(w.saved)
      }
      if (r.entries) {
        setEntries(r.entries)
        if (!r.entries.length) setMessage(w.noResult)
      }
      if (req.op === 'instruction' && r.text) {
        await navigator.clipboard.writeText(r.text)
        setMessage(w.copied)
      }
      if (req.op === 'export' || req.op === 'create')
        setMessage(r.opened === false ? w.failed : w.saved)
    } catch {
      setMessage(w.failed)
    } finally {
      setBusy(false)
    }
  }
  const payload = () => ({
    draft: draft!.id,
    name,
    selection: choice,
    ...(template ? { template } : {}),
  })
  const change = (key: keyof StyleSelection, value: string | number) =>
    setChoice((prev) => ({ ...prev, [key]: value }))
  let structureValid = true
  try {
    if (template) readReferenceTemplate(template)
  } catch {
    structureValid = false
  }
  const valid =
    structureValid &&
    !!draft &&
    name.trim().length > 0 &&
    Number.isFinite(choice.headingPt) &&
    Number(choice.headingPt) >= 4 &&
    Number(choice.headingPt) <= 200 &&
    Number.isFinite(choice.bodyPt) &&
    Number(choice.bodyPt) >= 4 &&
    Number(choice.bodyPt) <= 200
  const docStyle = {
    '--style-accent': choice.accent ?? '#315C4C',
    '--style-text': choice.text ?? '#25332D',
    '--style-page': choice.background ?? '#FFFFFF',
    fontFamily: `"${choice.font ?? 'Arial'}",sans-serif`,
  } as CSSProperties
  return (
    <section
      className="quick-start cheil-my-templates cheil-style-library"
      data-testid="cheil-styles"
      aria-busy={busy}
    >
      <div className="section-head">
        <h3 className="section-label" ref={headingRef} tabIndex={-1}>
          {w.title}
        </h3>
        <button className="cheil-campaign-add" onClick={onBack}>
          {w.back}
        </button>
      </div>
      <DesignStudio />
      <details>
        <summary>{w.title}</summary>
        <PinterestPanel
          disabled={busy}
          onStyle={(r) => {
            accept(r)
            if (r.saved) {
              setStyles((prev) => [r.saved!, ...prev.filter((s) => s.id !== r.saved!.id)])
              setMessage(w.saved)
            }
          }}
        />
        <div className="cheil-style-toolbar">
          <button
            disabled={busy}
            data-testid="reference-import"
            onClick={() => void request({ op: 'referenceImage' })}
          >
            {rw.extract}
          </button>
          <button
            onClick={() => void request({ op: 'extract' })}
            disabled={busy}
            data-testid="style-extract"
          >
            {w.extract}
          </button>
          <button onClick={() => void request({ op: 'import' })} disabled={busy}>
            {w.importMd}
          </button>
          <label>
            {w.library}
            <select
              value={saved?.id ?? ''}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) void request({ op: 'load', id: e.target.value })
              }}
              data-testid="style-library"
            >
              <option value="">—</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="cheil-style-hint">{w.localHint}</p>
        <details className="cheil-style-catalog">
          <summary>{w.catalog}</summary>
          <p className="cheil-style-hint">{w.catalogHint}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void request({ op: 'catalogSearch', query })
            }}
          >
            <input
              aria-label={w.catalog}
              value={query}
              maxLength={80}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button disabled={busy}>{w.search}</button>
          </form>
          <div className="cheil-style-entries">
            {entries.map((e) => (
              <button
                key={e.slug}
                disabled={busy}
                onClick={() => void request({ op: 'catalogLoad', slug: e.slug })}
              >
                {e.name}
              </button>
            ))}
          </div>
        </details>
        {draft ? (
          <>
            <div className="cheil-style-columns">
              <div className="cheil-style-settings">
                <label htmlFor={`${id}-name`}>{w.name}</label>
                <input
                  id={`${id}-name`}
                  value={name}
                  maxLength={80}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="style-name"
                />
                <label htmlFor={`${id}-font`}>{w.font}</label>
                <input
                  id={`${id}-font`}
                  list={`${id}-fonts`}
                  value={choice.font ?? ''}
                  maxLength={80}
                  disabled={busy}
                  onChange={(e) => change('font', e.target.value)}
                  data-testid="style-font"
                />
                <datalist id={`${id}-fonts`}>
                  {[
                    ...new Set([
                      ...draft.profile.fonts.map((f) => f.value),
                      'Arial',
                      '맑은 고딕',
                      'Pretendard',
                    ]),
                  ].map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
                <div className="cheil-style-sizes">
                  {(['headingPt', 'bodyPt'] as const).map((key, i) => (
                    <label key={key}>
                      {i ? w.body : w.heading}
                      <input
                        type="number"
                        min={4}
                        max={200}
                        step="0.5"
                        value={choice[key] ?? 12}
                        disabled={busy}
                        onChange={(e) => change(key, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                {(['accent', 'text', 'background'] as const).map((key) => (
                  <label className="cheil-style-color" key={key}>
                    <span>{w[key]}</span>
                    <input
                      type="color"
                      value={choice[key] ?? '#FFFFFF'}
                      disabled={busy}
                      onChange={(e) => change(key, e.target.value)}
                      data-testid={`style-${key}`}
                    />
                    <code>{choice[key]}</code>
                  </label>
                ))}
                <div className="cheil-style-palette">
                  {draft.profile.colors.slice(0, 12).map((c, i) => (
                    <button
                      key={`${c.value}-${i}`}
                      style={{ background: c.value }}
                      aria-label={`${w.accent} ${c.value}`}
                      title={`${c.value} · ${c.basis}`}
                      disabled={busy}
                      onClick={() => change('accent', c.value)}
                    />
                  ))}
                </div>
                <p className="cheil-style-hint">{w.fontHint}</p>
                <p className="cheil-style-hint">
                  {w.source}:{' '}
                  {draft.profile.source.url ?? draft.profile.source.author ?? w.localHint}
                  {draft.profile.source.license ? ` · ${draft.profile.source.license}` : ''}
                </p>
              </div>
              <div className="cheil-style-preview">
                <div className="cheil-style-preview-label">{w.preview}</div>
                {template ? (
                  <ReferenceEditor
                    template={template}
                    choice={choice}
                    title={documentTitle}
                    body={documentBody}
                    disabled={busy}
                    onChange={setTemplate}
                  />
                ) : (
                  <div className="cheil-style-paper" style={docStyle} data-testid="style-preview">
                    <h2 style={{ fontSize: `${Math.min(44, choice.headingPt ?? 28)}pt` }}>
                      {w.documentTitle}
                    </h2>
                    <p style={{ fontSize: `${Math.min(24, choice.bodyPt ?? 12)}pt` }}>
                      {w.documentBody}
                    </p>
                    <div className="cheil-style-rule" />
                  </div>
                )}
              </div>
            </div>
            <div className="cheil-style-actions">
              <button
                disabled={busy || !valid}
                onClick={() =>
                  void request({ op: 'save', ...payload(), id: saved?.id, version: saved?.version })
                }
                data-testid="style-save"
              >
                {w.save}
              </button>
              {saved ? (
                <>
                  <button
                    disabled={busy || !valid}
                    onClick={() => void request({ op: 'save', ...payload() })}
                  >
                    {w.saveCopy}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void request({ op: 'open', id: saved.id })}
                  >
                    {w.openMd}
                  </button>
                </>
              ) : null}
              <button
                disabled={busy || !valid}
                onClick={() => void request({ op: 'export', ...payload() })}
              >
                {w.exportMd}
              </button>
              <button
                disabled={busy || !valid}
                onClick={() => void request({ op: 'instruction', ...payload() })}
              >
                {w.copy}
              </button>
            </div>
            {template && (
              <div className="cheil-reference-draft">
                <strong>{rw.apply}</strong>
                <label>
                  {rw.title}
                  <input
                    data-testid="reference-title"
                    value={documentTitle}
                    maxLength={160}
                    disabled={busy}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                  />
                </label>
                <label>
                  {rw.body}
                  <textarea
                    data-testid="reference-body"
                    rows={7}
                    value={documentBody}
                    maxLength={30000}
                    disabled={busy}
                    onChange={(e) => setDocumentBody(e.target.value)}
                  />
                </label>
                <p className="cheil-style-hint">{rw.draftHint}</p>
                <button disabled={busy} onClick={() => void request({ op: 'draftText' })}>
                  {rw.importDraft}
                </button>
                <p className="cheil-style-hint">{rw.wordHint}</p>
              </div>
            )}
            <div className="cheil-style-create">
              <label>
                {w.newDocument}
                <select
                  value={format}
                  disabled={busy}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                >
                  <option value="docx">Word (.docx)</option>
                  <option value="pptx">PowerPoint (.pptx)</option>
                  {!template && <option value="xlsx">Excel (.xlsx)</option>}
                </select>
              </label>
              <button
                disabled={busy || !valid}
                onClick={() =>
                  void request({
                    op: 'create',
                    ...payload(),
                    format,
                    title: template ? documentTitle : w.documentTitle,
                    body: template ? documentBody : w.documentBody,
                  })
                }
                data-testid="style-create"
              >
                {template ? rw.create : w.newDocument}
              </button>
              {template && (
                <button
                  disabled={busy || !valid}
                  data-testid="reference-new"
                  onClick={() =>
                    void request({
                      op: 'create',
                      ...payload(),
                      format,
                      title: w.documentTitle,
                      body: w.documentBody,
                    })
                  }
                >
                  {rw.newDoc}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="cheil-style-empty">{w.empty}</p>
        )}
        <p className="cheil-style-status" role="status" data-testid="style-status">
          {busy ? w.busy : message}
        </p>
      </details>
    </section>
  )
}
