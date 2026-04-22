import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatusCardProps {
  label: string
  value: ReactNode
  hint?: string
  status?: 'ok' | 'warn' | 'fail' | 'neutral'
  className?: string
}

const dotColor = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  fail: 'bg-status-fail',
  neutral: 'bg-ink-muted',
}

export function StatusCard({ label, value, hint, status = 'neutral', className }: StatusCardProps) {
  return (
    <div className={cn('surface p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="kicker">{label}</div>
        <span className={cn('status-dot', dotColor[status])} aria-hidden />
      </div>
      <div className="mt-3 font-sans text-3xl font-medium leading-none text-ink">{value}</div>
      {hint && <div className="mt-2 font-mono text-xs text-ink-muted">{hint}</div>}
    </div>
  )
}
