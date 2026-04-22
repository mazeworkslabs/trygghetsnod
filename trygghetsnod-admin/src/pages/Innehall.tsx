import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type Zim } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'

export function Innehall() {
  const [zims, setZims] = useState<Zim[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.zims().then(({ zims }) => setZims(zims)).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <PageHeader
        kicker="Innehåll"
        title="Bibliotek på enheten"
        description="Allt material som ligger lokalt och kan läsas utan internet. Uppdateras vid kvartalsservice."
      />

      {error && (
        <div className="surface border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {zims && (
        <div className="surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-paper-rule">
                <th className="px-5 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                  Filnamn
                </th>
                <th className="px-5 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                  Storlek
                </th>
                <th className="px-5 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                  Senast ändrad
                </th>
              </tr>
            </thead>
            <tbody>
              {zims.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center font-serif text-ink-soft">
                    Inga ZIM-filer hittades i storage/zim.
                  </td>
                </tr>
              ) : (
                zims.map((z) => (
                  <tr key={z.filename} className="border-b border-paper-rule last:border-b-0">
                    <td className="px-5 py-3 font-sans text-sm">{z.filename}</td>
                    <td className="px-5 py-3 text-right font-mono text-sm text-ink-soft">
                      {formatBytes(z.size_bytes)}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm text-ink-muted">
                      {formatDate(z.modified)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
