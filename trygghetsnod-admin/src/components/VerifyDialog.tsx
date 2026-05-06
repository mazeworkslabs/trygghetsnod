import { useState } from 'react'
import { BadgeCheck, ShieldAlert, User as UserIcon, ZoomIn } from 'lucide-react'
import { Modal } from './Modal'
import { ImageLightbox } from './ImageLightbox'
import type { ForumUser } from '@/lib/api'

interface VerifyDialogProps {
  user: ForumUser
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

/**
 * Verifieringsdialogen. Stor, tydlig, med checklista innan man kan trycka Verifiera.
 *
 * Designprincip: verifiering är en moderationsåtgärd som inte ska gå att råka göra.
 * FRG måste aktivt bocka av att namn och bild stämmer. Bilden kan förstoras för
 * att granska — viktigt om personen står framför och man vill jämföra.
 */
export function VerifyDialog({ user, open, onClose, onConfirm }: VerifyDialogProps) {
  const [nameOk, setNameOk] = useState(false)
  const [photoOk, setPhotoOk] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [zoomImage, setZoomImage] = useState(false)

  const canVerify = nameOk && (photoOk || !user.avatar_path)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      // Återställ state så nästa öppning är ren
      setNameOk(false)
      setPhotoOk(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setNameOk(false)
    setPhotoOk(false)
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        kicker="Verifiera användare"
        title={user.display_name || 'Namnlös'}
        size="md"
        closeOnBackdrop={!submitting}
      >
        {/* Avatar + zoom-affordance */}
        <div className="mb-5 flex items-start gap-5">
          {user.avatar_path ? (
            <button
              type="button"
              className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-paper-rule"
              onClick={() => setZoomImage(true)}
              title="Klicka för att förstora"
            >
              <img src={user.avatar_path} alt="" className="h-32 w-32 object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ZoomIn className="h-6 w-6" />
              </span>
            </button>
          ) : (
            <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-paper-rule bg-paper-warm/30 text-ink-muted">
              <UserIcon className="h-10 w-10" />
            </div>
          )}
          <div className="flex-1 pt-1">
            <div className="font-mono text-xs uppercase tracking-wider text-ink-muted">Visningsnamn</div>
            <div className="mt-1 font-serif text-2xl text-ink">{user.display_name || '—'}</div>
            {!user.avatar_path && (
              <p className="mt-2 font-serif text-[14px] text-ink-soft">
                Användaren har ingen bild. Du kan ändå verifiera.
              </p>
            )}
          </div>
        </div>

        {/* Varför vi verifierar */}
        <div className="mb-5 rounded border-l-2 border-myndig bg-myndig-tint/40 px-4 py-3 font-serif text-[14px] leading-snug text-ink-soft">
          Verifierade användare får en blå bock i forumet. Det säger till andra att FRG har sett personen och bekräftat namnet.
        </div>

        {/* Checklista */}
        <div className="mb-5">
          <div className="kicker mb-3">Innan du verifierar</div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded border border-paper-rule p-3 hover:bg-paper-warm/30">
              <input
                type="checkbox"
                checked={nameOk}
                onChange={(e) => setNameOk(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-myndig"
              />
              <div>
                <div className="font-sans text-sm font-medium">Namnet stämmer</div>
                <div className="mt-0.5 font-serif text-[13px] leading-snug text-ink-soft">
                  Personen framför dig har bekräftat att <strong>{user.display_name || '—'}</strong> är deras namn.
                </div>
              </div>
            </label>

            {user.avatar_path && (
              <label className="flex cursor-pointer items-start gap-3 rounded border border-paper-rule p-3 hover:bg-paper-warm/30">
                <input
                  type="checkbox"
                  checked={photoOk}
                  onChange={(e) => setPhotoOk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-myndig"
                />
                <div>
                  <div className="font-sans text-sm font-medium">Bilden är personen framför dig</div>
                  <div className="mt-0.5 font-serif text-[13px] leading-snug text-ink-soft">
                    Klicka på bilden ovan för att förstora om du vill granska närmare.
                  </div>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Konsekvens */}
        <div className="mb-6 flex items-start gap-3 rounded border border-paper-rule bg-paper-warm/30 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <p className="font-serif text-[14px] leading-snug text-ink-soft">
            Om användaren byter namn eller bild senare tappar de verifieringen automatiskt. Då behöver du verifiera dem på nytt.
          </p>
        </div>

        {/* Knappar */}
        <div className="flex justify-end gap-2 border-t border-paper-rule pt-4">
          <button className="btn-ghost" onClick={handleClose} disabled={submitting}>
            Avbryt
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!canVerify || submitting}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            {submitting ? 'Verifierar…' : 'Verifiera'}
          </button>
        </div>
      </Modal>

      {zoomImage && user.avatar_path && (
        <ImageLightbox src={user.avatar_path} onClose={() => setZoomImage(false)} />
      )}
    </>
  )
}
