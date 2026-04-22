import { useEffect, useState } from 'react'
import { Plus, Trash2, Pin, PinOff, MessageSquare, ExternalLink, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { api, type ForumGroup, type ForumMessage } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

export function Forum() {
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
      <PageHeader
        kicker="Forum"
        title="Moderering och grupper"
        description="FRG administrerar. Grupper kan fastnålas, meddelanden kan tas bort. Borttagna meddelanden sparas som tombstone — originaltexten försvinner men raden finns kvar för revision."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            Ny grupp
          </button>
        }
      />

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
          <a
            href={`/forum/${group.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            title="Öppna publikt"
          >
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
          {messages.map(m => (
            <li key={m.id} className={cn('border-l-2 p-3', m.deleted_at ? 'border-accent-brick/40 bg-accent-brick/5' : 'border-paper-rule')}>
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-sans text-sm font-medium">{m.author_name}</span>
                  <span className="font-mono text-xs text-ink-muted">{formatDate(m.created_at)}</span>
                </div>
                {!m.deleted_at && (
                  <button
                    onClick={() => removeMessage(m)}
                    className="text-ink-muted hover:text-accent-brick"
                    title="Ta bort meddelande"
                  >
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
          ))}
        </ol>
      )}
    </div>
  )
}
