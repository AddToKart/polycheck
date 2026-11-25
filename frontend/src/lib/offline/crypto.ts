import type { IDBPDatabase } from 'idb'
import { getOfflineDatabase, type EncryptedEnvelope, type PolycheckOfflineDB } from './db'

/**
 * Web equivalent of the mobile encrypted offline store's crypto layer:
 * per-account AES-GCM keys, non-extractable where the browser allows storing
 * CryptoKey objects in IndexedDB. Legacy/partial implementations fall back to
 * storing raw key bytes, which preserves at-rest encryption across reloads.
 */

/**
 * WEB-01: `getOrCreateUserKey` is get→generate→put. Two cache groups written
 * concurrently on a cold start both observed "no key" and generated separate
 * AES keys; the last writer won, so the losing group's ciphertext became
 * permanently undecryptable. One in-flight creation promise per owner removes
 * the race (and a failed attempt is evicted so a later write can retry).
 */
const userKeyPromises = new Map<string, Promise<CryptoKey>>()

/** Drops an owner's memoized key: its persisted key row is being deleted. */
export function forgetUserKey(ownerId: string): void {
  userKeyPromises.delete(ownerId)
}

/** Drops every memoized key after the encrypted stores were wiped. */
export function resetUserKeyCache(): void {
  userKeyPromises.clear()
}

/**
 * Seeds the per-account key before any cache write so the first write of a
 * fresh account cannot race another one. Safe to call repeatedly: an existing
 * key (CryptoKey or raw fallback) is reused, never regenerated.
 */
export async function seedUserKey(ownerId: string): Promise<void> {
  const db = await getOfflineDatabase()
  await getOrCreateUserKey(db, ownerId)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function importRawKey(rawKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(rawKey), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export function getOrCreateUserKey(
  db: IDBPDatabase<PolycheckOfflineDB>,
  ownerId: string,
): Promise<CryptoKey> {
  const inFlight = userKeyPromises.get(ownerId)
  if (inFlight) return inFlight
  const creation = createOrLoadUserKey(db, ownerId).catch((error: unknown) => {
    // Never memoize a failure: the next write may succeed (transient IDB error).
    userKeyPromises.delete(ownerId)
    throw error
  })
  userKeyPromises.set(ownerId, creation)
  return creation
}

async function createOrLoadUserKey(
  db: IDBPDatabase<PolycheckOfflineDB>,
  ownerId: string,
): Promise<CryptoKey> {
  const existing = await db.get('crypto_keys', ownerId)
  if (existing?.key) return existing.key
  if (existing?.rawKey) return importRawKey(existing.rawKey)

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  try {
    await db.put('crypto_keys', { ownerId, key, createdAt: new Date().toISOString() })
    return key
  } catch {
    // Some engines cannot structured-clone CryptoKey into IndexedDB. Import a
    // non-extractable key from persisted raw bytes instead (same at-rest story).
    const extractable = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ])
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', extractable))
    await db.put('crypto_keys', {
      ownerId,
      rawKey: toBase64(raw),
      createdAt: new Date().toISOString(),
    })
    return importRawKey(toBase64(raw))
  }
}

export async function encryptValue(
  db: IDBPDatabase<PolycheckOfflineDB>,
  ownerId: string,
  value: unknown,
): Promise<EncryptedEnvelope> {
  const key = await getOrCreateUserKey(db, ownerId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new Uint8Array(new TextEncoder().encode(JSON.stringify(value)))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  )
  return { v: 1, iv: toBase64(iv), data: toBase64(ciphertext) }
}

export async function decryptValue<T>(
  db: IDBPDatabase<PolycheckOfflineDB>,
  ownerId: string,
  envelope: EncryptedEnvelope,
): Promise<T> {
  const key = await getOrCreateUserKey(db, ownerId)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.data),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
