import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Pin, PinOff, MessageSquare, ExternalLink, X, Lock, Unlock, BadgeCheck, User, Ban, Pencil, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmButton } from '@/components/ConfirmButton'
import { VerifyDialog } from '@/components/VerifyDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { api, type ForumGroup, type ForumMessage, type ForumUser } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

type Tab = 'grupper' | 'verifiering'

export function Forum() {
  const [tab, setTab] = useState<Tab>('grupper')

  return (
    <div>
      <PageHeader
        kicker="Forum"
        title="Moderering, verifiering och grupper"
        description="Modering, grupper och verifiering."
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
  const [users, setUsers] = useState<ForumUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'alla' | 'overifierade' | 'verifierade' | 'blockerade'>('alla')
  const [search, setSearch] = useState('')
  const [issuedBy] = useState('FRG')
  const [verifyTarget, setVerifyTarget] = useState<ForumUser | null>(null)
  const [unverifyTarget, setUnverifyTarget] = useState<ForumUser | null>(null)

  const reload = () =>
    api.forumUsers().then(({ users }) => setUsers(users)).catch(e => setError(e.message))

  useEffect(() => { reload() }, [])
  useEffect(() => {
    const id = setInterval(reload, 8000)
    return () => clearInterval(id)
  }, [])

  const verify = async () => {
    if (!verifyTarget) return
    try {
      await api.verifyUser(verifyTarget.uid, { role: 'medborgare', verified_by: issuedBy })
      setVerifyTarget(null)
      await reload()
    } catch (e) { setError((e as Error).message) }
  }
  const unverify = async () => {
    if (!unverifyTarget) return
    try {
      await api.unverifyUser(unverifyTarget.uid)
      setUnverifyTarget(null)
      await reload()
    } catch (e) { setError((e as Error).message) }
  }

  const visibleUsers = (users || [])
    .filter(u => {
      if (filter === 'alla') return true
      if (filter === 'verifierade') return !!u.verified_at && !u.blocked_at
      if (filter === 'blockerade') return !!u.blocked_at
      return !u.verified_at && !u.blocked_at
    })
    .filter(u => !search || u.display_name.toLowerCase().includes(search.toLowerCase()))

  const counts = {
    alla: users?.length ?? 0,
    overifierade: users?.filter(u => !u.verified_at && !u.blocked_at).length ?? 0,
    verifierade: users?.filter(u => u.verified_at && !u.blocked_at).length ?? 0,
    blockerade: users?.filter(u => u.blocked_at).length ?? 0,
  }

  return (
    <div>
      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          <button onClick={() => setError(null)} className="float-right ml-4"><X className="h-3.5 w-3.5" /></button>
          {error}
        </div>
      )}

      <div className="surface mb-6 p-6">
        <div className="kicker mb-2">Verifiera medborgare</div>
        <p className="mb-3 font-serif text-[15px] text-ink-soft">
          Personen står framför dig. Hitta dem i listan på namn och bild, klicka <strong>Verifiera</strong>.
          De får genast en blå bock på sin telefon. Klicka på namnet för full profil.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <input
            className="field-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök på namn…"
          />
          <select
            className="field-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="alla">Alla ({counts.alla})</option>
            <option value="overifierade">Overifierade ({counts.overifierade})</option>
            <option value="verifierade">Verifierade ({counts.verifierade})</option>
            <option value="blockerade">Blockerade ({counts.blockerade})</option>
          </select>
        </div>
      </div>

      {!users ? (
        <div className="surface p-6 text-center font-serif text-ink-soft">Hämtar…</div>
      ) : visibleUsers.length === 0 ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">
          {search ? 'Ingen matchar sökningen.' : 'Inga användare här.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleUsers.map(u => (
            <li key={u.uid} className={cn('surface flex items-center gap-3 p-3', u.blocked_at && 'opacity-70')}>
              <Link to={`/users/${u.uid}`} className="flex flex-1 items-center gap-3 no-underline hover:opacity-80">
                <UserAvatar user={u} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-sans text-[15px]">
                    <span className="font-medium text-ink">{u.display_name}</span>
                    {u.verified_at && u.role === 'frg' && (
                      <span className="rounded-sm bg-myndig px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">FRG</span>
                    )}
                    {u.verified_at && u.role !== 'frg' && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1da1f2] text-[10px] font-bold text-white" title="Verifierad">✓</span>
                    )}
                    {u.blocked_at && (
                      <span className="flex items-center gap-1 rounded-sm bg-accent-brick px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                        <Ban className="h-2.5 w-2.5" /> Blockerad
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-ink-muted">
                    Senast aktiv {formatDate(u.last_seen_at)}
                    {u.verified_at && !u.blocked_at && ` · verifierad ${formatDate(u.verified_at)}`}
                    {u.blocked_at && ` · blockerad av ${u.blocked_by}`}
                  </div>
                </div>
              </Link>
              {!u.blocked_at && (u.verified_at ? (
                <button className="btn-ghost text-accent-brick" onClick={() => setUnverifyTarget(u)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Återkalla
                </button>
              ) : (
                <button className="btn-ghost" onClick={() => setVerifyTarget(u)}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verifiera
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {verifyTarget && (
        <VerifyDialog
          user={verifyTarget}
          open={!!verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onConfirm={verify}
        />
      )}

      {unverifyTarget && (
        <ConfirmDialog
          open={!!unverifyTarget}
          onClose={() => setUnverifyTarget(null)}
          onConfirm={unverify}
          kicker="Återkalla verifiering"
          title={`Återkalla för ${unverifyTarget.display_name || 'användaren'}?`}
          description="Personen tappar sin blå bock i forumet. Du kan verifiera dem igen senare om du ändrar dig."
          confirmLabel="Återkalla"
          variant="danger"
        />
      )}
    </div>
  )
}

function UserAvatar({ user }: { user: ForumUser }) {
  if (user.avatar_path) {
    return (
      <img
        src={user.avatar_path}
        alt=""
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-paper-rule text-ink-muted">
      <User className="h-5 w-5" />
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

  const togglePostingMode = async () => {
    const next: 'oppet' | 'verifierade' = group.posting_mode === 'verifierade' ? 'oppet' : 'verifierade'
    try {
      await api.updateForumGroup(group.id, { posting_mode: next } as any)
      onChange()
    } catch (e) {
      console.error('Kunde inte ändra läge:', (e as Error).message)
    }
  }

  // Redigeringsläge för gruppmetadata (namn + beskrivning).
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [editDesc, setEditDesc] = useState(group.description)
  const [editSaving, setEditSaving] = useState(false)
  // Synka edit-state om vi byter grupp eller om gruppen uppdateras externt
  useEffect(() => {
    setEditName(group.name)
    setEditDesc(group.description)
    setEditing(false)
  }, [group.id])

  const saveEdit = async () => {
    setEditSaving(true)
    try {
      await api.updateForumGroup(group.id, { name: editName.trim(), description: editDesc.trim() })
      setEditing(false)
      onChange()
    } catch (e) {
      console.error('Kunde inte spara grupp:', (e as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  const removeMessage = async (m: ForumMessage) => {
    if (m.deleted_at) return
    try {
      await api.deleteForumMessage(m.id, 'FRG')
      await load()
      onChange()
    } catch (e) {
      // Visas inte i UI just nu — konsolen räcker tills vi har ett toast-system globalt.
      console.error('Kunde inte ta bort:', (e as Error).message)
    }
  }

  return (
    <div className="surface p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-paper-rule pb-4">
        <div className="min-w-0">
          <div className="kicker">Grupp · {group.slug}</div>
          {editing ? (
            <div className="mt-2 space-y-3">
              <input
                className="field-input font-serif text-xl"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Gruppnamn"
              />
              <textarea
                className="field-input font-serif"
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Kort beskrivning som syns för medborgaren"
              />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={saveEdit} disabled={editSaving || !editName.trim()}>
                  <Save className="h-3.5 w-3.5" />
                  {editSaving ? 'Sparar…' : 'Spara'}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setEditName(group.name); setEditDesc(group.description); setEditing(false) }}
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mt-1 font-serif text-2xl">{group.name}</h2>
              {group.description && (
                <p className="mt-1 font-serif text-[15px] text-ink-soft">{group.description}</p>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <a href={`/forum/${group.slug}`} target="_blank" rel="noreferrer" className="btn-ghost" title="Öppna publikt">
              <ExternalLink className="h-3.5 w-3.5" />
              Publikt
            </a>
            <button className="btn-ghost" onClick={() => setEditing(true)} title="Redigera namn och beskrivning">
              <Pencil className="h-3.5 w-3.5" />
              Redigera
            </button>
            <button className="btn-ghost" onClick={onPin} title={group.pinned ? 'Ta bort fastnålning' : 'Fastnåla'}>
              {group.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {group.pinned ? 'Lossa' : 'Fastnåla'}
            </button>
            <ConfirmButton
              onConfirm={onDelete}
              prompt={`Radera gruppen och ${group.message_count} meddelanden?`}
              confirmLabel="Radera"
              variant="danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Radera
            </ConfirmButton>
          </div>
        )}
      </div>

      {/* Postningsläge per grupp */}
      <div className="mb-4 flex items-start justify-between gap-4 rounded border border-paper-rule bg-paper-warm/20 p-3">
        <div className="flex items-start gap-3">
          {group.posting_mode === 'verifierade' ? (
            <Lock className="mt-0.5 h-4 w-4 text-warning" />
          ) : (
            <Unlock className="mt-0.5 h-4 w-4 text-myndig" />
          )}
          <div>
            <div className="font-sans text-sm font-medium">
              {group.posting_mode === 'verifierade' ? 'Endast verifierade får posta' : 'Öppet för alla'}
            </div>
            <p className="mt-0.5 font-serif text-[14px] leading-snug text-ink-soft">
              {group.posting_mode === 'verifierade'
                ? 'Bara medborgare med blå bock kan skriva i denna grupp. Alla kan läsa.'
                : 'Alla med ett visningsnamn kan skriva i denna grupp.'}
            </p>
          </div>
        </div>
        <button className="btn-ghost flex-shrink-0" onClick={togglePostingMode}>
          {group.posting_mode === 'verifierade' ? 'Öppna för alla' : 'Endast verifierade'}
        </button>
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
                    {m.author_uid ? (
                      <Link
                        to={`/users/${m.author_uid}`}
                        className="font-sans text-sm font-medium text-ink no-underline hover:text-myndig"
                        title="Öppna användaren"
                      >
                        {m.author_name}
                      </Link>
                    ) : (
                      <span className="font-sans text-sm font-medium">{m.author_name}</span>
                    )}
                    {isVerified && !isFrg && (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#1da1f2] text-[9px] font-bold text-white" title="Verifierad">✓</span>
                    )}
                    {isFrg && (
                      <span className="rounded-sm bg-myndig px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">FRG</span>
                    )}
                    <span className="font-mono text-xs text-ink-muted">{formatDate(m.created_at)}</span>
                  </div>
                  {!m.deleted_at && (
                    <ConfirmButton
                      onConfirm={() => removeMessage(m)}
                      prompt="Ta bort?"
                      confirmLabel="Ja"
                      variant="danger"
                      className="!p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
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
