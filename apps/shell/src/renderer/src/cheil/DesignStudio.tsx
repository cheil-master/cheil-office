/** Cheil fork: a reference becomes a reusable design system before draft generation. */
import { useEffect, useState } from 'react'
import { useI18n } from '../locale'
import { CHEIL_STYLE_BRIDGE, type CheilStyleApi } from '../../../shared/cheil-style-api'
import type { DesignReferenceEntry } from '../../../../../slides/src/shared/design-reference'
import { PinterestPanel } from './PinterestPanel'
import { studioWords } from './studio-words'
import './DesignStudio.css'
export function DesignStudio() {
  const { lang } = useI18n(),
    w = studioWords(lang)
  const api = (window as unknown as Record<string, CheilStyleApi | undefined>)[CHEIL_STYLE_BRIDGE]
  const [designs, setDesigns] = useState<DesignReferenceEntry[]>([])
  const [key, setKey] = useState(''),
    [board, setBoard] = useState(''),
    [pins, setPins] = useState<string[]>([])
  const [name, setName] = useState(''),
    [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const selected = designs.find((d) => d.key === key)
  async function refresh() {
    try {
      const r = await api?.request({ op: 'designList' })
      if (r?.ok) setDesigns(r.designs ?? [])
    } catch {
      setMessage(w.failed)
    }
  }
  useEffect(() => {
    void refresh() /* Refresh after the editor saved a design and Home regains focus. */
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])
  async function importMd() {
    if (!api || busy) return
    setBusy(true)
    try {
      const r = await api.request({ op: 'designImport' })
      if (r.ok && r.designs) {
        setDesigns(r.designs)
        setKey(r.designs[0]?.key ?? '')
      } else if (!r.ok) setMessage(w.failed)
    } catch {
      setMessage(w.failed)
    } finally {
      setBusy(false)
    }
  }
  async function create() {
    if (!api || busy) return
    setBusy(true)
    setMessage('')
    try {
      const r = await api.request({
        op: 'designCreate',
        name: selected?.name ?? name.trim(),
        brief,
        ...(key ? { key } : { board, pins }),
      })
      setMessage(r.ok ? w.opened : w.failed)
    } catch {
      setMessage(w.failed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="cheil-design-studio" data-testid="design-studio" aria-busy={busy}>
      <header>
        <span className="cheil-design-kicker">PINTEREST → DESIGN MD → PPT</span>
        <h2>{w.title}</h2>
        <p>{w.intro}</p>
      </header>
      <div className="cheil-design-workflow">
        <div>
          <b>01</b>
          <strong>{w.reference}</strong>
          <span>{w.referenceHint}</span>
        </div>
        <div>
          <b>02</b>
          <strong>{w.rules}</strong>
          <span>{w.rulesHint}</span>
        </div>
        <div>
          <b>03</b>
          <strong>{w.compose}</strong>
          <span>{w.composeHint}</span>
        </div>
      </div>
      <div className="cheil-design-columns">
        <div className="cheil-design-source">
          <label>
            {w.library}
            <select
              data-testid="design-library"
              value={key}
              disabled={busy}
              onChange={(e) => {
                setKey(e.target.value)
                setMessage('')
              }}
            >
              <option value="">{w.newDesign}</option>
              {designs.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void refresh()} disabled={busy}>
            {w.refresh}
          </button>
          <button onClick={() => void importMd()} disabled={busy}>
            {w.importMd}
          </button>
          {selected ? (
            <div className="cheil-design-rules">
              <h3>{selected.name}</h3>
              <div className="cheil-design-swatches">
                {Object.entries(selected.design.palette).map(([role, color]) => (
                  <span key={role} title={`${role}: ${color}`} style={{ backgroundColor: color }} />
                ))}
              </div>
              <p>{selected.design.composition}</p>
              <p>{selected.design.shapes}</p>
              {(['cover', 'comparison', 'process'] as const).map((role) => (
                <details key={role}>
                  <summary>{w[role]}</summary>
                  <p>{selected.design.layouts[role]}</p>
                </details>
              ))}
              <button onClick={() => void api?.request({ op: 'designOpen', key })}>
                {w.openMd}
              </button>
            </div>
          ) : (
            <>
              <label>
                {w.name}
                <input
                  value={name}
                  maxLength={64}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="design-name"
                />
              </label>
              <PinterestPanel
                disabled={busy}
                onStyle={() => {}}
                selection={{
                  label: w.select,
                  hint: w.connection,
                  board,
                  pins,
                  change: (b, p) => {
                    setBoard(b)
                    setPins(p)
                  },
                }}
              />
            </>
          )}
        </div>
        <div className="cheil-design-draft">
          <label>
            {w.draft}
            <textarea
              value={brief}
              maxLength={30000}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={w.placeholder}
              data-testid="design-brief"
            />
          </label>
          <div className="cheil-design-recipes">
            <span>{w.cover}</span>
            <span>{w.comparison}</span>
            <span>{w.process}</span>
          </div>
          <p>{w.adapt}</p>
          <p className="cheil-design-notice">{w.ai}</p>
          <button
            className="cheil-design-create"
            onClick={() => void create()}
            disabled={
              busy || brief.trim().length < 20 || (!selected && (!name.trim() || pins.length < 1))
            }
            data-testid="design-create"
          >
            {busy ? w.working : selected ? w.compose : w.create}
          </button>
          <p role="status">{message}</p>
        </div>
      </div>
    </section>
  )
}
