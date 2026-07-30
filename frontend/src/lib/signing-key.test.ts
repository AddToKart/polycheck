import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @polycheck/shared's createSigningKeyPair
vi.mock('@polycheck/shared', () => ({
  createSigningKeyPair: vi.fn(),
}))

import { createSigningKeyPair } from '@polycheck/shared'
const mockedCreateKeyPair = vi.mocked(createSigningKeyPair)

// ── IndexedDB mock ──────────────────────────────────────────────────────────
// jsdom doesn't provide IndexedDB, so we fake the subset used by signing-key.ts.
// Uses queueMicrotask instead of setTimeout so callbacks fire before the next
// await-point resolves, matching real IDB's async-but-fast semantics.

interface FakeIDBStore {
  [key: string]: unknown
}

let stores: Record<string, FakeIDBStore>

function createFakeIDB() {
  stores = {}

  const open = vi.fn((...openArguments: [string, number]) => {
    void openArguments
    const result = { result: null as any, onsuccess: null as any, onerror: null as any, onupgradeneeded: null as any }

    queueMicrotask(() => {
      // Initialize stores once (first open call); subsequent opens reuse existing data.
      if (!stores['crypto-keys']) stores['crypto-keys'] = {}
      if (!stores['crypto-keys-store']) stores['crypto-keys-store'] = {}

      // Build the database object BEFORE firing callbacks so that
      // opening.result is available inside onupgradeneeded / onsuccess.
      const db = {
        createObjectStore: vi.fn(),
        transaction: (storeName: string, ...transactionArguments: [string?]) => {
          void transactionArguments
          const storeData = stores[storeName] ?? {}
          stores[storeName] = storeData
          let pendingOps = 0
          let onCompleteFn: (() => void) | null = null
          let onErrorFn: ((err: any) => void) | null = null

          const checkComplete = () => {
            pendingOps--
            if (pendingOps <= 0 && onCompleteFn) onCompleteFn()
          }

          const tx = {
            objectStore: (name: string) => {
              const data = stores[name] ?? {}
              stores[name] = data
              return {
                get: (key: string) => {
                  const req = { result: data[key] ?? undefined, onsuccess: null as any, onerror: null as any }
                  pendingOps++
                  queueMicrotask(() => req.onsuccess?.(req))
                  return req
                },
                put: (value: unknown, key: string) => {
                  data[key] = value
                  const req = { result: undefined, onsuccess: null as any, onerror: null as any }
                  pendingOps++
                  queueMicrotask(() => {
                    req.onsuccess?.(req)
                    checkComplete()
                  })
                  return req
                },
                delete: (key: string) => {
                  delete data[key]
                  const req = { result: undefined, onsuccess: null as any, onerror: null as any }
                  pendingOps++
                  queueMicrotask(() => {
                    req.onsuccess?.(req)
                    checkComplete()
                  })
                  return req
                },
              }
            },
            set oncomplete(fn: (() => void) | null) { onCompleteFn = fn },
            get oncomplete() { return onCompleteFn },
            set onerror(fn: any) { onErrorFn = fn },
            get onerror() { return onErrorFn },
            set onabort(fn: any) { onErrorFn = fn },
            get onabort() { return onErrorFn },
          }
          return tx
        },
        close: vi.fn(),
        objectStoreNames: { contains: vi.fn(() => false) },
      }

      // Assign result BEFORE calling callbacks so handlers see opening.result
      result.result = db

      if (result.onupgradeneeded) {
        const event = { target: { result: db } }
        result.onupgradeneeded(event)
      }

      if (result.onsuccess) result.onsuccess()
    })

    return result
  })

  return { open }
}

let fakeIDB: ReturnType<typeof createFakeIDB>

// Replace globalThis.indexedDB with our fake
beforeEach(() => {
  fakeIDB = createFakeIDB()
  Object.defineProperty(globalThis, 'indexedDB', {
    value: { open: fakeIDB.open },
    configurable: true,
  })
  // Always mock crypto.subtle so we don't hit real AES-GCM IV validation in tests.
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: {
      generateKey: vi.fn(async () => ({})),
      encrypt: vi.fn(async (_algo: any, _key: any, data: ArrayBuffer) => {
        // Return a copy of the input as "encrypted" data
        return new Uint8Array(data).buffer
      }),
      decrypt: vi.fn(async (_algo: any, _key: any, data: ArrayBuffer) => {
        // Return the input as "decrypted" data
        return data
      }),
      wrapKey: vi.fn(),
      unwrapKey: vi.fn(),
      exportKey: vi.fn(),
      importKey: vi.fn(async () => ({})),
      deriveBits: vi.fn(),
      deriveKey: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      digest: vi.fn(),
    },
    configurable: true,
  })
})

