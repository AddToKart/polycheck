/* Polycheck service worker (offline-first web, M1).
 *
 * Hand-rolled instead of a build-time SW plugin: Next 16 + Turbopack does not
 * need to participate in caching, and this file stays auditable. Bump VERSION
 * whenever the caching policy changes so clients replace old caches.
 *
 * Policy:
 * - App shell (document navigations): network-first, cached per URL — but ONLY
 *   for unauthenticated/static routes. Any document request that could carry a
 *   session cookie (or is served from an app route with an auth gate) is never
 *   stored: the Cache API is keyed by URL alone and ignores the cookie, so a
 *   cached dashboard HTML would be handed to the next account on this device.
 * - Immutable assets (/_next/static, icons, fonts): cache-first.
 * - Public, credential-free API reads (the `/health` probe only): network-first
 *   with timeout -> cache.
 * - Everything else under /api, API auth routes, writes (non-GET) and
 *   Socket.IO: never intercepted and never cached.
 * - VERSION bumped to v3: authenticated app-route documents are no longer
 *   cached, and CLEAR_API_CACHE now also purges cached documents.
 * - VERSION bumped to v2 for the PII purge: v1 caches (which held authenticated
 *   /api/users, /api/attendance and /api/dashboard bodies keyed by URL only)
 *   are deleted on activate.
 *
 * IndexedDB is the only offline data store: it is encrypted and owner-scoped,
 * while the Cache API is keyed by URL alone and ignores the session cookie. A
 * cached authenticated body would therefore be served to whichever account
 * opens the browser next — which is why no authenticated read may be cached.
 */
const VERSION = 'polycheck-v3'
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

const API_READ_PREFIXES = ['/api/health']
// Responses under these prefixes carry no account data, so they may be cached
// even when the request was credentialed. Everything else must stay out.
const API_SAFE_CACHE_PREFIXES = ['/api/health']
const API_NEVER_CACHE = ['/api/auth']
const API_READ_TIMEOUT_MS = 4000

// Routes whose document HTML is public (login/landing/offline). Everything
// else in the Next app is behind an auth gate, so its HTML must never enter
// the URL-keyed shell cache. Kept as a prefix list because the worker cannot
// know a session's state.
const PUBLIC_DOCUMENT_PREFIXES = ['/login', '/offline', '/_next/']
const PUBLIC_DOCUMENT_PATHS = ['/']

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
  const type = event.data && event.data.type
  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (type === 'CLEAR_API_CACHE') {
    // Sent by the client on logout and account switch (see register-sw.ts).
    // WEB-09: cached documents are account data too, so the shell cache's
    // document entries are purged alongside the API bodies. Precache entries
    // and immutable assets stay (they carry no account data).
    event.waitUntil(
      Promise.all([caches.delete(API_CACHE), clearShellDocuments()]),
    )
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

  if (isCacheableApiRead(request, url.pathname)) {
    event.respondWith(networkFirstApi(request))
  }
})

function isApiRead(pathname) {
  if (API_NEVER_CACHE.some((prefix) => pathname.startsWith(prefix))) return false
  return API_READ_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * A credentialed request (Authorization header, or cross-origin) may only reach
 * the cache for the explicitly safe, account-free prefixes.
 */
function requestCarriesCredentials(request) {
  if (request.headers.get('authorization')) return true
  return new URL(request.url).origin !== self.location.origin
}

function isCacheableApiRead(request, pathname) {
  if (!isApiRead(pathname)) return false
  if (!requestCarriesCredentials(request)) return true
  return API_SAFE_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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

/** A document navigation that may be served from an account-scoped shell. */
function isCacheableDocument(request, pathname) {
  if (requestCarriesCredentials(request)) return false
  if (PUBLIC_DOCUMENT_PATHS.includes(pathname)) return true
  return PUBLIC_DOCUMENT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Removes cached document HTML from the shell cache while keeping the precached
 * offline shell and every immutable asset (static assets caching is unchanged
 * by WEB-09). `cache.keys()` exposes each entry's request; the stored
 * `Request.destination` is not reliably serialized, so match by the same
 * public-route + asset rules the write paths use: anything that is neither a
 * precache entry nor an immutable asset is account-scoped document HTML.
 */
async function clearShellDocuments() {
  try {
    const cache = await caches.open(SHELL_CACHE)
    const requests = await cache.keys()
    await Promise.all(
      requests
        .filter((request) => {
          let pathname
          try {
            pathname = new URL(request.url).pathname
          } catch {
            return true
          }
          if (PRECACHE_URLS.includes(pathname)) return false
          if (pathname.startsWith('/_next/static/')) return false
          if (pathname.startsWith('/icons/') || pathname.startsWith('/fonts/')) return false
          if (pathname === '/pup-logo.png') return false
          return true
        })
        .map((request) => cache.delete(request)),
    )
  } catch {
    // A cache miss/failure must never block sign-out.
  }
}

async function handleNavigation(request) {
  const url = new URL(request.url)
  const cacheable = isCacheableDocument(request, url.pathname)
  const cache = cacheable ? await caches.open(SHELL_CACHE) : null
  try {
    const response = await fetch(request)
    if (cache && response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = cache ? await cache.match(request) : await caches.match(request)
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
