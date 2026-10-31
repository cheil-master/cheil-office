/** Cheil fork: bounded options dialogs do not shift the underlying workspace. */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../locale'
export function OptionsDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()
  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
    else if (!open && dialog?.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="cheil-options-dialog"
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          onClose()
      }}
    >
      <header>
        <h3>{title}</h3>
        <button className="cheil-icon-btn" aria-label={t('cancel')} onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}
