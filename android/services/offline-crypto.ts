import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import nacl from 'tweetnacl'

const STORAGE_KEY = 'polycheck.offline-encryption-key.v1'
const PREFIX = 'v1'
let keyPromise: Promise<Uint8Array> | null = null

const encodeBase64 = (value: Uint8Array) => {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const decodeBase64 = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const encryptionKey = () => {
  if (keyPromise) return keyPromise
  keyPromise = (async () => {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY)
    if (stored) {
      const decoded = decodeBase64(stored)
      if (decoded.length !== nacl.secretbox.keyLength) throw new Error('Offline encryption key is invalid')
      return decoded
    }
    const generated = await Crypto.getRandomBytesAsync(nacl.secretbox.keyLength)
    await SecureStore.setItemAsync(STORAGE_KEY, encodeBase64(generated))
    return generated
  })().catch((error) => {
    keyPromise = null
    throw error
  })
  return keyPromise
}

export const encryptOfflineValue = async (value: unknown) => {
  const key = await encryptionKey()
  const nonce = await Crypto.getRandomBytesAsync(nacl.secretbox.nonceLength)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const encrypted = nacl.secretbox(plaintext, nonce, key)
  return `${PREFIX}.${encodeBase64(nonce)}.${encodeBase64(encrypted)}`
}

export const decryptOfflineValue = async <T>(value: string): Promise<T> => {
  const parts = value.split('.')
  const [prefix, nonceValue, encryptedValue] = parts
  if (parts.length !== 3 || prefix !== PREFIX || !nonceValue || !encryptedValue) {
    throw new Error('Offline data is not encrypted with a supported format')
  }
  const key = await encryptionKey()
  let decrypted: Uint8Array | null = null
  try {
    const nonce = decodeBase64(nonceValue)
    const ciphertext = decodeBase64(encryptedValue)
    if (nonce.length !== nacl.secretbox.nonceLength) throw new Error('Invalid nonce')
    decrypted = nacl.secretbox.open(ciphertext, nonce, key)
  } catch {
    throw new Error('Offline data could not be authenticated')
  }
  if (!decrypted) throw new Error('Offline data could not be authenticated')
  try {
    return JSON.parse(new TextDecoder().decode(decrypted)) as T
  } catch {
    throw new Error('Offline data could not be authenticated')
  }
}

export const resetOfflineCryptoForTests = () => {
  keyPromise = null
}
