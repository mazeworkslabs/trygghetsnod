import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Save, Trash2, ArrowLeft, Eye, EyeOff, Image } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
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
        description="Egna artiklar som visas under /nyheter. Utkast kan skrivas i lugn och ro och publiceras när de är klara."
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
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState<Article | null>(isNew
    ? { slug: '', title: '', author: 'Platsansvarig', date: today, published: false, summary: '', body: '' }
    : null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
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

  const insertAtCursor = (text: string) => {
    if (!data) return
    const el = bodyRef.current
    if (!el) {
      setData({ ...data, body: data.body + text })
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    setData({ ...data, body: next })
    setTimeout(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    }, 0)
  }

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    setError(null)
    try {
      const { url, filename } = await api.uploadArticleImage(f)
      insertAtCursor(`\n\n![${filename}](${url})\n\n`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
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
        description="Markdown stöds i brödtexten. Utkast syns bara i admin — medborgaren ser bara publicerade artiklar."
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
              <div className="flex items-center justify-between">
                <label className="field-label">Text (markdown)</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost"
                  disabled={uploading}
                >
                  <Image className="h-3.5 w-3.5" />
                  {uploading ? 'Laddar upp…' : 'Infoga bild'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImageSelected}
                />
              </div>
              <textarea
                ref={bodyRef}
                className="field-input mt-2 font-mono text-sm leading-relaxed"
                rows={18}
                value={data.body}
                onChange={(e) => setData({ ...data, body: e.target.value })}
                placeholder="## Underrubrik&#10;&#10;Fri text. **Fet** och _kursiv_ stöds.&#10;&#10;- Punktlistor&#10;- Länkar: [text](url)&#10;- Bild: ![alt](url) — eller klicka 'Infoga bild' ovan"
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
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
            <a
              href={`/nyheter/${data.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost w-full justify-center"
            >
              Öppna publikt →
            </a>
          )}
        </aside>
      </div>

      <div className="mt-4 font-mono text-xs text-ink-muted">
        {!isNew && `Senast sparat ${formatDate(new Date().toISOString())}`}
      </div>
    </div>
  )
}
