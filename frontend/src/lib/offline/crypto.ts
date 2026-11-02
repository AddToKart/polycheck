import type { IDBPDatabase } from 'idb'
import type { EncryptedEnvelope, PolycheckOfflineDB } from './db'

/**
 * Web equivalent of the mobile encrypted offline store's crypto layer:
 * per-account AES-GCM keys, non-extractable where the browser allows storing
 * CryptoKey objects in IndexedDB. Legacy/partial implementations fall back to
 * storing raw key bytes, which preserves at-rest encryption across reloads.
 */

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

export async function getOrCreateUserKey(
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