describe('signing-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset IDB stores
    stores = {}
  })

  it('generates a new key pair on first run', async () => {
    const fakePair = { publicKey: 'pub-new-123', secretKey: 'sec-new-123' }
    mockedCreateKeyPair.mockReturnValue(fakePair as any)

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    const result = await getOrCreateTeacherSigningKey('teacher-1')

    expect(result.publicKey).toBe('pub-new-123')
    expect(result.secretKey).toBe('sec-new-123')
    expect(mockedCreateKeyPair).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('polycheck-teacher-signing-public')).toBeNull()
  })

  it('reads from IndexedDB when key already exists', async () => {
    // Pre-populate IDB with key data by doing a first run
    const fakePair = { publicKey: 'pub-existing', secretKey: 'sec-existing' }
    mockedCreateKeyPair.mockReturnValue(fakePair as any)

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    // First call: generates and stores
    await getOrCreateTeacherSigningKey('teacher-1')

    // Clear mocks to verify second call doesn't re-generate
    mockedCreateKeyPair.mockClear()

    // Second call: should read from IDB
    const result2 = await getOrCreateTeacherSigningKey('teacher-1')
    expect(result2.publicKey).toBe('pub-existing')
    expect(mockedCreateKeyPair).not.toHaveBeenCalled()
  })

  it('rotates unattributed localStorage v2 keys instead of assigning them to an account', async () => {
    const fakePair = { publicKey: 'pub-rotated', secretKey: 'sec-rotated' }
    mockedCreateKeyPair.mockReturnValue(fakePair as any)
    localStorage.setItem('polycheck-teacher-signing-public', 'pub-migrated-v2')
    localStorage.setItem('polycheck-teacher-signing-secret-v2', '{"legacy":true}')

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    const result = await getOrCreateTeacherSigningKey('teacher-1')

    expect(result.publicKey).toBe('pub-rotated')
    expect(localStorage.getItem('polycheck-teacher-signing-secret-v2')).toBeNull()
    expect(localStorage.getItem('polycheck-teacher-signing-public')).toBeNull()
  })

  it('rotates and removes legacy plaintext storage', async () => {
    const fakePair = { publicKey: 'pub-rotated', secretKey: 'sec-rotated' }
    mockedCreateKeyPair.mockReturnValue(fakePair as any)
    localStorage.setItem('polycheck-teacher-signing-public', 'pub-legacy')
    localStorage.setItem('polycheck-teacher-signing-secret', 'legacy-plaintext-secret')

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    const result = await getOrCreateTeacherSigningKey('teacher-1')

    expect(result.publicKey).toBe('pub-rotated')
    expect(result.secretKey).toBe('sec-rotated')
    expect(localStorage.getItem('polycheck-teacher-signing-secret')).toBeNull()
  })

  it('does not store the secret key in localStorage', async () => {
    const fakePair = { publicKey: 'pub-safe', secretKey: 'sec-sensitive' }
    mockedCreateKeyPair.mockReturnValue(fakePair as any)

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    await getOrCreateTeacherSigningKey('teacher-1')

    // The secret key must NOT appear in localStorage
    const allStorage = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n')
    expect(allStorage).not.toContain('sec-sensitive')
  })

  it('stores separate keys for separate teacher accounts', async () => {
    mockedCreateKeyPair
      .mockReturnValueOnce({ publicKey: 'pub-one', secretKey: 'sec-one' } as any)
      .mockReturnValueOnce({ publicKey: 'pub-two', secretKey: 'sec-two' } as any)

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')
    const first = await getOrCreateTeacherSigningKey('teacher-1')
    const second = await getOrCreateTeacherSigningKey('teacher-2')

    expect(first.publicKey).toBe('pub-one')
    expect(second.publicKey).toBe('pub-two')
    expect(stores['crypto-keys']['teacher-signing-public:teacher-1']).toBe('pub-one')
    expect(stores['crypto-keys']['teacher-signing-public:teacher-2']).toBe('pub-two')
  })

  it('fails closed when account key storage is incomplete', async () => {
    stores['crypto-keys'] = { 'teacher-signing-public:teacher-1': 'orphaned-public' }

    const { getOrCreateTeacherSigningKey } = await import('./signing-key')

    await expect(getOrCreateTeacherSigningKey('teacher-1')).rejects.toThrow('storage is incomplete')
  })
})
