import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusCard } from '@/components/layout/StatusCard'
import { api, type SystemStatus } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'

const sevLabel = { info: 'Information', warning: 'Varning', emergency: 'Nödläge' }
const sevStatus = { info: 'ok', warning: 'warn', emergency: 'fail' } as const

export function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const s = await api.status()
        if (mounted) setStatus(s)
      } catch (e) {
        if (mounted) setError((e as Error).message)
      }
    }
    load()
    const id = setInterval(load, 10000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <div>
      <PageHeader
        kicker="Översikt"
        title="Enheten i drift"
        description="Aktuell status för portalen, innehållsbiblioteket och lagring. Uppdateras automatiskt var tionde sekund."
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          Kunde inte hämta status: {error}
        </div>
      )}

      <div className="grid gap-px bg-paper-rule sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          label="Portalen"
          value={status?.portal.ok ? 'Igång' : 'Avslagen'}
          hint={status ? `Uppe ${formatUptime(status.portal.uptime_seconds)}` : 'Hämtar…'}
          status={status?.portal.ok ? 'ok' : 'fail'}
          className="border-0"
        />
        <StatusCard
          label="Kiwix-bibliotek"
          value={status ? `${status.kiwix.books} böcker` : '—'}
          hint={
            status?.kiwix.ok
              ? `Svar ${status.kiwix.latency_ms ?? '?'} ms`
              : 'Inte nåbar'
          }
          status={status?.kiwix.ok ? 'ok' : 'fail'}
          className="border-0"
        />
        <StatusCard
          label="ZIM-data"
          value={status ? formatBytes(status.storage.zim_bytes) : '—'}
          hint="storage/zim"
          status="neutral"
          className="border-0"
        />
        <StatusCard
          label="Karttiles"
          value={status ? formatBytes(status.storage.maps_bytes) : '—'}
          hint="storage/maps"
          status="neutral"
          className="border-0"
        />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="surface-warm lg:col-span-2 p-7">
          <div className="kicker">Aktuell lägesuppdatering</div>
          {status?.update ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <span className={`status-dot bg-status-${sevStatus[status.update.severity]}`} aria-hidden />
                <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
                  {sevLabel[status.update.severity]}
                </span>
              </div>
              <h2 className="mt-2 font-sans text-2xl font-medium leading-tight">
                {status.update.title}
              </h2>
              <p className="mt-3 font-mono text-xs text-ink-muted">
                {status.update.author} · uppdaterat {formatDate(status.update.updated_at)}
              </p>
              <Link
                to="/lagesuppdatering"
                className="btn mt-6 no-underline"
              >
                Redigera
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <p className="mt-3 font-serif text-base text-ink-soft">Ingen lägesuppdatering registrerad ännu.</p>
          )}
        </div>

        <div className="surface p-7">
          <div className="kicker">Lagring</div>
          {status ? (
            <>
              <div className="mt-3 font-sans text-2xl font-medium">
                {formatBytes(status.storage.free_bytes)} ledigt
              </div>
              <div className="mt-1 font-mono text-xs text-ink-muted">
                av {formatBytes(status.storage.total_bytes)}
              </div>
              <div className="mt-4 h-2 overflow-hidden bg-paper-rule">
                <div
                  className="h-full bg-myndig"
                  style={{
                    width: `${Math.round(((status.storage.total_bytes - status.storage.free_bytes) / status.storage.total_bytes) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-4 font-serif text-sm leading-relaxed text-ink-soft">
                Innehållsbiblioteket använder{' '}
                {formatBytes(status.storage.zim_bytes + status.storage.maps_bytes)} av enhetens lagring.
              </p>
            </>
          ) : (
            <p className="mt-3 font-serif text-base text-ink-soft">Hämtar…</p>
          )}
        </div>
      </section>

      <section className="mt-10 surface p-7">
        <div className="kicker">Kommun</div>
        <div className="mt-2 font-sans text-xl font-medium">{status?.kommun ?? '—'}</div>
        <p className="mt-2 max-w-prose font-serif text-base leading-relaxed text-ink-soft">
          Enheten är konfigurerad för denna kommun. Ändringar i kommuninställningarna kräver service-besök.
        </p>
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
