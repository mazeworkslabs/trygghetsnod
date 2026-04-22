import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type PoiCollection, type PoiFeature, type PoiKategori } from '@/lib/api'

const kategorier: { value: PoiKategori; label: string }[] = [
  { value: 'trygghetspunkt', label: 'Trygghetspunkt' },
  { value: 'skyddsrum', label: 'Skyddsrum' },
  { value: 'vardcentral', label: 'Vårdcentral' },
  { value: 'apotek', label: 'Apotek' },
  { value: 'brandstation', label: 'Brandstation' },
  { value: 'annat', label: 'Annat' },
]

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

  useEffect(() => {
    api.poi().then(setData).catch((e) => setError(e.message))
  }, [])

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
    setDirty(true)
  }

  const addFeature = () => {
    if (!data) return
    setData({ ...data, features: [...data.features, emptyFeature()] })
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
        <ol className="space-y-4">
          {data.features.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates
            return (
              <li key={i} className="surface p-5">
                <div className="grid gap-4 md:grid-cols-[1fr_200px_40px]">
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
                  <button
                    onClick={() => removeFeature(i)}
                    className="mt-7 self-start text-ink-muted hover:text-accent-brick"
                    title="Ta bort"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
