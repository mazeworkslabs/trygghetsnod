import express from 'express'
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync, statfsSync, appendFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import QRCode from 'qrcode'
import matter from 'gray-matter'
import { marked } from 'marked'
import multer from 'multer'
import sharp from 'sharp'
import cookieParser from 'cookie-parser'
import {
  createForumPool,
  migrateForum,
  listGroups,
  getGroupBySlug,
  listMessages,
  listPosts,
  listReplies,
  getPost,
  postMessage,
  softDeleteMessage,
  toggleReaction,
  createGroup,
  updateGroup,
  deleteGroup,
  getForumMode,
  setForumMode,
  createToken,
  listTokens,
  revokeToken,
  findActiveToken,
  touchToken,
  upsertUser,
  getUser,
  listUsers,
  verifyUser,
  unverifyUser,
  clearUserVerification,
  blockUser,
  unblockUser,
  listMessagesByUser,
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

// PWA service worker med rätt scope-header
app.get('/sw.js', (_req, res) => {
  res.set('Service-Worker-Allowed', '/')
  res.type('application/javascript').sendFile(join(ROOT, 'public', 'sw.js'))
})

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

// Säkerställ att en stabil tnod_uid-cookie finns för varje besökare. Den används
// som primärnyckel i forum_users-tabellen så FRG kan se medborgaren i admin-listan
// och verifiera dem direkt.
app.use((req, res, next) => {
  if (!req.cookies?.tnod_uid) {
    const uid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    res.cookie('tnod_uid', uid, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 })
    req.cookies = req.cookies || {}
    req.cookies.tnod_uid = uid
  }
  next()
})

// Identitet baseras på forum_users-raden för cookie-uid:n. Upsertar varje request
// så last_seen_at uppdateras och FRG ser vem som är aktiv just nu.
app.use(async (req, res, next) => {
  const uid = String(req.cookies?.tnod_uid || '').trim()
  const cookieName = String(req.cookies?.tnod_name || '').trim().slice(0, 60)
  const rawAvatar = String(req.cookies?.tnod_avatar || '').trim()
  const cookieAvatar = /^\/forum-media\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(rawAvatar) ? rawAvatar : ''

  res.locals.viewerUid = uid
  res.locals.viewerName = cookieName
  res.locals.viewerAvatar = cookieAvatar
  res.locals.viewerVerified = false
  res.locals.viewerRole = 'medborgare'

  // Upsertar bara om användaren har valt namn — annars fyller vi tabellen med tomma rader.
  if (uid && cookieName) {
    try {
      const user = await upsertUser(forumPool, {
        uid,
        displayName: cookieName,
        avatarPath: cookieAvatar,
      })
      if (user) {
        res.locals.viewerName = user.display_name || cookieName
        res.locals.viewerAvatar = user.avatar_path || cookieAvatar
        res.locals.viewerVerified = !!user.verified_at
        res.locals.viewerRole = user.role || 'medborgare'
      }
    } catch (e) {
      // Förstör inte requesten om DB är nere — bara logga.
      console.error('forum_users upsert failed:', e.message)
    }
  }
  next()
})

const readDisplayName = (req) =>
  String(req.cookies?.tnod_name || '').trim().slice(0, 60)

const readTokenCookie = (req) => String(req.cookies?.tnod_token || '').trim() || null

const resolveForumIdentity = async (req) => {
  const uid = String(req.cookies?.tnod_uid || '').trim()
  const name = readDisplayName(req)
  if (uid) {
    try {
      const user = await getUser(forumPool, uid)
      if (user) {
        return {
          uid,
          name: user.display_name || name,
          role: user.role || 'medborgare',
          tokenId: null,
          verified: !!user.verified_at,
          blocked: !!user.blocked_at,
        }
      }
    } catch {}
  }
  return {
    uid,
    name,
    role: isLocalRequest(req) ? 'frg' : 'medborgare',
    tokenId: null,
    verified: false,
    blocked: false,
  }
}

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

