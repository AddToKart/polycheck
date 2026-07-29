import { createSigningKeyPair } from '@polycheck/shared'

const LEGACY_PRIVATE_KEY = 'polycheck-teacher-signing-secret'
const ENCRYPTED_PRIVATE_KEY = 'polycheck-teacher-signing-secret-v2'
const PUBLIC_KEY = 'polycheck-teacher-signing-public'
const DATABASE = 'polycheck-keys'
const STORE = 'crypto-keys'
const WRAPPING_KEY = 'teacher-signing-key-wrapper'
const IDB_ENCRYPTED_KEY = 'teacher-signing-encrypted-secret'
const IDB_PUBLIC_KEY = 'teacher-signing-public'

type EncryptedSecret = { iv: string; ciphertext: string }

export async function getOrCreateTeacherSigningKey() {
  // 1. Try IndexedDB first (secure storage — XSS cannot easily exfiltrate).
  const idbEncrypted = await idbGet<EncryptedSecret>(IDB_ENCRYPTED_KEY)
  const idbPublic = await idbGet<string>(IDB_PUBLIC_KEY)
  if (idbEncrypted && idbPublic) {
    // One-time migration: copy public key to localStorage for quick access by other modules.
    if (!localStorage.getItem(PUBLIC_KEY)) localStorage.setItem(PUBLIC_KEY, idbPublic)
    return { publicKey: idbPublic, secretKey: await decryptSecret(idbEncrypted) }
  }

  // 2. Migrate from localStorage v2 (encrypted secret was in localStorage — XSS risk).
  const lsPublic = localStorage.getItem(PUBLIC_KEY)
  const lsEncrypted = localStorage.getItem(ENCRYPTED_PRIVATE_KEY)
  if (lsPublic && lsEncrypted) {
    const parsed = JSON.parse(lsEncrypted) as EncryptedSecret
    await idbPut(IDB_ENCRYPTED_KEY, parsed)
    await idbPut(IDB_PUBLIC_KEY, lsPublic)
    localStorage.removeItem(ENCRYPTED_PRIVATE_KEY)
    return { publicKey: lsPublic, secretKey: await decryptSecret(parsed) }
  }

  // 3. One-time migration from the previous plaintext-at-rest implementation.
  const legacySecret = localStorage.getItem(LEGACY_PRIVATE_KEY)
  if (lsPublic && legacySecret) {
    const encrypted = await encryptSecret(legacySecret)
    await idbPut(IDB_ENCRYPTED_KEY, encrypted)
    await idbPut(IDB_PUBLIC_KEY, lsPublic)
    localStorage.removeItem(LEGACY_PRIVATE_KEY)
    return { publicKey: lsPublic, secretKey: legacySecret }
  }

  // 4. First run — generate a new key pair.
  const pair = createSigningKeyPair(crypto.getRandomValues(new Uint8Array(32)))
  const encrypted = await encryptSecret(pair.secretKey)
  await idbPut(IDB_ENCRYPTED_KEY, encrypted)
  await idbPut(IDB_PUBLIC_KEY, pair.publicKey)
  localStorage.setItem(PUBLIC_KEY, pair.publicKey)
  localStorage.removeItem(LEGACY_PRIVATE_KEY)
  localStorage.removeItem(ENCRYPTED_PRIVATE_KEY)
  return pair
}

async function encryptSecret(secret: string): Promise<EncryptedSecret> {
  const key = await getWrappingKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  return { iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(ciphertext)) }
}

async function decryptSecret(value: EncryptedSecret) {
  const key = await getWrappingKey()
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBytes(value.iv) },
    key,
    decodeBytes(value.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

async function getWrappingKey(): Promise<CryptoKey> {
  const database = await openDatabase()
  const existing = await request<CryptoKey | undefined>(database.transaction(STORE).objectStore(STORE).get(WRAPPING_KEY))
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const transaction = database.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).put(key, WRAPPING_KEY)
  await transactionDone(transaction)
  return key
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE)
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error ?? new Error('Unable to open signing key storage'))
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase()
  return request<T | undefined>(database.transaction(STORE).objectStore(STORE).get(key))
}

async function idbPut<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).put(value, key)
  await transactionDone(transaction)
}

function request<T>(value: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(value.error ?? new Error('Signing key storage request failed'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Signing key storage transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Signing key storage transaction was aborted'))
  })
}

function encodeBytes(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
