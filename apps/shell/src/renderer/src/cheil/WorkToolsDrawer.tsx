/** Cheil fork: native modal semantics supply focus trapping and Escape dismissal. */
import { useEffect, useRef } from 'react'
import { useI18n } from '../locale'
import { designWords } from './design-words'
import { WorkToolsNav, type WorkToolId } from './WorkTools'

export function WorkToolsDrawer({
  open,
  active,
  onPick,
  onClose,
}: {
  open: boolean
  active: WorkToolId | null
  onPick: (tool: WorkToolId) => void
  onClose: () => void
}) {
  const { lang, t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    else if (!open && node.open) node.close()
  }, [open])
  return (
    <dialog
      id="cheil-tools-drawer"
      ref={ref}
      className="cheil-tools-drawer"
      aria-label={designWords(lang).tools}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose()
      }}
    >
      <header>
        <h2>{designWords(lang).tools}</h2>
        <button className="btn" onClick={onClose} aria-label={t('cancel')}>
          ×
        </button>
      </header>
      <WorkToolsNav active={active} onPick={onPick} onPdf={onClose} />
    </dialog>
  )
}
