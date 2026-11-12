import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs with the frontend package as its cwd; `import.meta.url` is a
// jsdom http URL, so the public asset is resolved from the working directory.
const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

type Listener = (event: unknown) => void

interface WorkerHarness {
  listeners: Map<string, Listener[]>
  opened: string[]
  deleted: string[]
  fetchCalls: string[]
}

/** Loads `public/sw.js` with a fake worker global scope. */
function bootWorker(): WorkerHarness {
  const listeners = new Map<string, Listener[]>()
  const opened: string[] = []
  const deleted: string[] = []
  const fetchCalls: string[] = []

  const cacheStub = {
    open: async (name: string) => {
      opened.push(name)
      return {
        addAll: async () => undefined,
        put: async () => undefined,
        match: async () => undefined,
      }
    },
    keys: async () => [] as string[],
    match: async () => undefined,
    delete: async (name: string) => {
      deleted.push(name)
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
    return new Response(null, { status: 200 })
  }

  new Function('self', 'caches', 'fetch', source)(self, cacheStub, fetchStub)
  return { listeners, opened, deleted, fetchCalls }
}

function dispatch(worker: WorkerHarness, type: string, event: unknown) {
  for (const listener of worker.listeners.get(type) ?? []) listener(event)
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
})
