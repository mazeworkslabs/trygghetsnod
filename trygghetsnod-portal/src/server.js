import express from 'express'
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync, statfsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

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

const loadKommunJSON = (name) => JSON.parse(readFileSync(join(KOMMUN_DIR, name), 'utf8'))
const saveKommunJSON = (name, data) => writeFileSync(join(KOMMUN_DIR, name), JSON.stringify(data, null, 2))

const SEVERITIES = {
  info: { label: 'Information', tone: 'info' },
  warning: { label: 'Varning', tone: 'warning' },
  emergency: { label: 'Nödläge', tone: 'emergency' },
}

const formatDate = (iso) => {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const localOnly = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || ''
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  if (!isLocal) {
    return res.status(403).type('text/plain').send(
      'CMS är endast tillgängligt från enheten själv (localhost).\n' +
      'Använd http://localhost:' + PORT + '/cms direkt på Trygghetsnod-enheten.'
    )
  }
  next()
}

app.get('/', (_req, res) => {
  const config = loadKommunJSON('config.json')
  const update = loadKommunJSON('update.json')
  res.render('index', { config, update, sev: SEVERITIES[update.severity], formatDate })
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
  res.json(update)
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
