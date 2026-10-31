/** Cheil fork: account connection and board browsing inside the style library. */
import { useEffect, useState } from 'react'
import { useI18n } from '../locale'
import {
  CHEIL_STYLE_BRIDGE,
  type CheilStyleApi,
  type StyleReply,
} from '../../../shared/cheil-style-api'
import type {
  PinterestRequest,
  PinterestState,
  PinterestPin,
} from '../../../shared/cheil-pinterest-api'
import { pinterestWords } from './pinterest-words'
import { referenceWords } from './reference-words'
import { moodboardWords } from './moodboard-words'
export function PinterestPanel({
  onStyle,
  disabled = false,
  selection,
}: {
  onStyle(r: Extract<StyleReply, { ok: true }>): void
  disabled?: boolean
  selection?: {
    label: string
    hint: string
    board: string
    pins: string[]
    change(board: string, pins: string[]): void
  }
}) {
  const { lang } = useI18n(),
    w = pinterestWords(lang),
    m = moodboardWords(lang),
    rw = referenceWords(lang)
  const api = (window as unknown as Record<string, CheilStyleApi>)[CHEIL_STYLE_BRIDGE]
  const [state, setState] = useState<PinterestState>({ connected: false })
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [pins, setPins] = useState<PinterestPin[]>([]),
    [selected, setSelected] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    let live = true
    void api
      ?.request({ op: 'pinterest', action: 'status' })
      .then((r) => {
        if (live && r.ok && r.pinterest) setState(r.pinterest)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [api])
  async function run(action: PinterestRequest['action'], board?: string, pin?: string) {
    if (!api || busy || disabled) return
    setBusy(true)
    setMessage('')
    setConfirm(false)
    if (action === 'pins' || action === 'boards' || action === 'disconnect') {
      setPins([])
      selection?.change(board ?? '', [])
      setSelected(board ?? '')
    }
    try {
      let reply = await api.request({ op: 'pinterest', action, board, pin })
      if (reply.ok && reply.pinterest?.connected && action === 'connect')
        reply = await api.request({ op: 'pinterest', action: 'boards' })
      if (!reply.ok || !reply.pinterest) {
        setMessage(w.failed)
        return
      }
      const result = reply.pinterest
      setState((prev) => (result.connected ? { ...prev, ...result } : result))
      if (!result.connected) {
        setPins([])
        setSelected('')
      }
      if (result.pins) setPins(result.pins)
      if (reply.draft) {
        onStyle(reply)
        setMessage(m.saved)
        requestAnimationFrame(() =>
          document
            .querySelector('[data-testid=style-preview]')
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
        )
      }
      if (result.error)
        setMessage(
          result.error === 'login' ? w.login : action === 'reference' ? rw.unreadable : w.failed,
        )
    } catch {
      setMessage(w.failed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="cheil-pinterest" data-testid="pinterest-panel" aria-busy={busy}>
      <div className="cheil-style-toolbar">
        <strong>Pinterest</strong>
        <span>{state.connected ? w.connected : w.disconnected}</span>
        <button disabled={busy || disabled} onClick={() => void run('connect')}>
          {w.connect}
        </button>
        {state.connected && (
          <>
            <button disabled={busy || disabled} onClick={() => void run('boards')}>
              {w.boards}
            </button>
            <button disabled={busy || disabled} onClick={() => setConfirm(true)}>
              {w.disconnect}
            </button>
          </>
        )}
      </div>
      <p>{selection?.hint ?? w.hint}</p>
      {confirm && (
        <div>
          <p>{w.confirm}</p>
          <button onClick={() => void run('disconnect')}>{w.disconnect}</button>
          <button onClick={() => setConfirm(false)}>{w.cancel}</button>
        </div>
      )}
      <p role="status">{busy ? w.working : message}</p>
      {state.boards && (
        <div className="cheil-pinterest-boards">
          {state.boards.map((board) => (
            <button
              key={board.id}
              disabled={busy || disabled}
              aria-pressed={selected === board.id}
              onClick={() => void run('pins', board.id)}
            >
              <strong>{board.name}</strong>
              <span>{board.count}</span>
            </button>
          ))}
          {!state.boards.length && <p>{w.empty}</p>}
        </div>
      )}
      {state.more && (
        <button disabled={busy || disabled} onClick={() => void run('more')}>
          {w.more}
        </button>
      )}
      {selected && (
        <>
          <p>{m.preview}</p>
          {!selection && (
            <button
              disabled={busy || disabled || !pins.some((p) => p.image)}
              onClick={() => void run('style', selected)}
              data-testid="pinterest-style"
            >
              {m.create}
            </button>
          )}
          <div className="cheil-pinterest-pins">
            {pins.map((pin) => (
              <figure key={pin.id}>
                {selection ? (
                  <label className="cheil-design-pin">
                    <input
                      type="checkbox"
                      checked={selection.board === selected && selection.pins.includes(pin.id)}
                      disabled={
                        busy ||
                        disabled ||
                        !pin.image ||
                        (selection.pins.length >= 2 && !selection.pins.includes(pin.id))
                      }
                      onChange={() =>
                        selection.change(
                          selected,
                          selection.pins.includes(pin.id)
                            ? selection.pins.filter((id) => id !== pin.id)
                            : [...selection.pins, pin.id],
                        )
                      }
                    />
                    {selection.label}
                  </label>
                ) : (
                  <button
                    disabled={busy || disabled || !pin.image}
                    onClick={() => void run('reference', selected, pin.id)}
                  >
                    {rw.fromPin}
                  </button>
                )}
                {pin.image && <img src={pin.image} alt={pin.title} loading="lazy" />}
                <figcaption>{pin.title}</figcaption>
              </figure>
            ))}
          </div>
          {!busy && !pins.length && <p>{w.empty}</p>}
        </>
      )}
    </section>
  )
}

import './PinterestPanel.css'
