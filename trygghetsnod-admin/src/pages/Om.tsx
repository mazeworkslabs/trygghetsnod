import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type AboutInfo } from '@/lib/api'
import { formatDate } from '@/lib/utils'

export function Om() {
  const [about, setAbout] = useState<AboutInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.about().then(setAbout).catch((e) => setError((e as Error).message))
  }, [])

  if (error) {
    return (
      <div>
        <PageHeader kicker="Om enheten" title="Version" />
        <div className="surface border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          Kunde inte hämta versionsinformation: {error}
        </div>
      </div>
    )
  }

  if (!about) {
    return (
      <div>
        <PageHeader kicker="Om enheten" title="Version" />
        <p className="font-serif text-base text-ink-soft">Hämtar…</p>
      </div>
    )
  }

  const { applied, live } = about
  const installed = applied?.version ?? 'Ej registrerad (utvecklingsläge)'
  const liveSha = live.git_describe || live.git_sha?.slice(0, 12) || '—'

  return (
    <div>
      <PageHeader
        kicker="Om enheten"
        title="Version och innehåll"
        description="Version, innehåll och senaste uppdatering."
      />

      <section className="surface p-7">
        <div className="kicker">Installerad version</div>
        <div className="mt-2 font-mono text-2xl font-medium">{installed}</div>
        {applied?.applied_at && (
          <p className="mt-2 font-mono text-xs text-ink-muted">
            Applicerad {formatDate(applied.applied_at)}
            {applied.released_at && ` · Bygd ${formatDate(applied.released_at)}`}
          </p>
        )}
        {applied?.notes && (
          <p className="mt-4 max-w-prose font-serif text-base leading-relaxed text-ink-soft">
            {applied.notes}
          </p>
        )}
      </section>

      <section className="mt-6 surface p-7">
        <div className="kicker">Kod</div>
        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 font-mono text-sm">
          <dt className="text-ink-muted">Tag</dt>
          <dd>{applied?.code?.git_tag ?? '—'}</dd>
          <dt className="text-ink-muted">SHA (live)</dt>
          <dd className="break-all">{liveSha}</dd>
          {applied?.code?.git_sha && (
            <>
              <dt className="text-ink-muted">SHA (applicerad)</dt>
              <dd className="break-all">{applied.code.git_sha.slice(0, 12)}</dd>
            </>
          )}
        </dl>
        {applied?.code?.git_sha && live.git_sha && applied.code.git_sha !== live.git_sha && (
          <div className="mt-4 surface border-status-warn/40 bg-status-warn/10 p-3 font-sans text-sm">
            Kod på enheten skiljer sig från senast applicerad version. Antingen pågår en utveckling
            eller en uppdatering applicerades manuellt utan att skriva applied.json.
          </div>
        )}
      </section>

      <section className="mt-6 surface p-7">
        <div className="kicker">Innehåll på enheten</div>
        <table className="mt-3 w-full font-mono text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="pb-2 font-normal">ZIM-fil</th>
              <th className="pb-2 font-normal">Tidsstämpel</th>
            </tr>
          </thead>
          <tbody>
            {live.zims.length === 0 ? (
              <tr><td colSpan={2} className="py-2 text-ink-muted">Inga ZIM-filer hittades</td></tr>
            ) : (
              live.zims.map(z => (
                <tr key={z.filename} className="border-t border-paper-rule">
                  <td className="py-2 pr-4 break-all">{z.filename}</td>
                  <td className="py-2 text-ink-muted">{formatDate(z.modified)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6 surface p-7">
        <div className="kicker">Drift</div>
        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 font-mono text-sm">
          <dt className="text-ink-muted">Kommun</dt>
          <dd>{live.kommun}</dd>
          <dt className="text-ink-muted">Portal startad</dt>
          <dd>{formatDate(live.portal_started_at)}</dd>
          <dt className="text-ink-muted">Uptime</dt>
          <dd>{formatUptime(live.uptime_seconds)}</dd>
        </dl>
      </section>
    </div>
  )
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`
  return `${Math.round(seconds / 86400)} dygn`
}
