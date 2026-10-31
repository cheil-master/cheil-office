/** Cheil fork: official account limits vs measured app-session activity. */
import { useEffect, useRef, useState } from 'react'
import type { HomeAiUsage as Usage } from '../../../shared/ai-usage'
import type { CheilCampaignApi } from '../../../shared/cheil-campaign-api'
export function HomeAiUsage() {
  const [data, setData] = useState<Usage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    const outside = (e: PointerEvent) => {
      if (
        !panel.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])
  const running = useRef(false)
  const load = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      setData(await api.usage())
      setError('')
    } catch {
      setError('사용량 조회 실패 · 다시 확인')
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 60000)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    const off = window.aiOffice.onAiSettingsChanged?.(focus)
    const offStatus = window.aiOfficeSubscription?.onChanged(() => {
      setData(null)
      void load()
    })
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', focus)
      off?.()
      offStatus?.()
    }
  }, [])
  const name = (minutes: number | null) =>
    minutes === 10080 ? '주간' : minutes === 300 ? '5시간' : minutes ? minutes + '분' : '계정 한도'
  const format = (time: number | null) => (time ? new Date(time).toLocaleString() : '미제공')
  return (
    <section className="cheil-home-usage" aria-label="AI 사용량">
      <div className="cheil-usage-mini">
        {data?.codex?.windows.slice(0, 2).map((w, i) => (
          <div key={i}>
            <span>
              {name(w.minutes)} 사용 {w.usedPercent}%
            </span>
            <progress aria-label={name(w.minutes) + ' 사용률'} max={100} value={w.usedPercent} />
          </div>
        ))}
      </div>
      <button
        ref={trigger}
        className="cheil-usage-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {busy ? '사용량 조회 중…' : 'AI 사용량 확인'}
      </button>
      {open && (
        <div ref={panel} className="cheil-usage-popover" role="dialog" aria-label="AI 사용량 상세">
          <div className="cheil-usage-heading">
            <h4>AI 사용량</h4>
            <button className="set-btn" aria-label="AI 사용량 닫기" onClick={close}>
              ✕
            </button>
          </div>
          <button className="set-btn" disabled={busy} onClick={() => void load()}>
            새로고침
          </button>
          <p>
            계정 한도는 원 프로그램 사용을 포함합니다. 앱 내 집계는 이 앱에서 관측한 값만
            포함합니다.
          </p>
          {error && <p role="status">{error}</p>}
          {data?.codex && (
            <section>
              <strong>Codex · 계정 한도</strong>
              {data.codex.error && <p>{data.codex.error}</p>}
              {!data.codex.error && !data.codex.windows.length && (
                <p>계정에서 한도 수치를 제공하지 않았습니다.</p>
              )}
              {data.codex.windows.map((w, i) => (
                <div className="cheil-quota-window" key={i}>
                  <span>
                    {name(w.minutes)} · {w.bucket}
                  </span>
                  <strong>
                    사용 {w.usedPercent}% · 잔여 {Math.max(0, 100 - w.usedPercent)}%
                  </strong>
                  <progress
                    max={100}
                    value={w.usedPercent}
                    aria-label={name(w.minutes) + ' 계정 사용률'}
                  />
                  <small>초기화 {format(w.resetsAt)}</small>
                </div>
              ))}
              <small>계정 조회 {format(data.codex.updatedAt)}</small>
            </section>
          )}
          <h4>이번 앱 실행 중 집계</h4>
          {!data?.local.length && <p>아직 기록된 요청이 없습니다. 0% 잔여라는 뜻은 아닙니다.</p>}
          {data?.local.map((row) => (
            <section key={row.provider}>
              <strong>{row.provider}</strong>
              <p>
                요청 {row.requests}회 · 보고된 입력 {row.inputTokens.toLocaleString()} / 출력{' '}
                {row.outputTokens.toLocaleString()} 토큰
              </p>
              <small>
                토큰 보고 {row.tokenReports}회 · 요청은 내부 AI 호출·실패한 시도를 포함하며, 토큰
                미제공 응답은 합산하지 않습니다.
              </small>
              {row.windows.map((w, i) => (
                <p key={i}>
                  {w.window === 'seven_day' ? '주간' : '5시간'} 사용{' '}
                  {Math.round(w.utilization * 100)}% · 초기화 {format(w.resetsAt)} · 마지막 수신{' '}
                  {format(row.updatedAt)}
                </p>
              ))}
            </section>
          ))}
          {!data?.codex && (
            <p>
              API 잔액·계정 한도는 연결 방식에 따라 제공되지 않습니다. Claude 한도는 실행 중
              제공받은 최근 수치를 표시합니다.
            </p>
          )}
          <small>앱 재시작 시 앱 내 집계는 초기화됩니다. 자동 확인: 1분 간격.</small>
        </div>
      )}
    </section>
  )
}
