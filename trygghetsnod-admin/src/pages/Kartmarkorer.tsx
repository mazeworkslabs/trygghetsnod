import { useEffect, useState } from 'react'
import { Plus, Save, Trash2, ChevronDown, ChevronRight, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmButton } from '@/components/ConfirmButton'
import { api, type PoiCollection, type PoiFeature, type PoiKategori } from '@/lib/api'
import { cn } from '@/lib/utils'

const kategorier: { value: PoiKategori; label: string }[] = [
  { value: 'trygghetspunkt', label: 'Trygghetspunkt' },
  { value: 'skyddsrum', label: 'Skyddsrum' },
  { value: 'vardcentral', label: 'Vårdcentral' },
  { value: 'apotek', label: 'Apotek' },
  { value: 'brandstation', label: 'Brandstation' },
  { value: 'annat', label: 'Annat' },
]

const kategoriLabel = (k: PoiKategori) =>
  kategorier.find(t => t.value === k)?.label || k

const emptyFeature = (): PoiFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0, 0] },
  properties: { namn: '', kategori: 'trygghetspunkt', adress: '', anmarkning: '' },
})

export function Kartmarkorer() {
  const [data, setData] = useState<PoiCollection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  // Index på expanderade markörer. Kollapsade som default — listan blir lång annars.
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.poi().then(setData).catch((e) => setError(e.message))
  }, [])

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const updateFeature = (i: number, patch: Partial<PoiFeature['properties']> | { coords: [number, number] }) => {
    if (!data) return
    const next = { ...data, features: [...data.features] }
    const f = { ...next.features[i] }
    if ('coords' in patch) {
      f.geometry = { type: 'Point', coordinates: patch.coords }
    } else {
      f.properties = { ...f.properties, ...patch }
    }
    next.features[i] = f
    setData(next)
    setDirty(true)
  }

  const removeFeature = (i: number) => {
    if (!data) return
    setData({ ...data, features: data.features.filter((_, j) => j !== i) })
    // Index ändras — rensa expanded så vi inte expanderar fel markör efter borttagning
    setExpanded(new Set())
    setDirty(true)
  }

  const addFeature = () => {
    if (!data) return
    const newIndex = data.features.length
    setData({ ...data, features: [...data.features, emptyFeature()] })
    // Nya markörer börjar expanderade så man kan fylla i direkt
    setExpanded(prev => new Set([...prev, newIndex]))
    setDirty(true)
  }

  const save = async () => {
    if (!data) return
    setSaving(true)
    setError(null)
    try {
      await api.savePoi(data)
      setSavedAt(new Date().toISOString())
      setDirty(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const expandAll = () => {
    if (!data) return
    setExpanded(new Set(data.features.map((_, i) => i)))
  }
  const collapseAll = () => setExpanded(new Set())

  return (
    <div>
      <PageHeader
        kicker="Kartmarkörer"
        title="Trygghetspunkter och samhällsresurser"
        description="Markörer som visas på portalens karta. Koordinater i WGS84. Ändringar publiceras direkt när du sparar."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={addFeature}>
              <Plus className="h-3.5 w-3.5" />
              Lägg till
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Sparar…' : dirty ? 'Spara ändringar' : 'Sparat'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {savedAt && !dirty && (
        <div className="mb-4 font-mono text-xs text-ink-muted">
          Publicerat · medborgarportalens karta uppdateras direkt
        </div>
      )}

      {!data ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">Hämtar…</div>
      ) : data.features.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-serif text-lg text-ink-soft">Inga kartmarkörer än.</p>
          <button className="btn-primary mt-4" onClick={addFeature}>
            <Plus className="h-3.5 w-3.5" />
            Lägg till första markören
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-xs text-ink-muted">
              {data.features.length} markörer · {expanded.size} expanderade
            </div>
            <div className="flex gap-1">
              <button className="btn-ghost text-xs" onClick={expandAll}>Expandera alla</button>
              <button className="btn-ghost text-xs" onClick={collapseAll}>Kollapsa alla</button>
            </div>
          </div>
          <ol className="space-y-2">
            {data.features.map((f, i) => {
              const isOpen = expanded.has(i)
              const [lng, lat] = f.geometry.coordinates
              return (
                <li key={i} className="surface">
                  {/* Header — alltid synlig, klick togglar */}
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(i)}
                      className="flex flex-1 items-center gap-3 text-left min-w-0"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                      )}
                      <MapPin className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className={cn('font-sans text-[15px]', f.properties.namn ? 'font-medium text-ink' : 'italic text-ink-muted')}>
                            {f.properties.namn || 'Ny markör'}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                            {kategoriLabel(f.properties.kategori)}
                          </span>
                        </div>
                        {f.properties.adress && !isOpen && (
                          <div className="truncate font-mono text-xs text-ink-muted">{f.properties.adress}</div>
                        )}
                      </div>
                    </button>
                    <ConfirmButton
                      onConfirm={() => removeFeature(i)}
                      prompt="Ta bort?"
                      confirmLabel="Ja"
                      variant="danger"
                      className="!p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </div>

                  {/* Expanderat formulär */}
                  {isOpen && (
                    <div className="border-t border-paper-rule p-5 pt-4">
                      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                        <div>
                          <label className="field-label">Namn</label>
                          <input
                            className="field-input mt-2"
                            value={f.properties.namn}
                            onChange={(e) => updateFeature(i, { namn: e.target.value })}
                            placeholder="T.ex. Arvika brandstation"
                          />
                        </div>
                        <div>
                          <label className="field-label">Kategori</label>
                          <select
                            className="field-input mt-2"
                            value={f.properties.kategori}
                            onChange={(e) => updateFeature(i, { kategori: e.target.value as PoiKategori })}
                          >
                            {kategorier.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="field-label">Latitud</label>
                          <input
                            type="number"
                            step="0.00001"
                            className="field-input mt-2 font-mono text-sm"
                            value={lat}
                            onChange={(e) =>
                              updateFeature(i, { coords: [lng, Number(e.target.value) || 0] })
                            }
                          />
                        </div>
                        <div>
                          <label className="field-label">Longitud</label>
                          <input
                            type="number"
                            step="0.00001"
                            className="field-input mt-2 font-mono text-sm"
                            value={lng}
                            onChange={(e) =>
                              updateFeature(i, { coords: [Number(e.target.value) || 0, lat] })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="field-label">Adress</label>
                        <input
                          className="field-input mt-2"
                          value={f.properties.adress || ''}
                          onChange={(e) => updateFeature(i, { adress: e.target.value })}
                        />
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="field-label">Kapacitet</label>
                          <input
                            className="field-input mt-2"
                            value={f.properties.kapacitet || ''}
                            onChange={(e) => updateFeature(i, { kapacitet: e.target.value })}
                            placeholder="T.ex. 80 personer"
                          />
                        </div>
                        <div>
                          <label className="field-label">Reservkraft</label>
                          <input
                            className="field-input mt-2"
                            value={f.properties.reservkraft || ''}
                            onChange={(e) => updateFeature(i, { reservkraft: e.target.value })}
                            placeholder="T.ex. Ja, 72 tim"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="field-label">Anmärkning</label>
                        <textarea
                          className="field-input mt-2 font-serif text-[15px]"
                          rows={2}
                          value={f.properties.anmarkning || ''}
                          onChange={(e) => updateFeature(i, { anmarkning: e.target.value })}
                          placeholder="Kommunikationsradio (Rakel), vattenuttag…"
                        />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
