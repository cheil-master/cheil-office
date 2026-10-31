/** Cheil fork: a keyboard and pointer separator keeps long folder names usable. */
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../locale'
export function SidebarSizer() {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('cheil-sidebar-width'))
      return saved >= 168 && saved <= 360 ? saved : 208
    } catch {
      return 208
    }
  })
  const drag = useRef<{ x: number; width: number } | null>(null)
  const update = (value: number) =>
    setWidth(Math.round(Math.max(168, Math.min(360, window.innerWidth * 0.4, value))))
  useEffect(() => {
    ref.current?.parentElement?.style.setProperty('--cheil-sidebar-width', width + 'px')
    try {
      localStorage.setItem('cheil-sidebar-width', String(width))
    } catch {
      /* Storage can be disabled. */
    }
  }, [width])
  return (
    <div
      ref={ref}
      className="cheil-sidebar-sizer"
      role="separator"
      tabIndex={0}
      aria-label={t('folders')}
      aria-orientation="vertical"
      aria-valuemin={168}
      aria-valuemax={360}
      aria-valuenow={width}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          update(width + (e.key === 'ArrowRight' ? 16 : -16))
        }
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault()
          update(e.key === 'Home' ? 168 : 360)
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, width }
      }}
      onPointerMove={(e) => {
        if (drag.current) update(drag.current.width + e.clientX - drag.current.x)
      }}
      onPointerUp={(e) => {
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
    />
  )
}
