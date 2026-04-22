// Minimal service worker — ger PWA-installation och offline-läs för publikt skal.
// Cacha skal-sidor och statiska assets. Forum-API-anrop går alltid till nätverk.

const CACHE = 'trygghetsnod-shell-v1'
const SHELL = [
  '/',
  '/forum',
  '/style.css',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Låt API och forum-meddelanden gå rakt till nätet — de måste vara färska.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/innehall/')) return

  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((hit) => {
      const fetched = fetch(event.request)
        .then((r) => {
          if (r && r.ok) caches.open(CACHE).then((c) => c.put(event.request, r.clone()))
          return r
        })
        .catch(() => hit)
      return hit || fetched
    })
  )
})
