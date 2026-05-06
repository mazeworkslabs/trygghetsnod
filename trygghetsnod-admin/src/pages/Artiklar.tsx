import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Save, Trash2, ArrowLeft, Eye, EyeOff, Image, Printer } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { api, type Article, type ArticleMeta } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

export function ArtiklarList() {
  const [articles, setArticles] = useState<ArticleMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.articles().then(({ articles }) => setArticles(articles)).catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <PageHeader
        kicker="Artiklar"
        title="Nyheter från kommunen"
        description="Egna artiklar som visas på /nyheter. Utkast kan sparas och publiceras senare."
        actions={
          <Link to="/artiklar/ny" className="btn-primary">
            <Plus className="h-3.5 w-3.5" />
            Ny artikel
          </Link>
        }
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      {articles === null ? (
        <div className="surface p-8 text-center font-serif text-ink-soft">Hämtar…</div>
      ) : articles.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-serif text-lg text-ink-soft">Inga artiklar än.</p>
          <Link to="/artiklar/ny" className="btn-primary mt-4 inline-flex">
            <Plus className="h-3.5 w-3.5" />
            Skriv första artikeln
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {articles.map(a => (
            <li key={a.slug}>
              <Link to={`/artiklar/${a.slug}`} className="surface block p-5 transition-colors hover:border-myndig/40">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="kicker flex items-center gap-2">
                    {a.published ? (
                      <><Eye className="h-3 w-3" /> Publicerad</>
                    ) : (
                      <><EyeOff className="h-3 w-3 opacity-60" /> Utkast</>
                    )}
                  </div>
                  <div className="font-mono text-xs text-ink-muted">{a.date}</div>
                </div>
                <h3 className={cn('mt-2 font-serif text-xl text-ink', !a.published && 'text-ink-soft')}>
                  {a.title}
                </h3>
                {a.summary && (
                  <p className="mt-1 font-serif text-[15px] leading-snug text-ink-soft">{a.summary}</p>
                )}
                <div className="mt-2 font-mono text-xs text-ink-muted">{a.author}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ArtikelEditor() {
  const { slug } = useParams<{ slug?: string }>()
  const isNew = !slug || slug === 'ny'
  const navigate = useNavigate()

  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState<Article | null>(isNew
    ? { slug: '', title: '', author: 'Platsansvarig', date: today, published: false, summary: '', image: '', body: '' }
    : null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const heroFileRef = useRef<HTMLInputElement>(null)
  const [slugEditable, setSlugEditable] = useState(false)

  useEffect(() => {
    if (isNew) return
    api.article(slug!).then(setData).catch((e) => setError(e.message))
  }, [slug, isNew])

  const save = async () => {
    if (!data) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const created = await api.createArticle(data)
        navigate(`/artiklar/${created.slug}`, { replace: true })
      } else {
        const updated = await api.updateArticle(slug!, data)
        setData(updated)
        if (updated.slug !== slug) navigate(`/artiklar/${updated.slug}`, { replace: true })
        setSlugEditable(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onHeroSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingHero(true)
    setError(null)
    try {
      const { url } = await api.uploadArticleImage(f)
      setData({ ...data, image: url })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingHero(false)
      if (heroFileRef.current) heroFileRef.current.value = ''
    }
  }

  const remove = async () => {
    if (!slug || isNew) return
    if (!window.confirm(`Radera artikeln "${data?.title}"? Detta går inte att ångra.`)) return
    setDeleting(true)
    try {
      await api.deleteArticle(slug)
      navigate('/artiklar')
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  if (!data) {
    return (
      <div>
        <PageHeader kicker="Artikel" title="Hämtar…" />
        {error && <p className="text-accent-brick">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/artiklar" className="btn-ghost">
          <ArrowLeft className="h-3.5 w-3.5" />
          Tillbaka till artiklar
        </Link>
      </div>

      <PageHeader
        kicker={isNew ? 'Ny artikel' : 'Redigera artikel'}
        title={data.title || (isNew ? 'Skriv en rubrik' : 'Artikel')}
        description="Utkast syns bara här. Medborgaren ser bara publicerade artiklar."
        actions={
          <div className="flex items-center gap-2">
            {!isNew && (
              <button className="btn-ghost" onClick={remove} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Raderar…' : 'Radera'}
              </button>
            )}
            <button className="btn-primary" onClick={save} disabled={saving || !data.title}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Sparar…' : isNew ? 'Spara utkast' : 'Spara'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="surface mb-6 border-accent-brick/40 bg-accent-brick/5 p-4 font-sans text-sm text-accent-brick">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="surface p-6">
          <div className="space-y-5">
            <div>
              <label className="field-label">Rubrik</label>
              <input
                className="field-input mt-2 font-serif text-xl"
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="Rubrik"
              />
            </div>

            <div>
              <label className="field-label">Ingress</label>
              <textarea
                className="field-input mt-2 font-serif"
                rows={2}
                value={data.summary}
                onChange={(e) => setData({ ...data, summary: e.target.value })}
                placeholder="Kort sammanfattning som visas i listan och som intro."
              />
            </div>

            <div>
              <label className="field-label">Brödtext</label>
              <div className="mt-2">
                <MarkdownEditor
                  value={data.body}
                  onChange={(body) => setData({ ...data, body })}
                  height="500px"
                  placeholder="Skriv din artikel här. Använd toolbar ovan för formatering. Bilder kan dras in direkt och laddas upp automatiskt."
                  onUploadImage={async (file) => {
                    const { url } = await api.uploadArticleImage(file)
                    return url
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface p-5">
            <div className="kicker mb-3">Bild</div>
            {data.image ? (
              <div className="space-y-3">
                <img src={data.image} alt="" className="w-full rounded border border-paper-rule" />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    onClick={() => heroFileRef.current?.click()}
                    disabled={uploadingHero}
                  >
                    <Image className="h-3.5 w-3.5" />
                    Byt
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setData({ ...data, image: '' })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Ta bort
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost w-full justify-center"
                onClick={() => heroFileRef.current?.click()}
                disabled={uploadingHero}
              >
                <Image className="h-3.5 w-3.5" />
                {uploadingHero ? 'Laddar upp…' : 'Lägg till bild'}
              </button>
            )}
            <input
              ref={heroFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onHeroSelected}
            />
            <p className="mt-2 font-serif text-[13px] leading-snug text-ink-soft">
              Visas högst upp i artikeln och som thumbnail i nyhetslistan.
            </p>
          </div>

          <div className="surface-warm p-5">
            <div className="kicker mb-3">Publicering</div>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={data.published}
                onChange={(e) => setData({ ...data, published: e.target.checked })}
                className="mt-1 accent-myndig"
              />
              <div>
                <div className="font-sans text-sm font-medium">Publicerad</div>
                <div className="mt-0.5 font-serif text-[14px] leading-snug text-ink-soft">
                  När kryssrutan är ifylld syns artikeln för allmänheten på /nyheter.
                </div>
              </div>
            </label>
          </div>

          <div className="surface p-5">
            <div className="kicker mb-3">Metadata</div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Datum</label>
                <input
                  type="date"
                  className="field-input mt-2 font-mono text-sm"
                  value={data.date}
                  onChange={(e) => setData({ ...data, date: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Författare</label>
                <input
                  className="field-input mt-2"
                  value={data.author}
                  onChange={(e) => setData({ ...data, author: e.target.value })}
                />
              </div>
              {!isNew && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="field-label">Slug (URL)</label>
                    <button
                      type="button"
                      className="font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-ink"
                      onClick={() => setSlugEditable(!slugEditable)}
                    >
                      {slugEditable ? 'Lås' : 'Redigera'}
                    </button>
                  </div>
                  {slugEditable ? (
                    <input
                      className="field-input mt-2 font-mono text-sm"
                      value={data.slug}
                      onChange={(e) => setData({ ...data, slug: e.target.value })}
                    />
                  ) : (
                    <div className="mt-2 font-mono text-xs text-ink-muted">/nyheter/{data.slug}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isNew && data.published && (
            <div className="space-y-2">
              <a
                href={`/nyheter/${data.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost w-full justify-center"
              >
                Öppna publikt →
              </a>
              <button
                type="button"
                onClick={() => {
                  // Öppna artikel-sidan i ny flik med ?print=1 — en liten skript där
                  // kallar window.print() automatiskt när sidan är klar.
                  window.open(`/nyheter/${data.slug}?print=1`, '_blank', 'noopener')
                }}
                className="btn-ghost w-full justify-center"
                title="Öppnar artikeln med utskriftsdialogen direkt"
              >
                <Printer className="h-3.5 w-3.5" />
                Skriv ut som A4
              </button>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-4 font-mono text-xs text-ink-muted">
        {!isNew && `Senast sparat ${formatDate(new Date().toISOString())}`}
      </div>
    </div>
  )
}