app.get('/api/admin/about', localOnly, (_req, res) => {
  // applied.json skrivs av apply-update.sh på enheten. Saknas på dev-maskiner;
  // då härleder vi version från git HEAD och ZIM-filsdatum istället.
  const appliedPath = join(STORAGE_DIR, 'applied.json')
  let applied = null
  if (existsSync(appliedPath)) {
    try { applied = JSON.parse(readFileSync(appliedPath, 'utf8')) } catch {}
  }

  let gitSha = null
  let gitDescribe = null
  try { gitSha = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}
  try { gitDescribe = execSync('git describe --tags --always --dirty', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}

  let zims = []
  try {
    zims = readdirSync(ZIM_DIR)
      .filter(f => f.endsWith('.zim'))
      .map(filename => ({
        filename,
        modified: statSync(join(ZIM_DIR, filename)).mtime.toISOString(),
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename))
  } catch {}

  res.json({
    applied,
    live: {
      git_sha: gitSha,
      git_describe: gitDescribe,
      kommun: KOMMUN,
      portal_started_at: new Date(STARTED_AT).toISOString(),
      uptime_seconds: (Date.now() - STARTED_AT) / 1000,
      zims,
    },
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
    image: parsed.data.image ? String(parsed.data.image) : '',
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
  if (article.image) frontmatter.image = article.image
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
    image: String(body.image || '').trim(),
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
    image: String(body.image ?? existing.image ?? '').trim(),
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
  // Admin-SPA är localhost-only — annars kan medborgare ladda HTML+JS från sin telefon.
  // Funktionellt skyddat (alla API-endpoints är localOnly) men exponerar onödigt UI.
  app.use('/admin', localOnly, express.static(ADMIN_DIST, { index: 'index.html' }))
  app.get('/admin/*', localOnly, (_req, res) => {
    res.sendFile(join(ADMIN_DIST, 'index.html'))
  })
} else {
  app.get('/admin', localOnly, (_req, res) => {
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

app.get('/forum', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const groups = await listGroups(forumPool)
  const mode = await getForumMode(forumPool)
  const identity = await resolveForumIdentity(req)
  res.render('forum', { config, groups, mode, identity, formatDate })
})

// OBS: måste ligga före /forum/:slug annars fångas den av slug-routen.
app.get('/forum/token', async (req, res) => {
  const secret = String(req.query.t || '').trim()
  if (!secret) return res.status(400).send('Token saknas')
  const tok = await findActiveToken(forumPool, secret)
  if (!tok) return res.status(404).send('Token är ogiltig eller indragen. Gå till FRG för en ny.')
  res.cookie('tnod_token', secret, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  })
  res.cookie('tnod_name', tok.display_name, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  })
  res.redirect(req.query.redirect && String(req.query.redirect).startsWith('/') ? String(req.query.redirect) : '/forum')
})

// Byte-namn-sidan ska också före slug.
app.get('/forum/namn-byte', (req, res) => {
  const config = loadKommunJSON('config.json')
  res.render('forum-namn', {
    config,
    current: readDisplayName(req),
    redirect: req.query.redirect || '/forum',
  })
})

// /profil — profil-sidan som öppnas från avatar-ikonen i headern.
// För nu en enkel sida med visningsnamn + verifieringsstatus.
// Full profil med avatar-bild + varning vid ändring (#18) byggs i nästa steg.
app.get('/profil', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const identity = await resolveForumIdentity(req)
  res.render('profil', {
    config,
    identity,
    current: identity.name,
    redirect: req.query.redirect || '/',
  })
})

app.get('/forum/:slug', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const group = await getGroupBySlug(forumPool, req.params.slug)
  if (!group) return res.status(404).send('Gruppen finns inte')
  const mode = await getForumMode(forumPool)
  const identity = await resolveForumIdentity(req)
  res.render('forum-grupp', {
    config,
    group,
    mode,
    identity,
    displayName: identity.name,
    formatDate,
  })
})

app.get('/forum/:slug/p/:postId', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const group = await getGroupBySlug(forumPool, req.params.slug)
  if (!group) return res.status(404).send('Gruppen finns inte')
  const post = await getPost(forumPool, Number(req.params.postId))
  if (!post || post.group_id !== group.id) return res.status(404).send('Inlägget finns inte')
  const mode = await getForumMode(forumPool)
  const identity = await resolveForumIdentity(req)
  res.render('forum-post', {
    config,
    group,
    post,
    mode,
    identity,
    displayName: identity.name,
    formatDate,
  })
})

app.get('/api/forum/posts/:id', async (req, res) => {
  try {
    const post = await getPost(forumPool, Number(req.params.id))
    if (!post) return res.status(404).json({ error: 'Inlägget finns inte' })
    res.json({ post })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


// Logga ut: rensa både namn- och token-cookien så användaren tappar verifiering.
app.post('/forum/namn-clear', (req, res) => {
  res.clearCookie('tnod_name')
  res.clearCookie('tnod_token')
  const redir = typeof req.body?.redirect === 'string' ? req.body.redirect : '/'
  res.redirect(redir.startsWith('/') ? redir : '/')
})

app.post('/forum/namn', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).send('Namn krävs')
  // Om användaren är verifierad och byter till annat namn än tokenens — clear:a token.
  // FRG har verifierat en specifik person; ändras namnet är verifieringen ogiltig.
  const secret = String(req.cookies?.tnod_token || '').trim() || null
  if (secret) {
    try {
      const tok = await findActiveToken(forumPool, secret)
      if (tok && tok.display_name !== name) {
        res.clearCookie('tnod_token')
      }
    } catch {}
  }
  res.cookie('tnod_name', name, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  })
  const redir = typeof req.body?.redirect === 'string' ? req.body.redirect : '/forum'
  res.redirect(redir.startsWith('/') ? redir : '/forum')
})

// Stabil per-användare-nyckel för reaktioner. Verifierade FRG/medborgare via token-id;
// övriga via display-name + en cookie för att undvika kollisioner mellan personer
// med samma namn på olika telefoner.
const reactionUserKey = (identity, req) => {
  if (identity.tokenId) return `tok:${identity.tokenId}`
  const cookieUid = String(req.cookies?.tnod_uid || '').slice(0, 64)
  if (cookieUid) return `uid:${cookieUid}:${identity.name}`
  return `name:${identity.name}`
}

const ensureUidCookie = (req, res) => {
  if (!req.cookies?.tnod_uid) {
    const uid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    res.cookie('tnod_uid', uid, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 })
  }
}

// Vägg-vyn: bara top-level-posts med reaktioner och reply_count.
app.get('/api/forum/groups/:id/posts', async (req, res) => {
  try {
    const posts = await listPosts(forumPool, Number(req.params.id))
    res.json({ posts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Kommentarer på en specifik post.
app.get('/api/forum/posts/:id/replies', async (req, res) => {
  try {
    const replies = await listReplies(forumPool, Number(req.params.id))
    res.json({ replies })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Bakåtkompabilitet: gamla messages-endpointen finns kvar för admin-flöden.
app.get('/api/forum/groups/:id/messages', async (req, res) => {
  try {
    const messages = await listMessages(forumPool, Number(req.params.id))
    res.json({ messages })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/forum/groups/:id/messages', async (req, res) => {
  const groupId = Number(req.params.id)
  let groupRow
  try {
    const r = await forumPool.query('SELECT posting_mode FROM forum_groups WHERE id = $1', [groupId])
    groupRow = r.rows[0]
  } catch (e) {
    return res.status(500).json({ error: 'DB-fel' })
  }
  if (!groupRow) return res.status(404).json({ error: 'Gruppen finns inte' })
  const groupMode = groupRow.posting_mode || 'verifierade'
  const identity = await resolveForumIdentity(req)
  if (identity.blocked && !isLocalRequest(req)) {
    return res.status(403).json({ error: 'Du är blockerad från att posta i forumet.' })
  }
  if (groupMode === 'verifierade' && !identity.verified && !isLocalRequest(req)) {
    return res.status(403).json({
      error: 'Bara verifierade kan posta i den här gruppen. Volontärerna på trygghetspunkten kan verifiera dig.',
    })
  }
  if (!identity.name) return res.status(400).json({ error: 'Välj ett visningsnamn först' })
  try {
    // Validera image_path: bara våra egna /forum-media/-URL:er accepteras.
    const rawImage = req.body?.image_path
    const imagePath = (typeof rawImage === 'string' && /^\/forum-media\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(rawImage))
      ? rawImage : null
    const msg = await postMessage(forumPool, {
      groupId: Number(req.params.id),
      authorName: identity.name,
      authorRole: identity.role,
      authorUid: identity.uid,
      tokenId: identity.tokenId,
      body: req.body?.body,
      parentId: req.body?.parent_id ? Number(req.body.parent_id) : null,
      imagePath,
    })
    res.json(msg)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ---- Forum image upload ----
//
// Medborgare kan ladda upp bilder med sina poster. För att skydda disk + integritet:
//   - max 12 MB original (mobilkamera-storlek)
//   - resizas till max 1600px bredd som JPEG q85 (typiskt 100-300 KB)
//   - bara JPEG/PNG/HEIC/WebP accepteras
//   - sparas under storage/forum-images/<datum>/<slug>-<stamp>.jpg

const FORUM_IMAGES_DIR = join(STORAGE_DIR, 'forum-images')

const forumImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.mimetype)
    cb(ok ? null : new Error('Bara bildfiler (jpg, png, webp, heic) tillåtna'), ok)
  },
})

app.post('/api/forum/images', forumImageUpload.single('image'), async (req, res) => {
  const identity = await resolveForumIdentity(req)
  if (!identity.name) return res.status(400).json({ error: 'Välj ett visningsnamn först' })
  if (!req.file) return res.status(400).json({ error: 'Ingen bild' })
  try {
    const day = new Date().toISOString().slice(0, 10)
    const dir = join(FORUM_IMAGES_DIR, day)
    mkdirSync(dir, { recursive: true })
    const slug = slugify(identity.name) || 'bild'
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const filename = `${slug}-${stamp}.jpg`
    const fullPath = join(dir, filename)
    await sharp(req.file.buffer)
      .rotate() // EXIF-orientering — telefonbilder kommer rätt-vägen
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(fullPath)
    const url = `/forum-media/${day}/${filename}`
    res.json({ url })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.use('/forum-media', express.static(FORUM_IMAGES_DIR, { maxAge: '7d' }))

// ---- Profil-avatar ----
//
// Egen avatar för profil-ikonen i headern. Sparas som 400×400 cover-resize JPEG
// under storage/forum-images/avatars/. Cookie 'tnod_avatar' pekar på filen.
//
// Verifieringspolicy: om användaren har en aktiv FRG-token tappar de verifieringen
// när de byter avatar (eller namn). FRG måste utfärda ny token. Detta är medvetet:
// FRG verifierar en specifik person — inte deras avatar/namn-kombination.

const forumAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.mimetype)
    cb(ok ? null : new Error('Bara bildfiler tillåtna (jpg, png, webp, heic)'), ok)
  },
})

app.post('/api/profile/avatar', forumAvatarUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ingen bild' })
  const uid = String(req.cookies?.tnod_uid || '').trim()
  try {
    const dir = join(FORUM_IMAGES_DIR, 'avatars')
    mkdirSync(dir, { recursive: true })
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const filename = `avatar-${stamp}.jpg`
    const fullPath = join(dir, filename)
    await sharp(req.file.buffer)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(fullPath)
    const url = `/forum-media/avatars/${filename}`
    res.cookie('tnod_avatar', url, { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 })
    // Avatar-byte → tappa verifiering (FRG har verifierat den specifika personen,
    // ändras bilden är verifieringen ogiltig).
    let lostVerification = false
    if (uid) {
      const user = await getUser(forumPool, uid)
      if (user?.verified_at) {
        await clearUserVerification(forumPool, uid)
        lostVerification = true
      }
      // Skriv den nya avatarpathen direkt i tabellen så listan i admin har rätt bild.
      await upsertUser(forumPool, { uid, displayName: user?.display_name || '', avatarPath: url })
    }
    res.json({ url, lostVerification })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/profile/avatar/clear', async (req, res) => {
  res.clearCookie('tnod_avatar')
  const uid = String(req.cookies?.tnod_uid || '').trim()
  if (uid) {
    const user = await getUser(forumPool, uid)
    if (user?.verified_at) await clearUserVerification(forumPool, uid)
    await upsertUser(forumPool, { uid, displayName: user?.display_name || '', avatarPath: '' })
  }
  res.json({ ok: true })
})

// JSON-variant av /forum/namn för profil-sidan: stannar kvar med "Sparat"-toast.
// Samma verifierings-policy: ändrat namn → tappa verifieringen (FRG verifierade
// en specifik person, byter de namn är verifieringen ogiltig).
app.post('/api/profile/name', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ error: 'Namn krävs' })
  const uid = String(req.cookies?.tnod_uid || '').trim()
  let lostVerification = false
  if (uid) {
    const user = await getUser(forumPool, uid)
    if (user?.verified_at && user.display_name !== name) {
      await clearUserVerification(forumPool, uid)
      lostVerification = true
    }
    const rawAvatar = String(req.cookies?.tnod_avatar || '').trim()
    const avatar = /^\/forum-media\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(rawAvatar) ? rawAvatar : (user?.avatar_path || '')
    await upsertUser(forumPool, { uid, displayName: name, avatarPath: avatar })
  }
  res.cookie('tnod_name', name, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  })
  res.json({ ok: true, name, lostVerification })
})

// Reaktion: toggle. POST { emoji: "❤" } → returnerar { active: bool }.
app.post('/api/forum/messages/:id/reactions', async (req, res) => {
  const identity = await resolveForumIdentity(req)
  if (!identity.name) return res.status(400).json({ error: 'Välj ett visningsnamn först' })
  if (identity.blocked && !isLocalRequest(req)) {
    return res.status(403).json({ error: 'Du är blockerad från att interagera i forumet.' })
  }
  ensureUidCookie(req, res)
  try {
    const result = await toggleReaction(forumPool, {
      messageId: Number(req.params.id),
      userKey: reactionUserKey(identity, req),
      authorName: identity.name,
      emoji: req.body?.emoji,
    })
    res.json(result)
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

app.get('/api/admin/forum/settings', localOnly, async (_req, res) => {
  const mode = await getForumMode(forumPool)
  res.json({ mode })
})

app.put('/api/admin/forum/settings', localOnly, async (req, res) => {
  const mode = await setForumMode(forumPool, req.body?.mode)
  appendLoggbok({
    type: 'forum',
    title: `Forumläge: ${mode === 'verifierade' ? 'Endast verifierade får posta' : 'Öppet för alla'}`,
    author: req.body?.author || 'FRG',
  })
  res.json({ mode })
})

// Admin: lista alla forum_users (medborgare som varit på enheten). FRG väljer
// person i listan, klickar verifiera. Inga QR-koder, inga tokens.
app.get('/api/admin/forum/users', localOnly, async (_req, res) => {
  try {
    const users = await listUsers(forumPool)
    res.json({ users })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/admin/forum/users/:uid/verify', localOnly, async (req, res) => {
  try {
    const u = await verifyUser(forumPool, req.params.uid, {
      role: req.body?.role,
      verifiedBy: req.body?.verified_by,
    })
    if (!u) return res.status(404).json({ error: 'Användaren finns inte' })
    appendLoggbok({
      type: 'verifiering',
      title: `Verifierade ${u.display_name} (${u.role})`,
      author: u.verified_by || 'FRG',
    })
    res.json(u)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/admin/forum/users/:uid/unverify', localOnly, async (req, res) => {
  try {
    const u = await unverifyUser(forumPool, req.params.uid)
    if (!u) return res.status(404).json({ error: 'Användaren finns inte' })
    appendLoggbok({
      type: 'verifiering',
      title: `Återkallade verifiering för ${u.display_name}`,
      author: req.body?.author || 'FRG',
    })
    res.json(u)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Detalj per användare: profil + alla deras meddelanden.
app.get('/api/admin/forum/users/:uid', localOnly, async (req, res) => {
  try {
    const user = await getUser(forumPool, req.params.uid)
    if (!user) return res.status(404).json({ error: 'Användaren finns inte' })
    const messages = await listMessagesByUser(forumPool, req.params.uid)
    res.json({ user, messages })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/admin/forum/users/:uid/block', localOnly, async (req, res) => {
  try {
    const u = await blockUser(forumPool, req.params.uid, {
      blockedBy: req.body?.blocked_by,
      reason: req.body?.reason,
    })
    if (!u) return res.status(404).json({ error: 'Användaren finns inte' })
    appendLoggbok({
      type: 'block',
      title: `Blockerade ${u.display_name}${u.block_reason ? ': ' + u.block_reason : ''}`,
      author: u.blocked_by || 'FRG',
    })
    res.json(u)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/admin/forum/users/:uid/unblock', localOnly, async (req, res) => {
  try {
    const u = await unblockUser(forumPool, req.params.uid)
    if (!u) return res.status(404).json({ error: 'Användaren finns inte' })
    appendLoggbok({
      type: 'block',
      title: `Återkallade blockering för ${u.display_name}`,
      author: req.body?.author || 'FRG',
    })
    res.json(u)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/admin/forum/tokens', localOnly, async (_req, res) => {
  const tokens = await listTokens(forumPool)
  res.json({ tokens })
})

app.post('/api/admin/forum/tokens', localOnly, async (req, res) => {
  try {
    const token = await createToken(forumPool, {
      displayName: req.body?.display_name,
      role: req.body?.role,
      issuedBy: req.body?.issued_by,
    })
    appendLoggbok({
      type: 'forum',
      title: `Token utställd till "${token.display_name}" (${token.role})`,
      author: token.issued_by,
    })
    res.json(token)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/admin/forum/tokens/:id', localOnly, async (req, res) => {
  await revokeToken(forumPool, Number(req.params.id))
  appendLoggbok({
    type: 'forum',
    title: `Token återkallad (#${req.params.id})`,
    author: req.body?.author || 'FRG',
  })
  res.json({ ok: true })
})

// QR-kod som PNG för en token — admin visar upp den för medborgaren att scanna.
app.get('/api/admin/forum/tokens/:id/qr', localOnly, async (req, res) => {
  const tokens = await listTokens(forumPool)
  const tok = tokens.find(t => t.id === Number(req.params.id))
  if (!tok) return res.status(404).json({ error: 'hittades inte' })
  const base = String(req.query.host || '').trim() || `http://${req.hostname}:${PORT}`
  const url = `${base}/forum/token?t=${encodeURIComponent(tok.token_secret)}`
  const buf = await QRCode.toBuffer(url, { width: 420, margin: 2, errorCorrectionLevel: 'M' })
  res.type('png').send(buf)
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

// CSP som blockerar externa nätverksanrop (tracking, externa CDN m.m.).
// Inline-scripts och eval tillåts eftersom de scrapade sajterna behöver det,
// men allt nätverksanrop tvingas till samma origin = portalen själv.
const SAFE_CSP =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
  "connect-src 'self'; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' data:; " +
  "frame-src 'none'; " +
  "object-src 'none'"

// Trygghetsnod är en publik kiosk på lokalt wifi. Vi vill aldrig:
//   - att en scrapad sajt sätter cookies eller läser localStorage
//   - att medborgaren får en cookie-banner att klicka på (meningslös här)
//   - att data läcker till externa servrar (separat löst via CSP)
//
// CSS:en täcker välkända selektorer. JS:en täcker resten genom att
// (1) neutralisera cookie/storage-API:erna, och
// (2) köra en MutationObserver som döljer fixed/modal-overlays vars text
//     handlar om cookies/kakor/consent — oavsett vilken sajt vi scrapar.
const HIDE_COOKIE_BANNERS_CSS = `
<style id="tnod-cookie-shield">
  /* Kända ramverk — snabbväg utan att vänta på MutationObserver. */
  dialog.sv-cookie-consent-modal,
  div[id="Cookiebanner"],
  .sv-marketplace-sitevision-cookie-consent,
  [class*="cookie-banner"], [class*="cookie-consent"], [class*="cookie-notice"],
  [id*="cookie-banner"], [id*="cookie-consent"], [id*="cookie-notice"],
  [class*="CookieBanner"], [class*="CookieConsent"],
  .cmplz-cookiebanner, #onetrust-banner-sdk, .ot-sdk-container,
  #CybotCookiebotDialog, #cookiebanner, .cc-window, .cookie-law-info-bar,
  [aria-label*="cookie" i], [aria-label*="kakor" i], [aria-label*="consent" i] {
    display: none !important;
  }
  /* Återställ scroll-lås som vissa banners sätter på body. */
  html, body { overflow: auto !important; }
</style>`

// Körs överst i <head>, före allt sajt-eget JS. Tar bort cookie/storage-API:t
// och döljer cookie-relaterade overlays som dyker upp dynamiskt.
const COOKIE_SHIELD_JS = `
<script id="tnod-cookie-shield-js">(function () {
  // 1) Cookies kan inte skrivas eller läsas. Sajter som testar consent-cookies
  //    får tomma svar och faller tillbaka till "no consent" — kombinerat med
  //    CSS:en betyder det att bannern aldrig syns.
  try {
    Object.defineProperty(document, 'cookie', {
      get: function () { return '' },
      set: function () { return true },
      configurable: false,
    })
  } catch (e) {}

  // 2) localStorage/sessionStorage neutraliseras (många banners använder dem).
  var noopStorage = {
    getItem: function () { return null },
    setItem: function () {},
    removeItem: function () {},
    clear: function () {},
    key: function () { return null },
    length: 0,
  }
  try { Object.defineProperty(window, 'localStorage',  { value: noopStorage, configurable: false }) } catch (e) {}
  try { Object.defineProperty(window, 'sessionStorage', { value: noopStorage, configurable: false }) } catch (e) {}

  // 3) Generisk overlay-städare. Söker efter top-level fixed/sticky-element
  //    vars textinnehåll handlar om cookies — det är så banners ser ut oavsett
  //    bibliotek. Körs vid varje DOM-mutation och stannar efter 30 s.
  var TEXT_RE = /\\b(cookie|cookies|kakor|samtycke|consent|gdpr)\\b/i
  function looksLikeBanner(el) {
    if (!el || el.nodeType !== 1) return false
    var text = (el.textContent || '').slice(0, 600)
    if (!TEXT_RE.test(text)) return false
    var s = getComputedStyle(el)
    if (s.position !== 'fixed' && s.position !== 'sticky' && el.tagName !== 'DIALOG') return false
    var rect = el.getBoundingClientRect()
    if (rect.width < 200 || rect.height < 60) return false
    return true
  }
  function sweep() {
    var nodes = document.body ? document.body.querySelectorAll('div, section, aside, dialog, nav') : []
    for (var i = 0; i < nodes.length; i++) {
      if (looksLikeBanner(nodes[i])) {
        nodes[i].style.setProperty('display', 'none', 'important')
      }
    }
  }
  function start() {
    sweep()
    var mo = new MutationObserver(sweep)
    if (document.body) mo.observe(document.body, { childList: true, subtree: true })
    setTimeout(function () { mo.disconnect() }, 30000)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})();</script>`

app.use('/innehall', async (req, res) => {
  const config = loadKommunJSON('config.json')
  const kiwixPath = req.originalUrl.replace(/^\/innehall/, '/content')
  const kiwixUrl = config.kiwix_base + kiwixPath
  try {
    // Vi måste hantera Kiwix:s redirects manuellt — om vi följer dem tyst (default)
    // serveras slutsvaret under den ursprungliga URL:en, vilket bryter relativa
    // länkar (CSS/JS) eftersom browserns base path inte stämmer med ZIM-strukturen.
    const response = await fetch(kiwixUrl, { redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location')
      if (loc) {
        const rewritten = loc.startsWith('/content/')
          ? loc.replace(/^\/content\//, '/innehall/')
          : loc
        return res.redirect(response.status, rewritten)
      }
    }
    const ct = response.headers.get('content-type') || ''
    res.status(response.status)
    if (ct.includes('text/html')) {
      let html = await response.text()
      html = html.replace(/href="\/content\//g, 'href="/innehall/')
      html = html.replace(/src="\/content\//g, 'src="/innehall/')
      const banner = `<div id="tnod-banner" style="position:fixed;top:0;left:0;right:0;z-index:999999;background:#1a1a1a;color:#fafafa;padding:0.6rem 1.2rem;font-family:system-ui,sans-serif;font-size:0.9rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);"><span><strong style="font-family:Georgia,serif;">Trygghetsnod</strong> &middot; ${config.kommun}</span><span><a href="/sok" style="color:#fafafa;margin-right:1rem;">Sök</a><a href="/" style="color:#fafafa;">&larr; Portalen</a></span></div><div style="height:2.6rem"></div>`
      html = html.replace(/<head([^>]*)>/i, `<head$1>${COOKIE_SHIELD_JS}${HIDE_COOKIE_BANNERS_CSS}`)
      html = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`)
      res.set('Content-Security-Policy', SAFE_CSP)
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

// Generisk QR-generator för admin (verktyg-sida). text + valfri size + ec.
app.get('/api/admin/qr.png', localOnly, async (req, res) => {
  const text = String(req.query.text || '').slice(0, 2000)
  if (!text) return res.status(400).type('text/plain').send('text-parameter krävs')
  const size = Math.min(Math.max(Number(req.query.size) || 512, 100), 1200)
  const ec = ['L', 'M', 'Q', 'H'].includes(String(req.query.ec)) ? String(req.query.ec) : 'M'
  try {
    const buf = await QRCode.toBuffer(text, { width: size, margin: 2, errorCorrectionLevel: ec })
    res.set('Cache-Control', 'no-store')
    res.type('png').send(buf)
  } catch (e) {
    res.status(400).type('text/plain').send(e.message)
  }
})

app.get('/healthz', (_req, res) => res.json({ ok: true, kommun: KOMMUN }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trygghetsnod-portal igång på :${PORT} (kommun: ${KOMMUN})`)
})
