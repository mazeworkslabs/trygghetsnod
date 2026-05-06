import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MessageSquare, ShieldOff, Ban, User as UserIcon, ExternalLink, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmButton } from '@/components/ConfirmButton'
import { VerifyDialog } from '@/components/VerifyDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { api, type ForumUser, type ForumUserMessage } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

export function UserDetail() {
  const { uid = '' } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<ForumUser | null>(null)
  const [messages, setMessages] = useState<ForumUserMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [issuedBy] = useState('FRG')
  const [showVerify, setShowVerify] = useState(false)
  const [showUnverify, setShowUnverify] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [showUnblock, setShowUnblock] = useState(false)

  const reload = () =>
    api.forumUser(uid)
      .then(({ user, messages }) => { setUser(user); setMessages(messages) })
      .catch(e => setError(e.message))

  useEffect(() => {
    if (!uid) return
    reload()
    const id = setInterval(reload, 8000)
    return () => clearInterval(id)
  }, [uid])

  const verify = async () => {
    try {
      const u = await api.verifyUser(uid, { role: 'medborgare', verified_by: issuedBy })
      setUser(u)
      setShowVerify(false)
    } catch (e) { setError((e as Error).message) }
  }
  const unverify = async () => {
    try { setUser(await api.unverifyUser(uid)); setShowUnverify(false) }
    catch (e) { setError((e as Error).message) }
  }
  const block = async (reason?: string) => {
    try {
      setUser(await api.blockUser(uid, { blocked_by: issuedBy, reason }))
      setShowBlock(false)
    } catch (e) { setError((e as Error).message) }
  }
  const unblock = async () => {
    try { setUser(await api.unblockUser(uid)); setShowUnblock(false) }
    catch (e) { setError((e as Error).message) }
  }
  const removeMessage = async (m: ForumUserMessage) => {
    try {
      await api.deleteForumMessage(m.id, 'FRG')
      await reload()
    } catch (e) { setError((e as Error).message) }
  }

  if (!user && !error) {
    return <div className="surface p-8 text-center font-serif text-ink-soft">Hämtar…</div>
  }

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          <ArrowLeft className="h-3.5 w-3.5" />
          Tillbaka
        </button>
      </div>

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {user && (
        <>
          <PageHeader
            kicker="Användare"
            title={user.display_name || 'Namnlös'}
            description={`Senast aktiv ${formatDate(user.last_seen_at)} · skapades ${formatDate(user.created_at)}`}
          />

          {/* Profil-kort */}
          <div className="surface mb-4 flex items-start gap-4 p-5">
            <UserAvatarLarge user={user} />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-sans text-xl font-medium">
                {user.display_name || 'Namnlös'}
                {user.verified_at && user.role === 'frg' && (
                  <span className="rounded-sm bg-myndig px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">FRG</span>
                )}
                {user.verified_at && user.role !== 'frg' && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1da1f2] text-xs font-bold text-white" title="Verifierad">✓</span>
                )}
                {user.blocked_at && (
                  <span className="rounded-sm bg-accent-brick px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">Blockerad</span>
                )}
              </div>
              {user.verified_at && (
                <div className="mt-1 font-mono text-xs text-ink-muted">
                  Verifierad av {user.verified_by} · {formatDate(user.verified_at)}
                </div>
              )}
              {user.blocked_at && (
                <div className="mt-1 font-mono text-xs text-accent-brick">
                  Blockerad av {user.blocked_by} · {formatDate(user.blocked_at)}
                  {user.block_reason && <span className="font-sans normal-case"> — {user.block_reason}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Åtgärder */}
          <div className="surface mb-6 flex flex-wrap items-center gap-2 p-4">
            <span className="kicker mr-2">Åtgärder</span>
            {!user.blocked_at && !user.verified_at && (
              <button className="btn-ghost" onClick={() => setShowVerify(true)}>
                <BadgeCheck className="h-3.5 w-3.5" />
                Verifiera
              </button>
            )}
            {user.verified_at && (
              <button className="btn-ghost text-accent-brick" onClick={() => setShowUnverify(true)}>
                <ShieldOff className="h-3.5 w-3.5" />
                Återkalla verifiering
              </button>
            )}
            {!user.blocked_at ? (
              <button className="btn-ghost text-accent-brick" onClick={() => setShowBlock(true)}>
                <Ban className="h-3.5 w-3.5" />
                Blockera
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => setShowUnblock(true)}>
                Häv blockering
              </button>
            )}
          </div>

          {/* Meddelanden */}
          <div>
            <h3 className="kicker mb-3 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Inlägg och kommentarer · {messages.length}
            </h3>
            {messages.length === 0 ? (
              <div className="surface p-8 text-center font-serif text-ink-soft">
                {user.display_name || 'Användaren'} har inte skrivit något än.
              </div>
            ) : (
              <ul className="space-y-2">
                {messages.map(m => (
                  <li key={m.id} className={cn('surface p-4', m.deleted_at && 'opacity-60')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2 font-mono text-xs text-ink-muted">
                        <span className={cn(
                          'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          m.parent_id ? 'bg-paper-warm text-ink-soft' : 'bg-myndig-tint text-myndig'
                        )}>
                          {m.parent_id ? 'Kommentar' : 'Inlägg'}
                        </span>
                        <Link to={`/forum`} className="hover:text-ink">{m.group_name}</Link>
                        <span>·</span>
                        <span>{formatDate(m.created_at)}</span>
                        {m.deleted_at && <span className="text-accent-brick">· Borttagen</span>}
                      </div>
                      <div className="flex gap-1">
                        <a
                          href={m.parent_id ? `/forum/${m.group_slug}/p/${m.parent_id}` : `/forum/${m.group_slug}/p/${m.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-muted hover:text-ink"
                          title="Öppna i forumet"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {!m.deleted_at && (
                          <ConfirmButton
                            onConfirm={() => removeMessage(m)}
                            prompt="Ta bort?"
                            confirmLabel="Ta bort"
                            variant="danger"
                            className="!p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ConfirmButton>
                        )}
                      </div>
                    </div>
                    {m.deleted_at ? (
                      <div className="mt-2 font-serif text-[14px] italic text-ink-muted">
                        Borttaget av {m.moderated_by || 'FRG'}
                      </div>
                    ) : (
                      <div className="mt-2 whitespace-pre-wrap font-serif text-[15px] leading-snug">
                        {m.body}
                      </div>
                    )}
                    {m.image_path && (
                      <img src={m.image_path} alt="" className="mt-2 max-h-48 rounded border border-paper-rule" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {user && (
        <VerifyDialog
          user={user}
          open={showVerify}
          onClose={() => setShowVerify(false)}
          onConfirm={verify}
        />
      )}

      {user && (
        <ConfirmDialog
          open={showUnverify}
          onClose={() => setShowUnverify(false)}
          onConfirm={unverify}
          kicker="Återkalla verifiering"
          title={`Återkalla för ${user.display_name || 'användaren'}?`}
          description="Personen tappar sin blå bock i forumet. Du kan verifiera dem igen senare om du ändrar dig."
          confirmLabel="Återkalla"
          variant="danger"
        />
      )}

      {user && (
        <ConfirmDialog
          open={showBlock}
          onClose={() => setShowBlock(false)}
          onConfirm={(reason) => block(reason)}
          kicker="Blockera användare"
          title={`Blockera ${user.display_name || 'användaren'}?`}
          description={
            <>
              Personen kan fortfarande läsa forumet, men kan <strong>inte posta, kommentera eller gilla</strong>.
              Eventuell verifiering tas bort. Du kan häva blockeringen senare.
            </>
          }
          confirmLabel="Blockera"
          variant="danger"
          reasonPlaceholder="Anledning (valfri, syns bara för andra FRG)"
        />
      )}

      {user && (
        <ConfirmDialog
          open={showUnblock}
          onClose={() => setShowUnblock(false)}
          onConfirm={unblock}
          kicker="Häv blockering"
          title={`Häv blockeringen för ${user.display_name || 'användaren'}?`}
          description="Personen kan posta, kommentera och gilla igen. De är fortfarande overifierade tills du verifierar dem på nytt."
          confirmLabel="Häv blockering"
        />
      )}
    </div>
  )
}

function UserAvatarLarge({ user }: { user: ForumUser }) {
  if (user.avatar_path) {
    return <img src={user.avatar_path} alt="" className="h-16 w-16 flex-shrink-0 rounded-full object-cover" />
  }
  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-paper-rule text-ink-muted">
      <UserIcon className="h-7 w-7" />
    </div>
  )
}
