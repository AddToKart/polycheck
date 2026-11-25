import type { ImportColumnMapping } from '@polycheck/shared'

/**
 * Remembered column mappings ("learning" without training): after an admin
 * confirms a mapping once, the same header layout maps itself next time. Only
 * header names and column positions are stored — never student data — and only
 * in this browser's localStorage.
 */

const STORAGE_KEY = 'polycheck-import-mapping-profiles-v1'
/** Single-profile key written by earlier versions; still read as a fallback. */
const LEGACY_KEY = 'polycheck-import-mapping'
const MAX_PROFILES = 25

interface StoredProfile {
  fingerprint: string
  headers: string[]
  mapping: ImportColumnMapping
  usedAt: number
}

/** Case-, spacing- and punctuation-insensitive identity of a header layout. */
export function fingerprintHeaders(headers: readonly string[]): string {
  return headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|')
}

function readProfiles(storage: Pick<Storage, 'getItem'>): StoredProfile[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is StoredProfile =>
            Boolean(entry) &&
            typeof (entry as StoredProfile).fingerprint === 'string' &&
            typeof (entry as StoredProfile).mapping === 'object',
        )
      : []
  } catch {
    return []
  }
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The mapping previously confirmed for this header layout, or null. */
export function loadMappingProfile(headers: readonly string[], storage: Storage | null = getStorage()): ImportColumnMapping | null {
  if (!storage || headers.length === 0) return null
  const fingerprint = fingerprintHeaders(headers)
  const match = readProfiles(storage).find((profile) => profile.fingerprint === fingerprint)
  if (match) return match.mapping
  try {
    const legacy = storage.getItem(LEGACY_KEY)
    if (legacy) {
      const stored = JSON.parse(legacy) as { headers?: string[]; mapping?: ImportColumnMapping }
      if (stored.headers && stored.mapping && fingerprintHeaders(stored.headers) === fingerprint) return stored.mapping
    }
  } catch {
    // An unreadable legacy entry is simply ignored.
  }
  return null
}

/** Remember a confirmed mapping (most recently used first, capped). Failures are silent: it is a convenience. */
export function saveMappingProfile(
  headers: readonly string[],
  mapping: ImportColumnMapping,
  storage: Storage | null = getStorage(),
  now = Date.now(),
): void {
  if (!storage || headers.length === 0) return
  const fingerprint = fingerprintHeaders(headers)
  const others = readProfiles(storage).filter((profile) => profile.fingerprint !== fingerprint)
  const next: StoredProfile[] = [{ fingerprint, headers: [...headers], mapping, usedAt: now }, ...others].slice(
    0,
    MAX_PROFILES,
  )
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota or privacy mode: nothing to do.
  }
}
