import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (note?: string) => Promise<void> | void
  kicker?: string
  title: string
  /** Brödtext / hjälptext */
  description?: ReactNode
  confirmLabel: string
  variant?: 'default' | 'danger'
  /** Visa textfält för anteckning (t.ex. anledning till blockering) */
  reasonPlaceholder?: string
  reasonRequired?: boolean
}

/**
 * Generisk bekräftelse-modal. Stor och tydlig, till skillnad från ConfirmButton (inline).
 * Använd för viktiga moderationsåtgärder som måste vara medvetna val.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  kicker,
  title,
  description,
  confirmLabel,
  variant = 'default',
  reasonPlaceholder,
  reasonRequired = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canConfirm = !reasonRequired || reason.trim().length > 0

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm(reason.trim() || undefined)
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }
  const handleClose = () => {
    if (submitting) return
    setReason('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} kicker={kicker} title={title} size="sm" closeOnBackdrop={!submitting}>
      {description && (
        <div className="mb-4 font-serif text-[15px] leading-relaxed text-ink-soft">
          {description}
        </div>
      )}
      {reasonPlaceholder && (
        <div className="mb-4">
          <label className="field-label">Anteckning {reasonRequired && <span className="text-accent-brick">*</span>}</label>
          <textarea
            className="field-input mt-2"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
          />
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-paper-rule pt-4">
        <button className="btn-ghost" onClick={handleClose} disabled={submitting}>
          Avbryt
        </button>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded px-4 py-2 font-sans text-sm font-medium text-white transition-colors disabled:opacity-50',
            variant === 'danger' ? 'bg-accent-brick hover:bg-accent-brick/90' : 'bg-myndig hover:bg-myndig/90'
          )}
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
        >
          {submitting ? '…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
