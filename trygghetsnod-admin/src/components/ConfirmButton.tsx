import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ConfirmButtonProps {
  onConfirm: () => void | Promise<void>
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  prompt?: string
  variant?: 'default' | 'danger'
  className?: string
  disabled?: boolean
  title?: string
}

/**
 * Inline two-stage button. Klick → "Säker?" + Ja/Avbryt-knappar inline. Inga modaler.
 * Auto-collapse efter 4 s utan interaktion så halv-armerade knappar inte ligger kvar.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Bekräfta',
  cancelLabel = 'Avbryt',
  prompt,
  variant = 'default',
  className,
  disabled,
  title,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!armed) return
    timerRef.current = window.setTimeout(() => setArmed(false), 4000)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [armed])

  const trigger = async () => {
    if (busy) return
    setBusy(true)
    try { await onConfirm() } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  if (!armed) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        className={cn(
          variant === 'danger' ? 'btn-ghost text-accent-brick' : 'btn-ghost',
          className
        )}
        onClick={() => setArmed(true)}
      >
        {children}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-paper-rule bg-paper-warm/40 px-2 py-1">
      {prompt && <span className="font-sans text-xs text-ink-soft">{prompt}</span>}
      <button
        type="button"
        className={cn(
          'rounded px-2 py-0.5 font-sans text-xs font-semibold',
          variant === 'danger' ? 'bg-accent-brick text-white' : 'bg-myndig text-white',
          'disabled:opacity-50'
        )}
        onClick={trigger}
        disabled={busy}
      >
        {busy ? '…' : confirmLabel}
      </button>
      <button
        type="button"
        className="rounded px-2 py-0.5 font-sans text-xs text-ink-soft hover:text-ink"
        onClick={() => setArmed(false)}
        disabled={busy}
      >
        {cancelLabel}
      </button>
    </span>
  )
}
