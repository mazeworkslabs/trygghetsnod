import express from 'express'
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync, statfsSync, appendFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import matter from 'gray-matter'
import { marked } from 'marked'
import multer from 'multer'
import cookieParser from 'cookie-parser'
import {
  createForumPool,
  migrateForum,
  listGroups,
  getGroupBySlug,
  listMessages,
  postMessage,
  softDeleteMessage,
  createGroup,
  updateGroup,
  deleteGroup,
} from './forum.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPO_ROOT = join(ROOT, '..')

const KOMMUN = process.env.KOMMUN || 'arvika'
const KOMMUN_DIR = process.env.KOMMUN_DIR || join(REPO_ROOT, 'kommuner', KOMMUN)
const STORAGE_DIR = process.env.PORTAL_STORAGE_ROOT || join(REPO_ROOT, 'storage')
const MAPS_DIR = process.env.PORTAL_MAPS || join(STORAGE_DIR, 'maps', 'pmtiles')
const ZIM_DIR = process.env.PORTAL_ZIM || join(STORAGE_DIR, 'zim')
const ADMIN_DIST = process.env.PORTAL_ADMIN_DIST || join(REPO_ROOT, 'trygghetsnod-admin', 'dist')
const PORT = Number(process.env.PORT || 8400)
const STARTED_AT = Date.now()

const updatePath = join(KOMMUN_DIR, 'update.json')
const updateExamplePath = join(KOMMUN_DIR, 'update.example.json')
if (!existsSync(updatePath) && existsSync(updateExamplePath)) {
  copyFileSync(updateExamplePath, updatePath)
  console.log(`Initierade ${updatePath} från update.example.json`)
}

const app = express()
app.set('views', join(ROOT, 'views'))
app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: true }))
app.use(express.static(join(ROOT, 'public')))

app.use('/vendor/maplibre', express.static(join(ROOT, 'node_modules/maplibre-gl/dist')))
app.use('/vendor/pmtiles', express.static(join(ROOT, 'node_modules/pmtiles/dist')))
app.use('/vendor/protomaps', express.static(join(ROOT, 'node_modules/protomaps-themes-base/dist')))
app.use('/tiles', express.static(MAPS_DIR, { acceptRanges: true }))
app.use(express.json({ limit: '256kb' }))
app.use(cookieParser())

const forumPool = createForumPool()
migrateForum(forumPool).catch((err) => {
  console.error('Forum-migration misslyckades:', err.message)
})

const readDisplayName = (req) =>
  String(req.cookies?.tnod_name || '').trim().slice(0, 60)

const KIWIX_BASE_OVERRIDE = process.env.KIWIX_BASE

const loadKommunJSON = (name) => {
  const data = JSON.parse(readFileSync(join(KOMMUN_DIR, name), 'utf8'))
  if (name === 'config.json' && KIWIX_BASE_OVERRIDE) {
    data.kiwix_base = KIWIX_BASE_OVERRIDE
  }
  return data
}
const saveKommunJSON = (name, data) => writeFileSync(join(KOMMUN_DIR, name), JSON.stringify(data, null, 2))

const appendLoggbok = (entry) => {
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n'
  appendFileSync(join(KOMMUN_DIR, 'loggbok.jsonl'), line)
}

