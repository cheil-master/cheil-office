/** Cheil fork: local QR preview, image clipboard and native PNG/SVG export. */
import { useState } from 'react'
import type { CheilQrApi, QrRequest } from '../../../shared/cheil-qr-api'
import { useI18n } from '../locale'
import { qrWords } from './qr-words'
import { styleWords } from './style-words'
import './QrTool.css'
export function QrTool() {
  const { lang } = useI18n(),
    w = qrWords(lang),
    common = styleWords(lang)
  const api = (window as unknown as { aiOfficeCheilQr?: CheilQrApi }).aiOfficeCheilQr
  const [text, setText] = useState(''),
    [size, setSize] = useState(512)
  const [png, setPng] = useState(''),
    [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<'invalid' | 'failed' | 'saved' | 'copied' | ''>('')
  const byteLength = new TextEncoder().encode(text).length
  const valid = !!text.trim() && byteLength <= 1000
  const run = async (req: QrRequest) => {
    if (!api || busy) return
    setBusy(true)
    setMessage('')
    try {
      const r = await api.request(req)
      if (!r.ok) setMessage(r.reason === 'invalid' ? 'invalid' : 'failed')
      else if (req.op === 'preview') setPng(r.png ?? '')
      else if (!r.canceled) setMessage(req.op === 'copy' ? 'copied' : 'saved')
    } catch {
      setMessage('failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="content cheil-tool cheil-qr-tool" data-testid="cheil-tool-qr">
      <h2 className="cheil-tool-title">{w.title}</h2>
      <p className="cheil-qr-hint">{w.offline}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run({ op: 'preview', text, size })
        }}
      >
        <label className="cheil-qr-input">
          {w.content}
          <textarea
            aria-label={w.content}
            aria-describedby="qr-input-help"
            value={text}
            maxLength={1000}
            rows={4}
            required
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value)
              setPng('')
              setMessage('')
            }}
            placeholder={w.placeholder}
          />
        </label>
        <p id="qr-input-help" className="cheil-qr-hint">
          {w.limit} ({byteLength.toLocaleString()} / 1,000)
        </p>
        <div className="cheil-qr-actions">
          <label>
            {w.size}{' '}
            <select
              aria-label={w.size}
              value={size}
              disabled={busy}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setPng('')
                setMessage('')
              }}
            >
              {[256, 512, 1024].map((n) => (
                <option key={n} value={n}>
                  {n} × {n} px
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={!api || busy || !valid}>
            {busy ? common.busy : w.generate}
          </button>
        </div>
      </form>
      <p role="status" aria-live="polite">
        {message === 'invalid' ? w.invalid : message ? common[message] : ''}
      </p>
      {png ? (
        <section className="cheil-qr-result" aria-label={common.preview}>
          <img src={png} alt={w.title} width={256} height={256} />
          <div className="cheil-qr-result-body">
            <h3>{common.preview}</h3>
            <p className="cheil-qr-hint">{w.scan}</p>
            <div className="cheil-qr-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => void run({ op: 'copy', text, size })}
              >
                {w.copy}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void run({ op: 'save', text, size, format: 'png' })}
              >
                {w.savePng}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void run({ op: 'save', text, size, format: 'svg' })}
              >
                {common.download}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="cheil-qr-empty">{w.empty}</div>
      )}
      <p className="cheil-qr-hint">{w.static}</p>
    </main>
  )
}
