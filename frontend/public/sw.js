/* Polycheck service worker (offline-first web, M1).
 *
 * Hand-rolled instead of a build-time SW plugin: Next 16 + Turbopack does not
 * need to participate in caching, and this file stays auditable. Bump VERSION
 * whenever the caching policy changes so clients replace old caches.
 *
 * Policy:
 * - App shell (document navigations): network-first, cached per URL.
 * - Immutable assets (/_next/static, icons, fonts): cache-first.
 * - Allowlisted API GET reads: network-first with timeout -> cache.
 * - API auth routes, writes (non-GET) and Socket.IO: never intercepted.
 * - The SW never sees credentials/tokens beyond opaque request headers it
 *   forwards; nothing from localStorage or IndexedDB is cached here.
 */
const VERSION = 'polycheck-v1'
const SHELL_CACHE = `${VERSION}-shell`
const API_CACHE = `${VERSION}-api`
const OFFLINE_URL = '/offline'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.webmanifest',
]

const API_READ_PREFIXES = [
  '/api/sessions',
  '/api/sections',
  '/api/subjects',
  '/api/users',
  '/api/students',
  '/api/dashboard',
  '/api/health',
  '/api/attendance',
]
const API_NEVER_CACHE = ['/api/auth']
const API_READ_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.pathname.startsWith('/socket.io')) return

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/pup-logo.png'
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (isApiRead(url.pathname)) {
    event.respondWith(networkFirstApi(request))
  }
})

function isApiRead(pathname) {
  if (API_NEVER_CACHE.some((prefix) => pathname.startsWith(prefix))) return false
  return API_READ_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(SHELL_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_READ_TIMEOUT_MS)
  try {
    const response = await fetch(request, { signal: controller.signal })
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return Response.error()
  } finally {
    clearTimeout(timer)
  }
}
