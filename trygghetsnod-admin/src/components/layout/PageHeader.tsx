import type { ReactNode } from 'react'

interface PageHeaderProps {
  kicker?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6 border-b border-paper-rule pb-6">
      <div>
        {kicker && <div className="kicker mb-2">{kicker}</div>}
        <h1 className="font-sans text-3xl font-medium leading-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-prose font-serif text-lg leading-relaxed text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
