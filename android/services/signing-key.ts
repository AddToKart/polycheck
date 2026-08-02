import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createSigningKeyPair } from '@polycheck/shared'

const LEGACY_PRIVATE_KEY = 'polycheck-teacher-signing-secret'
const LEGACY_PUBLIC_KEY = 'polycheck-teacher-signing-public'

const storageKeys = (teacherId: string) => {
  const account = teacherId.replace(/[^A-Za-z0-9._-]/g, '_')
  if (!account) throw new Error('A teacher account is required for signing-key storage')
  return {
    secret: `polycheck.teacher-signing-secret.${account}`,
    public: `polycheck.teacher-signing-public.${account}`,
  }
}

export async function getOrCreateTeacherSigningKey(teacherId: string) {
  const keys = storageKeys(teacherId)
  const [secretKey, publicKey] = await Promise.all([
    SecureStore.getItemAsync(keys.secret),
    SecureStore.getItemAsync(keys.public),
  ])
  if (secretKey && publicKey) return { secretKey, publicKey }
  if (secretKey || publicKey) {
    throw new Error('Teacher signing-key storage is incomplete. Reset this device signing key before continuing.')
  }

  const seed = await Crypto.getRandomBytesAsync(32)
  const pair = createSigningKeyPair(seed)
  try {
    await Promise.all([
      SecureStore.setItemAsync(keys.secret, pair.secretKey),
      SecureStore.setItemAsync(keys.public, pair.publicKey),
    ])
    await Promise.all([
      SecureStore.deleteItemAsync(LEGACY_PRIVATE_KEY),
      SecureStore.deleteItemAsync(LEGACY_PUBLIC_KEY),
    ])
  } catch (error) {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(keys.secret),
      SecureStore.deleteItemAsync(keys.public),
    ])
    throw new Error(
      `Unable to persist the teacher signing key securely: ${
        error instanceof Error ? error.message : 'secure storage failed'
      }`,
    )
  }
  return pair
}
