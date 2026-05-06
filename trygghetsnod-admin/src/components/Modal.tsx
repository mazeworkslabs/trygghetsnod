import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  kicker?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Stäng på klick utanför dialog (default true) */
  closeOnBackdrop?: boolean
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

export function Modal({ open, onClose, title, kicker, children, size = 'md', closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 sm:items-center sm:p-6"
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'relative w-full rounded-lg border border-paper-rule bg-paper shadow-xl my-4',
          sizeClass[size]
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || kicker) && (
          <header className="flex items-start justify-between gap-4 border-b border-paper-rule px-6 py-4">
            <div>
              {kicker && <div className="kicker mb-1">{kicker}</div>}
              {title && <h2 className="font-serif text-xl font-medium text-ink">{title}</h2>}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-ink-muted transition-colors hover:bg-paper-warm/40 hover:text-ink"
              aria-label="Stäng"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
