import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type Update } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

const severities = [
  { value: 'info', label: 'Information', desc: 'Normal drift, öppettider, allmän info.' },
  { value: 'warning', label: 'Varning', desc: 'Pågående händelse, håll er uppdaterade.' },
  { value: 'emergency', label: 'Nödläge', desc: 'Akut läge, följ instruktionerna.' },
] as const

export function Lagesuppdatering() {
  const [data, setData] = useState<Update | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.update().then(setData).catch((e) => setError(e.message))
  }, [])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setError(null)
    try {
      const result = await api.saveUpdate({
        title: data.title,
        body: data.body,
        severity: data.severity,
        author: data.author,
      })
      setData(result)
      setSavedAt(result.updated_at)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <div>
        <PageHeader kicker="Lägesuppdatering" title="Hämtar…" />
        {error && <p className="text-accent-brick">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        kicker="Lägesuppdatering"
        title="Vad medborgaren ser"
        description="Skriv kort. Texten visas på portalens startsida och i A4-utskriften."
      />

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="surface p-7">
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className="field-label">Rubrik</label>
              <input
                id="title"
                className="field-input mt-2"
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="body" className="field-label">Text</label>
              <textarea
                id="body"
                className="field-input mt-2 font-serif text-[17px] leading-[1.7]"
                rows={10}
                value={data.body}
                onChange={(e) => setData({ ...data, body: e.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="author" className="field-label">Skrivet av</label>
              <input
                id="author"
                className="field-input mt-2"
                value={data.author}
                onChange={(e) => setData({ ...data, author: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-paper-rule pt-5">
            <div className="font-mono text-xs text-ink-muted">
              {savedAt
                ? `Sparat ${formatDate(savedAt)}`
                : `Senast uppdaterat ${formatDate(data.updated_at)}`}
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Sparar…' : 'Spara och publicera'}
            </button>
          </div>

          {error && (
            <div className="mt-4 border-l-2 border-accent-brick bg-accent-brick/5 p-3 font-sans text-sm text-accent-brick">
              {error}
            </div>
          )}
        </div>

        <fieldset className="surface-warm p-6">
          <legend className="kicker px-1">Läge</legend>
          <div className="mt-3 space-y-2">
            {severities.map((s) => (
              <label
                key={s.value}
                className={cn(
                  'flex cursor-pointer flex-col border p-3 transition-colors',
                  data.severity === s.value
                    ? 'border-myndig bg-myndig-tint'
                    : 'border-paper-rule bg-paper hover:border-ink-muted'
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="severity"
                    value={s.value}
                    checked={data.severity === s.value}
                    onChange={() => setData({ ...data, severity: s.value })}
                    className="accent-myndig"
                  />
                  <span className="font-sans text-sm font-medium">{s.label}</span>
                </span>
                <span className="ml-6 mt-1 font-serif text-sm leading-snug text-ink-soft">
                  {s.desc}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </div>
  )
}
