import { useEffect, useMemo, useState } from 'react'
import { Download, Wifi, Link as LinkIcon, Type, Phone } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type Preset = 'fritext' | 'lank' | 'wifi' | 'tel'

export function QrTool() {
  const [preset, setPreset] = useState<Preset>('fritext')
  const [text, setText] = useState('')
  // wifi-specifika fält
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPwd, setWifiPwd] = useState('')
  const [wifiHidden, setWifiHidden] = useState(false)

  // Vilken text som faktiskt ska kodas in i QR-koden, beroende på preset.
  const encoded = useMemo(() => {
    if (preset === 'wifi') {
      if (!wifiSsid) return ''
      const auth = wifiPwd ? 'WPA' : 'nopass'
      const escape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
      return `WIFI:T:${auth};S:${escape(wifiSsid)};P:${wifiPwd ? escape(wifiPwd) : ''};${wifiHidden ? 'H:true;' : ''};`
    }
    return text
  }, [preset, text, wifiSsid, wifiPwd, wifiHidden])

  const downloadName = preset === 'wifi' ? `qr-wifi-${wifiSsid || 'kod'}.png` : `qr-${(text || 'kod').slice(0, 24).replace(/[^\w-]+/g, '-')}.png`

  const presets: { id: Preset; label: string; icon: React.ComponentType<{ className?: string }>; placeholder?: string }[] = [
    { id: 'fritext', label: 'Fritext', icon: Type },
    { id: 'lank', label: 'Länk', icon: LinkIcon, placeholder: 'https://exempel.se' },
    { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
    { id: 'tel', label: 'Telefonnummer', icon: Phone, placeholder: '+46701234567' },
  ]

  // När man byter preset rensa text-fält (utom om preset bara är annan fritext)
  useEffect(() => {
    if (preset !== 'wifi') {
      // Lägg till tel: prefix för tel-presets om man har en bara siffror
      if (preset === 'tel' && text && !text.startsWith('tel:')) {
        // gör inget — vi prefixar vid encoding nedan istället
      }
    }
  }, [preset])

  // Tel-presets ska automatiskt få tel:-prefix om användaren skriver ren siffra
  const finalEncoded = preset === 'tel' && encoded && !encoded.startsWith('tel:')
    ? `tel:${encoded.replace(/\s/g, '')}`
    : encoded
  const finalQrUrl = finalEncoded
    ? `/api/admin/qr.png?size=512&text=${encodeURIComponent(finalEncoded)}`
    : ''

  return (
    <div>
      <PageHeader
        kicker="Verktyg"
        title="QR-kod"
        description="Generera en QR-kod att skriva ut eller dela. Wi-Fi-koden ansluter telefonen direkt."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Preset-tabs */}
          <div className="surface flex flex-wrap gap-1 p-1">
            {presets.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 font-sans text-sm transition-colors',
                    preset === p.id
                      ? 'bg-myndig text-white'
                      : 'text-ink-soft hover:bg-paper-warm hover:text-ink'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Inputs per preset */}
          <div className="surface p-5">
            {preset === 'fritext' && (
              <div>
                <label className="field-label">Text att koda in</label>
                <textarea
                  className="field-input mt-2"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Text, kod, ID…"
                />
              </div>
            )}
            {preset === 'lank' && (
              <div>
                <label className="field-label">URL</label>
                <input
                  className="field-input mt-2"
                  type="url"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="https://exempel.se"
                />
                <p className="mt-2 font-serif text-[14px] text-ink-soft">
                  Telefonen öppnar länken direkt vid skanning.
                </p>
              </div>
            )}
            {preset === 'tel' && (
              <div>
                <label className="field-label">Telefonnummer</label>
                <input
                  className="field-input mt-2"
                  type="tel"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="+46 70 123 45 67"
                />
                <p className="mt-2 font-serif text-[14px] text-ink-soft">
                  Telefonen öppnar samtalsappen vid skanning.
                </p>
              </div>
            )}
            {preset === 'wifi' && (
              <div className="space-y-4">
                <div>
                  <label className="field-label">Wi-Fi-namn (SSID)</label>
                  <input
                    className="field-input mt-2"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Trygghetsnod-Arvika"
                  />
                </div>
                <div>
                  <label className="field-label">Lösenord (lämna tomt för öppet nät)</label>
                  <input
                    className="field-input mt-2"
                    value={wifiPwd}
                    onChange={(e) => setWifiPwd(e.target.value)}
                    placeholder="WPA-lösenord"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wifiHidden}
                    onChange={(e) => setWifiHidden(e.target.checked)}
                    className="accent-myndig"
                  />
                  <span className="font-sans text-sm">Dolt nätverk</span>
                </label>
              </div>
            )}
          </div>

          {/* Råkod-preview */}
          {finalEncoded && (
            <details className="surface p-4">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-ink-muted">
                Visa rå data (det som kodas in)
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-all rounded bg-paper-warm/40 p-3 font-mono text-xs">{finalEncoded}</pre>
            </details>
          )}
        </div>

        {/* QR-preview */}
        <aside>
          <div className="surface sticky top-6 p-6">
            <div className="kicker mb-3">Förhandsvisning</div>
            <div className="flex items-center justify-center bg-white p-4">
              {finalQrUrl ? (
                <img
                  src={finalQrUrl}
                  alt="QR-kod"
                  className="h-[280px] w-[280px]"
                />
              ) : (
                <div className="flex h-[280px] w-[280px] items-center justify-center text-ink-muted">
                  <p className="text-center font-serif text-sm">
                    Skriv något i fältet bredvid så genereras QR-koden här.
                  </p>
                </div>
              )}
            </div>
            {finalQrUrl && (
              <a
                href={finalQrUrl}
                download={downloadName}
                className="btn-primary mt-4 w-full justify-center"
              >
                <Download className="h-3.5 w-3.5" />
                Ladda ner PNG
              </a>
            )}
            {finalQrUrl && (
              <p className="mt-3 font-serif text-[13px] leading-snug text-ink-soft">
                Tips: skriv ut och tejpa upp på trygghetspunkten. Skanning fungerar med valfri kamera-app.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
