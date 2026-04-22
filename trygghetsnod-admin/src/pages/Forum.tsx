import { useEffect, useState } from 'react'
import { Plus, Trash2, Pin, PinOff, MessageSquare, ExternalLink, X, Lock, Unlock, BadgeCheck, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type ForumGroup, type ForumMessage, type ForumToken } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

type Tab = 'grupper' | 'verifiering'

export function Forum() {
  const [tab, setTab] = useState<Tab>('grupper')

  return (
    <div>
      <PageHeader
        kicker="Forum"
        title="Moderering, verifiering och grupper"
        description="FRG-volontärer modererar meddelanden, skapar grupper, verifierar medborgare och styr om forumet är öppet eller bara för verifierade."
      />

      <div className="mb-6 flex gap-1 border-b border-paper-rule">
        <TabButton active={tab === 'grupper'} onClick={() => setTab('grupper')}>
          <MessageSquare className="h-3.5 w-3.5" />
          Grupper &amp; meddelanden
        </TabButton>
        <TabButton active={tab === 'verifiering'} onClick={() => setTab('verifiering')}>
          <BadgeCheck className="h-3.5 w-3.5" />
          Verifiering &amp; tokens
        </TabButton>
      </div>

      {tab === 'grupper' ? <GrupperTab /> : <VerifieringTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm transition-colors',
        active
          ? 'border-myndig text-ink'
          : 'border-transparent text-ink-muted hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}

function GrupperTab() {
  const [groups, setGroups] = useState<ForumGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ForumGroup | null>(null)
  const [creating, setCreating] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', description: '', pinned: false })

  const reload = () =>
    api.forumGroups().then(({ groups }) => {
      setGroups(groups)
      if (selected) {
        const updated = groups.find(g => g.id === selected.id)
        if (updated) setSelected(updated)
        else setSelected(null)
      }
    }).catch((e) => setError(e.message))

  useEffect(() => { reload() }, [])
  useEffect(() => {
    if (!selected) return
    const id = setInterval(reload, 5000)
    return () => clearInterval(id)
  }, [selected?.id])

  const createGroup = async () => {
    if (!newGroup.name) return
    try {
      await api.createForumGroup(newGroup)
      setNewGroup({ name: '', description: '', pinned: false })
      setCreating(false)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const togglePin = async (g: ForumGroup) => {
    try {
      await api.updateForumGroup(g.id, { pinned: !g.pinned })
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const removeGroup = async (g: ForumGroup) => {
    if (!window.confirm(`Radera gruppen "${g.name}"? Alla meddelanden (${g.message_count} st) försvinner också. Går inte att ångra.`)) return
    try {
      await api.deleteForumGroup(g.id)
      if (selected?.id === g.id) setSelected(null)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ny grupp
        </button>
      </div>

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          <button onClick={() => setError(null)} className="float-right ml-4">
            <X className="h-3.5 w-3.5" />
          </button>
          {error}
        </div>
      )}

      {creating && (
        <div className="surface mb-6 p-6">
          <div className="kicker mb-3">Ny grupp</div>
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <div>
              <label className="field-label">Namn</label>
              <input
                className="field-input mt-2"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="T.ex. Bensinstation öppen"
                autoFocus
              />
            </div>
            <label className="mt-7 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={newGroup.pinned}
                onChange={(e) => setNewGroup({ ...newGroup, pinned: e.target.checked })}
                className="accent-myndig"
              />
              <span className="font-sans text-sm">Fastnåla</span>
            </label>
          </div>
          <div className="mt-4">
            <label className="field-label">Kort beskrivning</label>
            <input
              className="field-input mt-2"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              placeholder="Vad gruppen handlar om"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-paper-rule pt-4">
            <button className="btn-ghost" onClick={() => setCreating(false)}>Avbryt</button>
            <button className="btn-primary" onClick={createGroup} disabled={!newGroup.name}>Skapa</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          {!groups ? (
            <div className="surface p-6 text-center font-serif text-ink-soft">Hämtar…</div>
          ) : groups.length === 0 ? (
            <div className="surface p-6 text-center font-serif text-ink-soft">Inga grupper än.</div>
          ) : (
            <ul className="space-y-2">
              {groups.map(g => (
                <li key={g.id}>
                  <button
                    className={cn(
                      'flex w-full flex-col border p-4 text-left transition-colors',
                      selected?.id === g.id
                        ? 'border-myndig bg-myndig-tint'
                        : 'border-paper-rule bg-paper hover:border-ink-muted'
                    )}
                    onClick={() => setSelected(g)}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 font-sans text-[15px] font-medium">
                        {g.pinned && <Pin className="h-3 w-3 text-myndig" />}
                        {g.name}
                      </div>
                      <div className="font-mono text-xs text-ink-muted">{g.message_count}</div>
                    </div>
                    {g.description && (
                      <div className="mt-0.5 font-serif text-[14px] leading-snug text-ink-soft">{g.description}</div>
                    )}
                    <div className="mt-1 font-mono text-[11px] text-ink-muted">
                      {g.last_message_at ? `Senast ${formatDate(g.last_message_at)}` : 'Inga meddelanden'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section>
          {selected ? (
            <GroupMessages group={selected} onPin={() => togglePin(selected)} onDelete={() => removeGroup(selected)} onChange={reload} />
          ) : (
            <div className="surface p-10 text-center">
              <MessageSquare className="mx-auto mb-3 h-6 w-6 text-ink-muted" />
              <p className="font-serif text-lg text-ink-soft">Välj en grupp i listan för att modera meddelanden.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function VerifieringTab() {
  const [mode, setMode] = useState<'oppet' | 'verifierade' | null>(null)
  const [tokens, setTokens] = useState<ForumToken[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', role: 'medborgare' as 'medborgare' | 'frg', issued_by: 'FRG' })
  const [creating, setCreating] = useState(false)
  const [showQr, setShowQr] = useState<ForumToken | null>(null)

  const reload = () => Promise.all([
    api.forumSettings().then(({ mode }) => setMode(mode)),
    api.forumTokens().then(({ tokens }) => setTokens(tokens)),
  ]).catch(e => setError(e.message))

  useEffect(() => { reload() }, [])

  const toggleMode = async () => {
    const next: 'oppet' | 'verifierade' = mode === 'verifierade' ? 'oppet' : 'verifierade'
    try {
      await api.saveForumSettings(next)
      setMode(next)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const createToken = async () => {
    if (!form.display_name.trim()) return
    setCreating(true)
    try {
      const tok = await api.createForumToken(form)
      setForm({ display_name: '', role: 'medborgare', issued_by: form.issued_by })
      await reload()
      setShowQr(tok)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (t: ForumToken) => {
    if (!window.confirm(`Återkalla token för "${t.display_name}"? De förlorar sin blå bock och kan inte posta längre (om läget är verifierade).`)) return
    try {
      await api.revokeForumToken(t.id)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const activeTokens = tokens?.filter(t => !t.revoked_at) || []
  const revoked = tokens?.filter(t => t.revoked_at) || []

  return (
    <div>
      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          <button onClick={() => setError(null)} className="float-right ml-4"><X className="h-3.5 w-3.5" /></button>
          {error}
        </div>
      )}

      {/* Mode-toggle */}
      <div className="surface mb-6 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="kicker mb-2">Postningsläge</div>
            {mode === 'verifierade' ? (
              <div>
                <div className="flex items-center gap-2 font-sans text-lg font-medium text-ink">
                  <Lock className="h-4 w-4 text-warning" />
                  Endast verifierade får posta
                </div>
                <p className="mt-1 font-serif text-[15px] text-ink-soft">
                  Alla kan läsa forumet, men bara medborgare med FRG-utställd token kan skriva.
                  Använd vid trollattack, polariserad situation, eller akut nödläge.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 font-sans text-lg font-medium text-ink">
                  <Unlock className="h-4 w-4 text-myndig" />
                  Öppet för alla
                </div>
                <p className="mt-1 font-serif text-[15px] text-ink-soft">
                  Alla på trygghetspunktens wifi kan skriva i forumet efter att ha valt ett visningsnamn. Verifierade får blå bock.
                </p>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={toggleMode} disabled={mode === null}>
            {mode === 'verifierade' ? 'Öppna för alla' : 'Endast verifierade'}
          </button>
        </div>
      </div>

      {/* Ny token */}
      <div className="surface mb-6 p-6">
        <div className="kicker mb-3">Verifiera en medborgare</div>
        <p className="mb-4 font-serif text-[15px] text-ink-soft">
          Personen står framför dig, uppger sitt visningsnamn, och du skapar en token.
          Sedan visar du QR-koden för personen — skanning på deras telefon ger blå bock.
        </p>
        <div className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">
          <div>
            <label className="field-label">Namn personen uppgav</label>
            <input
              className="field-input mt-2"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="T.ex. Anna från Sulvik"
            />
          </div>
          <div>
            <label className="field-label">Roll</label>
            <select
              className="field-input mt-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'medborgare' | 'frg' })}
            >
              <option value="medborgare">Medborgare (blå bock)</option>
              <option value="frg">FRG-volontär</option>
            </select>
          </div>
          <div>
            <label className="field-label">Utfärdat av</label>
            <input
              className="field-input mt-2"
              value={form.issued_by}
              onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
              placeholder="Din signatur"
            />
          </div>
          <button
            className="btn-primary mt-7"
            onClick={createToken}
            disabled={creating || !form.display_name.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? 'Skapar…' : 'Skapa & visa QR'}
          </button>
        </div>
      </div>

      {/* Aktiva tokens */}
      <div>
        <h3 className="kicker mb-3">Aktiva tokens · {activeTokens.length}</h3>
        {!tokens ? (
          <div className="surface p-6 text-center font-serif text-ink-soft">Hämtar…</div>
        ) : activeTokens.length === 0 ? (
          <div className="surface p-8 text-center font-serif text-ink-soft">Inga verifierade medborgare än.</div>
        ) : (
          <ul className="space-y-2">
            {activeTokens.map(t => (
              <li key={t.id} className="surface flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-sans text-[15px]">
                    <span className="font-medium">{t.display_name}</span>
                    {t.role === 'frg' ? (
                      <span className="rounded-sm bg-myndig px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">FRG</span>
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1da1f2] text-[10px] font-bold text-white" title="Blå bock">✓</span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-muted">
                    Utfärdat av {t.issued_by} · {formatDate(t.issued_at)}
                    {t.last_used_at && ` · senast aktiv ${formatDate(t.last_used_at)}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => setShowQr(t)}>
                    <QrCode className="h-3.5 w-3.5" />
                    QR
                  </button>
                  <button className="btn-ghost text-accent-brick" onClick={() => revoke(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Återkalla
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {revoked.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-ink-muted">
              {revoked.length} återkallade tokens
            </summary>
            <ul className="mt-3 space-y-2">
              {revoked.map(t => (
                <li key={t.id} className="surface p-3 opacity-60">
                  <div className="font-sans text-sm">{t.display_name}</div>
                  <div className="font-mono text-xs text-ink-muted">Återkallad {formatDate(t.revoked_at!)}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {showQr && <QrModal token={showQr} onClose={() => setShowQr(null)} />}
    </div>
  )
}

function QrModal({ token, onClose }: { token: ForumToken; onClose: () => void }) {
  const qrUrl = `/api/admin/forum/tokens/${token.id}/qr?host=${encodeURIComponent(window.location.origin)}`
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6"
      onClick={onClose}
    >
      <div className="surface max-w-sm p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="kicker mb-2">Visa för medborgaren</div>
        <div className="flex items-center justify-center gap-2 font-serif text-2xl">
          {token.display_name}
          {token.role === 'frg' ? (
            <span className="rounded-sm bg-myndig px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-white">FRG</span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1da1f2] text-xs font-bold text-white">✓</span>
          )}
        </div>
        <p className="mt-2 font-serif text-[15px] text-ink-soft">
          Be personen skanna QR-koden med sin telefonkamera. Det sätter en verifieringskaka på deras enhet.
        </p>
        <div className="mx-auto my-5 border border-paper-rule bg-white p-3">
          <img src={qrUrl} alt="QR-kod" className="h-[300px] w-[300px]" />
        </div>
        <button className="btn-primary w-full justify-center" onClick={onClose}>
          Klart
        </button>
      </div>
    </div>
  )
}

function GroupMessages({
  group,
  onPin,
  onDelete,
  onChange,
}: {
  group: ForumGroup
  onPin: () => void
  onDelete: () => void
  onChange: () => void
}) {
  const [messages, setMessages] = useState<ForumMessage[] | null>(null)

  const load = () =>
    api.forumMessages(group.id).then(({ messages }) => setMessages(messages)).catch(() => {})

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [group.id])

  const removeMessage = async (m: ForumMessage) => {
    if (m.deleted_at) return
    if (!window.confirm(`Ta bort meddelande från "${m.author_name}"?\n\n"${m.body.slice(0, 100)}${m.body.length > 100 ? '…' : ''}"`)) return
    try {
      await api.deleteForumMessage(m.id, 'FRG')
      await load()
      onChange()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="surface p-6">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-paper-rule pb-4">
        <div>
          <div className="kicker">Grupp · {group.slug}</div>
          <h2 className="mt-1 font-serif text-2xl">{group.name}</h2>
          {group.description && (
            <p className="mt-1 font-serif text-[15px] text-ink-soft">{group.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <a href={`/forum/${group.slug}`} target="_blank" rel="noreferrer" className="btn-ghost" title="Öppna publikt">
            <ExternalLink className="h-3.5 w-3.5" />
            Publikt
          </a>
          <button className="btn-ghost" onClick={onPin} title={group.pinned ? 'Ta bort fastnålning' : 'Fastnåla'}>
            {group.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {group.pinned ? 'Lossa' : 'Fastnåla'}
          </button>
          <button className="btn-ghost text-accent-brick" onClick={onDelete} title="Radera gruppen">
            <Trash2 className="h-3.5 w-3.5" />
            Radera
          </button>
        </div>
      </div>

      {messages === null ? (
        <div className="p-8 text-center font-serif text-ink-soft">Hämtar…</div>
      ) : messages.length === 0 ? (
        <div className="p-8 text-center font-serif text-ink-soft">Inga meddelanden än.</div>
      ) : (
        <ol className="space-y-3">
          {messages.map(m => {
            const isFrg = m.author_role === 'frg'
            const isVerified = (m as any).verified || isFrg
            return (
              <li key={m.id} className={cn('border-l-2 p-3', m.deleted_at ? 'border-accent-brick/40 bg-accent-brick/5' : isFrg ? 'border-myndig bg-myndig-tint/30' : 'border-paper-rule')}>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-sm font-medium">{m.author_name}</span>
                    {isVerified && !isFrg && (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#1da1f2] text-[9px] font-bold text-white" title="Verifierad">✓</span>
                    )}
                    {isFrg && (
                      <span className="rounded-sm bg-myndig px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">FRG</span>
                    )}
                    <span className="font-mono text-xs text-ink-muted">{formatDate(m.created_at)}</span>
                  </div>
                  {!m.deleted_at && (
                    <button onClick={() => removeMessage(m)} className="text-ink-muted hover:text-accent-brick" title="Ta bort meddelande">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {m.deleted_at ? (
                  <div className="mt-1 font-serif text-[15px] italic text-ink-muted">
                    Borttaget av {m.moderated_by || 'FRG'}
                  </div>
                ) : (
                  <div className="mt-1 whitespace-pre-wrap font-serif text-[15px] leading-snug">
                    {m.body}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
