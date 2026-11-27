import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs with the frontend package as its cwd; `import.meta.url` is a
// jsdom http URL, so the public asset is resolved from the working directory.
const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

type Listener = (event: unknown) => void

interface Entry {
  url: string
  body?: string
}

interface WorkerHarness {
  listeners: Map<string, Listener[]>
  opened: string[]
  deleted: string[]
  fetchCalls: string[]
  /** Per-cache-name entry list, so put/delete/keys/match are assertable. */
  caches: Map<string, Entry[]>
}

/** Loads `public/sw.js` with a fake worker global scope. */
function bootWorker(): WorkerHarness {
  const listeners = new Map<string, Listener[]>()
  const opened: string[] = []
  const deleted: string[] = []
  const fetchCalls: string[] = []
  const cacheStore = new Map<string, Entry[]>()

  function cacheFor(name: string) {
    if (!cacheStore.has(name)) cacheStore.set(name, [])
    return cacheStore.get(name)!
  }

  const cacheStub = {
    open: async (name: string) => {
      opened.push(name)
      const entries = cacheFor(name)
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls) entries.push({ url })
        },
        put: async (request: Request, response: Response) => {
          const body = await response.text().catch(() => '')
          entries.push({ url: String(request.url), body })
        },
        match: async (request: Request | string) => {
          const url = typeof request === 'string' ? request : String(request.url)
          const found = entries.find((entry) => entry.url === url)
          return found ? new Response(found.body ?? '') : undefined
        },
        keys: async () =>
          cacheFor(name).map(
            (entry) => ({ url: entry.url }) as unknown as Request,
          ),
        delete: async (request: Request | string) => {
          const url = typeof request === 'string' ? request : String(request.url)
          const entries = cacheFor(name)
          const index = entries.findIndex((entry) => entry.url === url)
          if (index >= 0) {
            entries.splice(index, 1)
            return true
          }
          return false
        },
      }
    },
    keys: async () => [...cacheStore.keys()],
    match: async () => undefined,
    delete: async (name: string) => {
      deleted.push(name)
      cacheStore.delete(name)
      return true
    },
  }

  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    location: { origin: 'https://polycheck.test' },
  }

  const fetchStub = async (request: Request) => {
    fetchCalls.push(String(request.url))
    return new Response('<html>app</html>', { status: 200 })
  }

  new Function('self', 'caches', 'fetch', source)(self, cacheStub, fetchStub)
  return { listeners, opened, deleted, fetchCalls, caches: cacheStore }
}

/**
 * The worker returns the network response before its fire-and-forget
 * `cache.put` settles (same as the previous behaviour), so assertions on cache
 * contents must let that write complete first.
 */
