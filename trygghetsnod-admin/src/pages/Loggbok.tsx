import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type LoggbokEntry } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const typeLabels: Record<string, string> = {
  lagesuppdatering: 'Lägesuppdatering',
  poi: 'Kartmarkör',
  note: 'Anteckning',
  service: 'Service',
  incident: 'Incident',
}

export function Loggbok() {
  const [entries, setEntries] = useState<LoggbokEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState({ type: 'note', title: '', note: '', author: 'Platsansvarig' })
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.loggbok(200).then(({ entries }) => setEntries(entries)).catch((e) => setError(e.message))

  useEffect(() => { load() }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.addLoggbokEntry(draft)
      setDraft({ type: 'note', title: '', note: '', author: draft.author })
      setShowForm(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Loggbok"
        title="Service och händelser"
        description="Varje lägesuppdatering och kartändring loggas automatiskt. Lägg själv till servicebesök, incidenter eller anteckningar."
        actions={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {showForm ? 'Stäng' : 'Ny anteckning'}
          </button>
        }
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="surface mb-6 p-6">
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div>
              <label className="field-label">Typ</label>
              <select
                className="field-input mt-2"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                <option value="note">Anteckning</option>
                <option value="service">Service</option>
                <option value="incident">Incident</option>
              </select>
            </div>
            <div>
              <label className="field-label">Rubrik</label>
              <input
                className="field-input mt-2"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="T.ex. Kvartalsservice genomförd"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="field-label">Anteckning</label>
            <textarea
              className="field-input mt-2 font-serif text-[15px]"
              rows={3}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Fri text"
            />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-paper-rule pt-4">
            <input
              className="field-input max-w-[240px]"
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              placeholder="Skrivet av"
            />
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Sparar…' : 'Spara i loggbok'}
            </button>
          </div>
        </form>
      )}

      {entries === null ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">Hämtar…</div>
      ) : entries.length === 0 ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">
          Loggboken är tom — den fylls när du sparar lägesuppdateringar, redigerar kartan eller
          skriver anteckningar här.
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map((e, i) => (
            <li key={i} className="surface p-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="kicker">{typeLabels[e.type] ?? e.type}</div>
                <div className="font-mono text-xs text-ink-muted">{formatDate(e.at)}</div>
              </div>
              {e.title && (
                <div className="mt-1 font-sans text-sm font-medium text-ink">{e.title}</div>
              )}
              {e.note && (
                <div className="mt-1 font-serif text-[15px] leading-snug text-ink-soft">{e.note}</div>
              )}
              <div className="mt-2 font-mono text-xs text-ink-muted">
                {e.author || 'Okänd'}
                {e.severity ? ` · ${e.severity}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