const readLoggbok = (limit = 50) => {
  try {
    const raw = readFileSync(join(KOMMUN_DIR, 'loggbok.jsonl'), 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
  } catch { return [] }
}

const SEVERITIES = {
  info: { label: 'Information', tone: 'info' },
  warning: { label: 'Varning', tone: 'warning' },
  emergency: { label: 'Nödläge', tone: 'emergency' },
}

let kiwixCache = { at: 0, books: [] }
const fetchKiwixBooks = async (base) => {
  const now = Date.now()
  if (now - kiwixCache.at < 30_000) return kiwixCache.books
  try {
    const r = await fetch(`${base}/catalog/v2/entries?count=-1`, { signal: AbortSignal.timeout(2000) })
    if (!r.ok) return kiwixCache.books
    const xml = await r.text()
    const books = []
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g
    let m
    while ((m = entryRe.exec(xml)) !== null) {
      const e = m[1]
      const get = (re) => { const x = e.match(re); return x ? x[1] : '' }
      const name = get(/<name>([^<]+)<\/name>/)
      const title = get(/<title>([^<]+)<\/title>/)
      if (!name || !title) continue
      const href = get(/<link[^>]+type="text\/html"[^>]+href="([^"]+)"/)
      // Kiwix returnerar t.ex. "/content/krisinformation_sv_2026-04"
      // — vi exponerar boken via /innehall/<slug>/ (slug = sista path-segmentet)
      const slug = href ? href.replace(/^\/content\//, '').replace(/\/$/, '') : name
      books.push({
        name,
        title,
        language: get(/<language>([^<]+)<\/language>/),
        summary: get(/<summary>([^<]+)<\/summary>/),
        slug,
        articleCount: Number(get(/<articleCount>(\d+)<\/articleCount>/) || 0),
      })
    }
    kiwixCache = { at: now, books }
    return books
  } catch {
    return kiwixCache.books
  }
}

const formatDate = (iso) => {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const isLocalRequest = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

const localOnly = (req, res, next) => {
  if (!isLocalRequest(req)) {
    return res.status(403).type('text/plain').send(
      'Admin är endast tillgängligt från enheten själv (localhost).\n' +
      'Använd http://localhost:' + PORT + '/admin direkt på Trygghetsnod-enheten.'
    )
  }
  next()
}

app.get('/', async (_req, res) => {
  const config = loadKommunJSON('config.json')
  const update = loadKommunJSON('update.json')
  const books = await fetchKiwixBooks(config.kiwix_base)
  const sources = loadSources()
  const publishedBooks = books.filter(b => sources.published?.[b.slug] ?? (b.language === 'swe'))
  const articles = listArticles({ onlyPublished: true }).map(({ body: _b, ...rest }) => rest)
  res.render('index', {
    config,
    update,
    books: publishedBooks,
    articles,
    sev: SEVERITIES[update.severity],
    formatDate,
  })
})

app.get('/print', (_req, res) => {
  const config = loadKommunJSON('config.json')
  const update = loadKommunJSON('update.json')
  res.render('print', { config, update, sev: SEVERITIES[update.severity], formatDate })
})

// ---- Admin API (lokal-only) ----

app.get('/api/admin/status', localOnly, async (_req, res) => {
  const config = loadKommunJSON('config.json')
  let update = null
  try { update = loadKommunJSON('update.json') } catch {}

  let kiwixOk = false
  let kiwixBooks = 0
  let kiwixLatencyMs = null
  try {
    const t0 = Date.now()
    const r = await fetch(`${config.kiwix_base}/catalog/v2/entries?count=-1`, { signal: AbortSignal.timeout(2000) })
    kiwixLatencyMs = Date.now() - t0
    kiwixOk = r.ok
    const body = await r.text()
    const m = body.match(/<totalResults[^>]*>(\d+)<\/totalResults>/)
    if (m) kiwixBooks = Number(m[1])
  } catch {}

  let total = 0, free = 0
  try {
    const s = statfsSync(STORAGE_DIR)
    total = Number(s.blocks) * Number(s.bsize)
    free = Number(s.bavail) * Number(s.bsize)
  } catch {}

  const dirSize = (dir) => {
    try {
      return readdirSync(dir).reduce((acc, f) => {
        try { return acc + statSync(join(dir, f)).size } catch { return acc }
      }, 0)
    } catch { return 0 }
  }

  res.json({
    ok: true,
    kommun: config.kommun,
    portal: { ok: true, uptime_seconds: (Date.now() - STARTED_AT) / 1000 },
    kiwix: { ok: kiwixOk, books: kiwixBooks, latency_ms: kiwixLatencyMs },
    storage: {
      total_bytes: total,
      free_bytes: free,
      zim_bytes: dirSize(ZIM_DIR),
      maps_bytes: dirSize(join(STORAGE_DIR, 'maps', 'pmtiles')),
    },
    update: update ? {
      title: update.title,
      severity: update.severity,
      author: update.author,
      updated_at: update.updated_at,
    } : null,
  })
})

app.get('/api/admin/zims', localOnly, (_req, res) => {
  let zims = []
  try {
    zims = readdirSync(ZIM_DIR)
      .filter(f => f.endsWith('.zim'))
      .map(filename => {
        const s = statSync(join(ZIM_DIR, filename))
        return {
          filename,
          size_bytes: s.size,
          modified: s.mtime.toISOString(),
        }
      })
      .sort((a, b) => a.filename.localeCompare(b.filename))
  } catch {}
  res.json({ zims })
})

app.get('/api/admin/update', localOnly, (_req, res) => {
  res.json(loadKommunJSON('update.json'))
})

app.put('/api/admin/update', localOnly, (req, res) => {
  const body = req.body || {}
  const update = {
    title: String(body.title || '').trim(),
    body: String(body.body || '').trim(),
    severity: SEVERITIES[body.severity] ? body.severity : 'info',
    author: String(body.author || '').trim() || 'Platsansvarig',
    updated_at: new Date().toISOString(),
  }
  saveKommunJSON('update.json', update)
  appendLoggbok({
    type: 'lagesuppdatering',
    title: update.title,
    severity: update.severity,
    author: update.author,
  })
  res.json(update)
})

// ---- Artiklar (markdown med frontmatter) ----
// kommuner/<kommun>/artiklar/<slug>.md
// Frontmatter: title, author, date, published, summary

const articlesDir = () => join(KOMMUN_DIR, 'artiklar')
const articlesMediaDir = () => join(articlesDir(), 'media')

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artikel'

const asDateString = (v) => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  // "2026-04-22T00:00:00.000Z" → "2026-04-22"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}

const readArticleFile = (slug) => {
  const safe = slug.replace(/[^a-z0-9-]/gi, '')
  const path = join(articlesDir(), `${safe}.md`)
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf8')
  const parsed = matter(raw)
  return {
    slug: safe,
    title: String(parsed.data.title || safe),
    author: String(parsed.data.author || ''),
    date: asDateString(parsed.data.date),
    published: parsed.data.published !== false,
    summary: String(parsed.data.summary || ''),
    body: parsed.content || '',
  }
}

const listArticles = ({ onlyPublished = false } = {}) => {
  try {
    return readdirSync(articlesDir())
      .filter(f => f.endsWith('.md'))
      .map(f => readArticleFile(f.replace(/\.md$/, '')))
      .filter(Boolean)
      .filter(a => !onlyPublished || a.published)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  } catch { return [] }
}

const writeArticle = (article) => {
  mkdirSync(articlesDir(), { recursive: true })
  const frontmatter = {
    title: article.title,
    author: article.author || 'Platsansvarig',
    date: article.date || new Date().toISOString().slice(0, 10),
    published: article.published !== false,
    summary: article.summary || '',
  }
  const content = matter.stringify(article.body || '', frontmatter)
  writeFileSync(join(articlesDir(), `${article.slug}.md`), content)
}

const deleteArticle = (slug) => {
  const safe = slug.replace(/[^a-z0-9-]/gi, '')
  const path = join(articlesDir(), `${safe}.md`)
  if (existsSync(path)) unlinkSync(path)
}

// ---- Källor (Kiwix-böcker som publiceras på startsidan) ----
// sources.json: { published: { "<kiwix-slug>": true/false } }
// Default (om nyckel saknas): böcker med språk=swe är på, andra av.

const loadSources = () => {
  try { return loadKommunJSON('sources.json') } catch { return { published: {} } }
}

app.get('/api/admin/sources', localOnly, async (_req, res) => {
  const config = loadKommunJSON('config.json')
  const books = await fetchKiwixBooks(config.kiwix_base)
  const sources = loadSources()
  const combined = books.map(b => ({
    slug: b.slug,
    name: b.name,
    title: b.title,
    language: b.language,
    summary: b.summary,
    articleCount: b.articleCount,
    published: sources.published?.[b.slug] ?? (b.language === 'swe'),
  }))
  res.json({ books: combined })
})

app.put('/api/admin/sources', localOnly, (req, res) => {
  const body = req.body || {}
  if (!body.published || typeof body.published !== 'object') {
    return res.status(400).json({ error: 'published-objekt krävs' })
  }
  saveKommunJSON('sources.json', { published: body.published })
  appendLoggbok({
    type: 'sources',
    title: `Publicerade källor uppdaterade`,
    author: String(body.author || '').trim() || 'Platsansvarig',
  })
  res.json({ ok: true })
})

// ---- Artiklar admin-API ----

app.get('/api/admin/articles', localOnly, (_req, res) => {
  const articles = listArticles().map(({ body: _body, ...rest }) => rest)
  res.json({ articles })
})

app.get('/api/admin/articles/:slug', localOnly, (req, res) => {
  const a = readArticleFile(req.params.slug)
  if (!a) return res.status(404).json({ error: 'hittades inte' })
  res.json(a)
})

app.post('/api/admin/articles', localOnly, (req, res) => {
  const body = req.body || {}
  if (!body.title) return res.status(400).json({ error: 'title krävs' })
  let slug = slugify(body.slug || body.title)
  // Unika slugs — lägg till -2, -3… vid kollision
  let n = 1
  while (existsSync(join(articlesDir(), `${slug}.md`))) {
    n += 1
    slug = `${slugify(body.slug || body.title)}-${n}`
  }
  const article = {
    slug,
    title: String(body.title).trim(),
    author: String(body.author || '').trim() || 'Platsansvarig',
    date: String(body.date || '').trim() || new Date().toISOString().slice(0, 10),
    published: body.published !== false,
    summary: String(body.summary || '').trim(),
    body: String(body.body || ''),
  }
  writeArticle(article)
  appendLoggbok({
    type: 'artikel',
    title: `Ny artikel: ${article.title}`,
    author: article.author,
  })
  res.json(article)
})

app.put('/api/admin/articles/:slug', localOnly, (req, res) => {
  const existing = readArticleFile(req.params.slug)
  if (!existing) return res.status(404).json({ error: 'hittades inte' })
  const body = req.body || {}
  let targetSlug = existing.slug
  if (body.slug && body.slug !== existing.slug) {
    const wanted = slugify(body.slug)
    if (wanted !== existing.slug) {
      if (existsSync(join(articlesDir(), `${wanted}.md`))) {
        return res.status(409).json({ error: `Slug "${wanted}" är redan upptagen.` })
      }
      targetSlug = wanted
    }
  }
  const article = {
    slug: targetSlug,
    title: String(body.title ?? existing.title).trim(),
    author: String(body.author ?? existing.author).trim() || 'Platsansvarig',
    date: String(body.date ?? existing.date).trim(),
    published: body.published !== undefined ? body.published !== false : existing.published,
    summary: String(body.summary ?? existing.summary).trim(),
    body: String(body.body ?? existing.body),
  }
  writeArticle(article)
  if (targetSlug !== existing.slug) {
    // Ta bort den gamla filen efter att den nya är skriven
    deleteArticle(existing.slug)
  }
  appendLoggbok({
    type: 'artikel',
    title: `Artikel uppdaterad: ${article.title}`,
    author: article.author,
  })
  res.json(article)
})

const articleImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(articlesMediaDir(), { recursive: true })
      cb(null, articlesMediaDir())
    },
    filename: (_req, file, cb) => {
      const ext = (file.originalname.match(/\.(jpe?g|png|gif|webp|svg)$/i) || ['.bin'])[0].toLowerCase()
      const base = slugify(file.originalname.replace(/\.[^.]+$/, '')) || 'bild'
      const stamp = Date.now().toString(36)
      cb(null, `${base}-${stamp}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/jpeg|image\/png|image\/gif|image\/webp|image\/svg\+xml)$/.test(file.mimetype)
    cb(ok ? null : new Error('Endast bilder (jpg, png, gif, webp, svg) tillåtna'), ok)
  },
})

app.post('/api/admin/articles/images', localOnly, articleImageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ingen fil' })
  const url = `/artikel-media/${req.file.filename}`
  res.json({ url, filename: req.file.filename, size: req.file.size })
})

app.use('/artikel-media', (req, res, next) => {
  try {
    express.static(articlesMediaDir(), { fallthrough: false })(req, res, next)
  } catch { next() }
})

app.delete('/api/admin/articles/:slug', localOnly, (req, res) => {
  const existing = readArticleFile(req.params.slug)
  if (!existing) return res.status(404).json({ error: 'hittades inte' })
  deleteArticle(req.params.slug)
  appendLoggbok({
    type: 'artikel',
    title: `Artikel raderad: ${existing.title}`,
    author: String(req.body?.author || '').trim() || 'Platsansvarig',
  })
  res.json({ ok: true })
})

app.get('/api/admin/poi', localOnly, (_req, res) => {
  try {
    res.json(loadKommunJSON('poi.geojson'))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/admin/poi', localOnly, (req, res) => {
  const body = req.body || {}
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) {
    return res.status(400).json({ error: 'FeatureCollection förväntas' })
  }
  let existing = {}
  try { existing = loadKommunJSON('poi.geojson') } catch {}
  const metadata = {
    ...(existing.metadata || {}),
    ...(body.metadata || {}),
    generated: new Date().toISOString().slice(0, 10),
  }
  saveKommunJSON('poi.geojson', {
    type: 'FeatureCollection',
    metadata,
    features: body.features,
  })
  appendLoggbok({
    type: 'poi',
    title: `Kartmarkörer uppdaterade (${body.features.length} st)`,
    author: String(body.author || '').trim() || 'Platsansvarig',
  })
  res.json({ ok: true, count: body.features.length })
})

app.get('/api/admin/loggbok', localOnly, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  res.json({ entries: readLoggbok(limit) })
})

app.post('/api/admin/loggbok', localOnly, (req, res) => {
  const body = req.body || {}
  const entry = {
    type: String(body.type || 'note').trim() || 'note',
    title: String(body.title || '').trim(),
    note: String(body.note || '').trim(),
    author: String(body.author || '').trim() || 'Platsansvarig',
  }
  if (!entry.title && !entry.note) {
    return res.status(400).json({ error: 'title eller note krävs' })
  }
  appendLoggbok(entry)
  res.json({ ok: true })
})

// ---- Admin SPA (statiska filer) ----

if (existsSync(ADMIN_DIST)) {
  app.use('/admin', express.static(ADMIN_DIST, { index: 'index.html' }))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(join(ADMIN_DIST, 'index.html'))
  })
} else {
  app.get('/admin', (_req, res) => {
    res.status(503).type('text/plain').send(
      'Admin-appen är inte byggd. Kör: cd trygghetsnod-admin && npm install && npm run build'
    )
  })
}

// ---- Legacy CMS (EJS) — redirect till admin ----

app.get('/cms', localOnly, (req, res) => {
  const config = loadKommunJSON('config.json')
  const update = loadKommunJSON('update.json')
  res.render('cms', { config, update, severities: SEVERITIES, saved: req.query.saved })
})

app.post('/cms', localOnly, (req, res) => {
  const update = {
    title: (req.body.title || '').trim(),
    body: (req.body.body || '').trim(),
    severity: SEVERITIES[req.body.severity] ? req.body.severity : 'info',
    author: (req.body.author || '').trim() || 'Platsansvarig',
    updated_at: new Date().toISOString(),
  }
  saveKommunJSON('update.json', update)
  res.redirect('/cms?saved=1')
})

app.get('/nyheter', (_req, res) => {
  const config = loadKommunJSON('config.json')
  const articles = listArticles({ onlyPublished: true })
    .map(({ body: _body, ...rest }) => rest)
  res.render('nyheter', { config, articles, formatDate })
})

app.get('/nyheter/:slug', (req, res) => {
  const config = loadKommunJSON('config.json')
  const article = readArticleFile(req.params.slug)
  if (!article || !article.published) return res.status(404).send('Artikeln hittades inte')
  const html = marked.parse(article.body)
  res.render('artikel', { config, article, html, formatDate })
})

// ---- Forum (publikt) ----

app.get('/forum', async (_req, res) => {
  const config = loadKommunJSON('config.json')
  const groups = await listGroups(forumPool)
  res.render('forum', { config, groups, formatDate })
})

app.get('/forum/:slug', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const group = await getGroupBySlug(forumPool, req.params.slug)
  if (!group) return res.status(404).send('Gruppen finns inte')
  res.render('forum-grupp', {
    config,
    group,
    displayName: readDisplayName(req),
    formatDate,
  })
})

app.get('/forum/namn-byte', (req, res) => {
  const config = loadKommunJSON('config.json')
  res.render('forum-namn', {
    config,
    current: readDisplayName(req),
    redirect: req.query.redirect || '/forum',
  })
})

app.post('/forum/namn', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).send('Namn krävs')
  res.cookie('tnod_name', name, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  })
  const redir = typeof req.body?.redirect === 'string' ? req.body.redirect : '/forum'
  res.redirect(redir.startsWith('/') ? redir : '/forum')
})

app.get('/api/forum/groups/:id/messages', async (req, res) => {
  try {
    const messages = await listMessages(forumPool, Number(req.params.id))
    res.json({ messages })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/forum/groups/:id/messages', async (req, res) => {
  const authorName = readDisplayName(req)
  if (!authorName) return res.status(400).json({ error: 'Välj ett visningsnamn först' })
  try {
    const msg = await postMessage(forumPool, {
      groupId: Number(req.params.id),
      authorName,
      authorRole: isLocalRequest(req) ? 'frg' : 'medborgare',
      body: req.body?.body,
    })
    res.json(msg)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ---- Forum admin/moderation (localhost-only) ----

app.get('/api/admin/forum/groups', localOnly, async (_req, res) => {
  const groups = await listGroups(forumPool)
  res.json({ groups })
})

app.post('/api/admin/forum/groups', localOnly, async (req, res) => {
  const body = req.body || {}
  const slug = slugify(body.slug || body.name || '')
  if (!slug || !body.name) return res.status(400).json({ error: 'namn krävs' })
  try {
    const group = await createGroup(forumPool, {
      slug,
      name: String(body.name).trim(),
      description: String(body.description || '').trim(),
      pinned: !!body.pinned,
    })
    appendLoggbok({ type: 'forum', title: `Grupp skapad: ${group.name}`, author: body.author || 'FRG' })
    res.json(group)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put('/api/admin/forum/groups/:id', localOnly, async (req, res) => {
  try {
    const group = await updateGroup(forumPool, Number(req.params.id), req.body || {})
    if (!group) return res.status(404).json({ error: 'gruppen hittades inte' })
    res.json(group)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/admin/forum/groups/:id', localOnly, async (req, res) => {
  await deleteGroup(forumPool, Number(req.params.id))
  appendLoggbok({ type: 'forum', title: `Grupp raderad (#${req.params.id})`, author: req.body?.author || 'FRG' })
  res.json({ ok: true })
})

app.delete('/api/admin/forum/messages/:id', localOnly, async (req, res) => {
  const moderatedBy = String(req.body?.author || '').trim() || 'FRG'
  await softDeleteMessage(forumPool, Number(req.params.id), moderatedBy)
  appendLoggbok({ type: 'forum', title: `Meddelande borttaget (#${req.params.id})`, author: moderatedBy })
  res.json({ ok: true })
})

app.get('/kartor', (_req, res) => {
  const config = loadKommunJSON('config.json')
  res.render('kartor', { config })
})

app.get('/geo/:file', (req, res) => {
  const safe = req.params.file.replace(/[^a-z0-9_.-]/gi, '')
  try {
    const data = readFileSync(join(KOMMUN_DIR, safe), 'utf8')
    res.type('application/geo+json').send(data)
  } catch {
    res.status(404).send('Not found')
  }
})

app.get('/sok', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const q = (req.query.q || '').trim()
  let hits = []
  let total = 0
  if (q) {
    const url = `${config.kiwix_base}/search?pattern=${encodeURIComponent(q)}&books.filter.lang=swe&pageLength=20`
    const response = await fetch(url)
    const html = await response.text()
    const totalMatch = html.match(/of\s+<b>(\d+)<\/b>/)
    if (totalMatch) total = Number(totalMatch[1])
    const re = /<a href="\/content\/([^"]+)">\s*([\s\S]*?)\s*<\/a>[\s\S]*?<div class="book-title">from\s+([^<]+)<\/div>[\s\S]*?<div class="informations">([^<]+)<\/div>/g
    let m
    while ((m = re.exec(html)) !== null) {
      const rawTitle = m[2].replace(/\s+/g, ' ').trim()
      const title = rawTitle.split(' - ')[0].trim() || rawTitle
      hits.push({
        path: decodeURIComponent(m[1]),
        title,
        book: m[3].trim(),
        info: m[4].trim(),
      })
    }
  }
  res.render('sok', { config, q, hits, total })
})

