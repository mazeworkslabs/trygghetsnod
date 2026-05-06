import { useEffect, useState } from 'react'
import { Save, Globe, Eye, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type SourceBook } from '@/lib/api'
import { cn } from '@/lib/utils'

const langLabels: Record<string, string> = {
  swe: 'Svenska',
  eng: 'Engelska',
  nor: 'Norska',
  dan: 'Danska',
}

export function Kallor() {
  const [books, setBooks] = useState<SourceBook[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    api.sources().then(({ books }) => setBooks(books)).catch((e) => setError(e.message))
  }, [])

  const toggle = (slug: string) => {
    if (!books) return
    setBooks(books.map(b => b.slug === slug ? { ...b, published: !b.published } : b))
    setDirty(true)
  }

  const save = async () => {
    if (!books) return
    setSaving(true)
    setError(null)
    try {
      const published = Object.fromEntries(books.map(b => [b.slug, b.published]))
      await api.saveSources(published)
      setSavedAt(new Date().toISOString())
      setDirty(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const grouped = books
    ? books.reduce<Record<string, SourceBook[]>>((acc, b) => {
        const key = b.language || '—'
        ;(acc[key] ||= []).push(b)
        return acc
      }, {})
    : {}

  return (
    <div>
      <PageHeader
        kicker="Källor"
        title="Vad medborgaren ser på startsidan"
        description="Välj vilka böcker som visas som genvägar på startsidan. Allt förblir sökbart oavsett."
        actions={
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Sparar…' : dirty ? 'Spara ändringar' : 'Sparat'}
          </button>
        }
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {savedAt && !dirty && (
        <div className="mb-4 font-mono text-xs text-ink-muted">Publicerat · startsidan uppdateras direkt</div>
      )}

      {!books ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">Hämtar Kiwix-katalog…</div>
      ) : books.length === 0 ? (
        <div className="surface p-10 text-center">
          <Globe className="mx-auto mb-3 h-6 w-6 text-ink-muted" />
          <p className="font-serif text-lg text-ink-soft">Inga böcker hittades i Kiwix-katalogen.</p>
          <p className="mt-2 font-mono text-xs text-ink-muted">
            Kontrollera att ZIM-filer ligger i storage/zim/ och att Kiwix-containern är uppe.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([lang, list]) => (
            <section key={lang}>
              <h2 className="kicker mb-3">{langLabels[lang] ?? lang} · {list.length} böcker</h2>
              <ul className="space-y-2">
                {list.map(b => (
                  <li
                    key={b.slug}
                    className={cn(
                      'surface flex items-start justify-between gap-6 p-5 transition-colors',
                      b.published ? '' : 'opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <h3 className="font-sans text-[15px] font-medium text-ink">{b.title}</h3>
                        <span className="font-mono text-[11px] text-ink-muted">{b.articleCount.toLocaleString('sv-SE')} artiklar</span>
                      </div>
                      {b.summary && (
                        <p className="mt-1 font-serif text-[15px] leading-snug text-ink-soft">{b.summary}</p>
                      )}
                      <div className="mt-2 font-mono text-xs text-ink-muted">{b.slug}</div>
                    </div>
                    <button
                      onClick={() => toggle(b.slug)}
                      className={cn(
                        'flex min-w-[140px] items-center justify-center gap-2 border px-4 py-2 font-sans text-sm transition-colors',
                        b.published
                          ? 'border-myndig bg-myndig-tint text-myndig'
                          : 'border-paper-rule text-ink-muted hover:border-ink-soft'
                      )}
                    >
                      {b.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {b.published ? 'Publicerad' : 'Dold'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