function settleCacheWrites(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function dispatch(worker: WorkerHarness, type: string, event: unknown) {
  for (const listener of worker.listeners.get(type) ?? []) listener(event)
}

function fetchEvent(request: Request) {
  const waits: Promise<unknown>[] = []
  let response: Promise<Response> | undefined
  const event = {
    request,
    respondWith: (value: Promise<Response>) => {
      response = value
    },
    waitUntil: (promise: Promise<unknown>) => waits.push(promise),
  }
  return { event, get response() { return response }, waits }
}

/**
 * A navigation-shaped request. `new Request(url, { mode: 'navigate' })` is not
 * constructible outside a real navigation, so the worker only needs a request
 * whose `mode`/`destination`/`method`/`headers`/`url` look like a document load
 * (the fake cache and fetch stubs read `url` only).
 */
function documentRequest(url: string, headers: Record<string, string> = {}): Request {
  const base = new Request(url, { headers })
  return {
    url: base.url,
    method: 'GET',
    mode: 'navigate',
    destination: 'document',
    headers: base.headers,
  } as unknown as Request
}

describe('service worker cache policy', () => {
  it('never allowlists authenticated PII prefixes for API caching', () => {
    expect(source).not.toMatch(/['"]\/api\/(users|attendance|dashboard)['"]/)
    expect(source).toContain("'/api/health'")
    expect(source).toContain('requestCarriesCredentials')
  })

  it('answers CLEAR_API_CACHE by deleting the API cache', async () => {
    const worker = bootWorker()
    const waits: Promise<unknown>[] = []

    dispatch(worker, 'message', {
      data: { type: 'CLEAR_API_CACHE' },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    })
    await Promise.all(waits)

    expect(worker.deleted.filter((name) => name.endsWith('-api'))).toHaveLength(1)
  })

  it('routes API reads through the credential guard', () => {
    expect(source).toContain("type === 'SKIP_WAITING'")
    expect(source).toContain('isCacheableApiRead(request, url.pathname)')
  })

  // ── WEB-09: authenticated documents must never enter the shell cache ─────

  it('does not cache a credentialed (cookie-carrying) app document', async () => {
    const worker = bootWorker()
    const request = documentRequest('https://polycheck.test/faculty/dashboard', {
      cookie: 'better-auth.session_token=abc',
    })
    const { event, response } = fetchEvent(request)
    dispatch(worker, 'fetch', event)
    await response

    const shell = worker.caches.get('polycheck-v4-shell') ?? []
    expect(shell.some((entry) => entry.url.includes('/faculty/dashboard'))).toBe(false)
    expect(worker.fetchCalls).toContain('https://polycheck.test/faculty/dashboard')
  })

  it('does not cache an app route document even without an explicit cookie header', async () => {
    const worker = bootWorker()
    // Browsers omit `Cookie` from request headers in production (forbidden
    // header), so auth-route detection must not depend on it alone.
    const request = documentRequest('https://polycheck.test/student/dashboard')
    const { event, response } = fetchEvent(request)
    dispatch(worker, 'fetch', event)
    await response

    const shell = worker.caches.get('polycheck-v4-shell') ?? []
    expect(shell.some((entry) => entry.url.includes('/student/dashboard'))).toBe(false)
  })

  it('still caches public documents and static assets (offline shell preserved)', async () => {
    const worker = bootWorker()
    const publicRequest = documentRequest('https://polycheck.test/login')
    const { event, response } = fetchEvent(publicRequest)
    dispatch(worker, 'fetch', event)
    await response
    await settleCacheWrites()

    const shell = worker.caches.get('polycheck-v4-shell') ?? []
    expect(shell.some((entry) => entry.url.endsWith('/login'))).toBe(true)

    const iconRequest = new Request('https://polycheck.test/icons/icon-192.png')
    const iconEvent = fetchEvent(iconRequest as unknown as Request)
    dispatch(worker, 'fetch', iconEvent.event)
    await iconEvent.response
    await settleCacheWrites()
    expect(
      (worker.caches.get('polycheck-v4-shell') ?? []).some((entry) =>
        entry.url.endsWith('/icons/icon-192.png'),
      ),
    ).toBe(true)
  })

  it('CLEAR_API_CACHE also purges cached documents but keeps precached assets', async () => {
    const worker = bootWorker()
    // Write a legacy authenticated document into the shell cache plus the
    // precache markers that must survive.
    const shell = worker.caches.get('polycheck-v4-shell') ?? []
    worker.caches.set('polycheck-v4-shell', shell)
    shell.push(
      { url: 'https://polycheck.test/faculty/users' },
      { url: 'https://polycheck.test/icons/icon-192.png' },
      { url: 'https://polycheck.test/offline' },
    )

    const waits: Promise<unknown>[] = []
    dispatch(worker, 'message', {
      data: { type: 'CLEAR_API_CACHE' },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    })
    await Promise.all(waits)

    const remaining = worker.caches.get('polycheck-v4-shell') ?? []
    expect(remaining.some((entry) => entry.url.endsWith('/faculty/users'))).toBe(false)
    expect(remaining.some((entry) => entry.url.endsWith('/icons/icon-192.png'))).toBe(true)
    expect(remaining.some((entry) => entry.url.endsWith('/offline'))).toBe(true)
  })

  it('keeps immutable /_next/static and font assets through the clear (static caching unchanged)', async () => {
    const worker = bootWorker()
    const shell = worker.caches.get('polycheck-v4-shell') ?? []
    worker.caches.set('polycheck-v4-shell', shell)
    shell.push(
      { url: 'https://polycheck.test/_next/static/chunks/app.js' },
      { url: 'https://polycheck.test/fonts/dm-sans.woff2' },
      { url: 'https://polycheck.test/brand-mark.png' },
      { url: 'https://polycheck.test/faculty/sessions/sess-1' },
    )

    const waits: Promise<unknown>[] = []
    dispatch(worker, 'message', {
      data: { type: 'CLEAR_API_CACHE' },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    })
    await Promise.all(waits)

    const remaining = worker.caches.get('polycheck-v4-shell') ?? []
    expect(remaining.some((entry) => entry.url.endsWith('/_next/static/chunks/app.js'))).toBe(true)
    expect(remaining.some((entry) => entry.url.endsWith('/fonts/dm-sans.woff2'))).toBe(true)
    expect(remaining.some((entry) => entry.url.endsWith('/brand-mark.png'))).toBe(true)
    // Only the app-route document is purged.
    expect(remaining.some((entry) => entry.url.includes('/faculty/sessions/'))).toBe(false)
  })

  it('bumps the cache version so older unsafe files are purged on activate', () => {
    // The document-caching fix requires a version bump; a stale v2 shell would
    // keep serving cached authenticated HTML.
    expect(source).toContain("const VERSION = 'polycheck-v4'")
  })

  it('leaves the /api/health read behaviour unchanged', () => {
    // The only cacheable API prefix is still the credential-free health probe.
    expect(source).toContain("const API_READ_PREFIXES = ['/api/health']")
    expect(source).toContain("const API_SAFE_CACHE_PREFIXES = ['/api/health']")
  })
})