app.use('/innehall', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const kiwixPath = req.originalUrl.replace(/^\/innehall/, '/content')
  const kiwixUrl = config.kiwix_base + kiwixPath
  try {
    const response = await fetch(kiwixUrl)
    const ct = response.headers.get('content-type') || ''
    res.status(response.status)
    if (ct.includes('text/html')) {
      let html = await response.text()
      html = html.replace(/href="\/content\//g, 'href="/innehall/')
      html = html.replace(/src="\/content\//g, 'src="/innehall/')
      const banner = `<div id="tnod-banner" style="position:fixed;top:0;left:0;right:0;z-index:999999;background:#1a1a1a;color:#fafafa;padding:0.6rem 1.2rem;font-family:system-ui,sans-serif;font-size:0.9rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);"><span><strong style="font-family:Georgia,serif;">Trygghetsnod</strong> &middot; ${config.kommun}</span><span><a href="/sok" style="color:#fafafa;margin-right:1rem;">Sök</a><a href="/" style="color:#fafafa;">&larr; Portalen</a></span></div><div style="height:2.6rem"></div>`
      html = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`)
      res.type('html').send(html)
    } else {
      res.type(ct)
      const buf = Buffer.from(await response.arrayBuffer())
      res.send(buf)
    }
  } catch (e) {
    res.status(502).send('Kunde inte ladda innehåll: ' + e.message)
  }
})

app.get('/qr.png', async (_req, res) => {
  const config = loadKommunJSON('config.json')
  const wifiString = `WIFI:T:nopass;S:${config.wifi_ssid};;`
  const buf = await QRCode.toBuffer(wifiString, { width: 512, margin: 2 })
  res.type('png').send(buf)
})

app.get('/healthz', (_req, res) => res.json({ ok: true, kommun: KOMMUN }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trygghetsnod-portal igång på :${PORT} (kommun: ${KOMMUN})`)
})
