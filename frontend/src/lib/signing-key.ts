import { createSigningKeyPair } from '@polycheck/shared'

const LEGACY_PRIVATE_KEY = 'polycheck-teacher-signing-secret'
const DATABASE = 'polycheck-keys'
const STORE = 'crypto-keys'

type EncryptedSecret = { iv: string; ciphertext: string }

const accountKeys = (teacherId: string) => {
  const account = teacherId.trim()
  if (!account) throw new Error('A teacher account is required for signing-key storage')
  return {
    encrypted: `teacher-signing-encrypted-secret:${account}`,
    public: `teacher-signing-public:${account}`,
    wrapper: `teacher-signing-key-wrapper:${account}`,
    provisioned: `teacher-signing-provisioned:${account}`,
  }
}

/**
 * True when this browser has already uploaded the account's public key to the
 * server. Provisioning is rate limited server-side, so the client must not
 * re-upload the same key on every QR generation.
 */
export async function isSigningKeyProvisioned(teacherId: string): Promise<boolean> {
  const keys = accountKeys(teacherId)
  return Boolean(await idbGet<string>(keys.provisioned))
}

/** Persist the provisioned marker after a successful public-key upload. */
export async function markSigningKeyProvisioned(teacherId: string): Promise<void> {
  const keys = accountKeys(teacherId)
  await idbPut(keys.provisioned, String(Date.now()))
}

export async function getOrCreateTeacherSigningKey(teacherId: string) {
  const keys = accountKeys(teacherId)
  const idbEncrypted = await idbGet<EncryptedSecret>(keys.encrypted)
  const idbPublic = await idbGet<string>(keys.public)
  if (idbEncrypted && idbPublic) {
    return { publicKey: idbPublic, secretKey: await decryptSecret(idbEncrypted, keys.wrapper) }
  }
  if (idbEncrypted || idbPublic) {
    throw new Error('Teacher signing-key storage is incomplete. Reset this browser signing key before continuing.')
  }

  const pair = createSigningKeyPair(crypto.getRandomValues(new Uint8Array(32)))
  const encrypted = await encryptSecret(pair.secretKey, keys.wrapper)
  await idbPut(keys.encrypted, encrypted)
  await idbPut(keys.public, pair.publicKey)

  // A newly generated pair has not been uploaded yet — clear any stale marker
  await idbDel(keys.provisioned)

  // Global keys from earlier releases cannot be attributed safely on a shared
  // browser. Rotate them instead of assigning them to the current account.
  localStorage.removeItem(LEGACY_PRIVATE_KEY)
  localStorage.removeItem('polycheck-teacher-signing-secret-v2')
  localStorage.removeItem('polycheck-teacher-signing-public')
  return pair
}

async function encryptSecret(secret: string, wrappingKey: string): Promise<EncryptedSecret> {
  const key = await getWrappingKey(wrappingKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  return { iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(ciphertext)) }
}

async function decryptSecret(value: EncryptedSecret, wrappingKey: string) {
  const key = await getWrappingKey(wrappingKey)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBytes(value.iv) },
    key,
    decodeBytes(value.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

async function getWrappingKey(storageKey: string): Promise<CryptoKey> {
  const database = await openDatabase()
  const existing = await request<CryptoKey | undefined>(
    database.transaction(STORE).objectStore(STORE).get(storageKey),
  )
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const transaction = database.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).put(key, storageKey)
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

async function idbDel(key: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE, 'readwrite')
  transaction.objectStore(STORE).delete(key)
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
