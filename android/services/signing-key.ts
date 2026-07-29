import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createSigningKeyPair } from '@polycheck/shared'

const PRIVATE_KEY = 'polycheck-teacher-signing-secret'
const PUBLIC_KEY = 'polycheck-teacher-signing-public'

export async function getOrCreateTeacherSigningKey() {
  try {
    const [secretKey, publicKey] = await Promise.all([
      SecureStore.getItemAsync(PRIVATE_KEY),
      SecureStore.getItemAsync(PUBLIC_KEY),
    ])
    if (secretKey && publicKey) return { secretKey, publicKey }
  } catch {
    // SecureStore read failed — fall through to regenerate
  }

  const seed = await Crypto.getRandomBytesAsync(32)
  const pair = createSigningKeyPair(seed)
  try {
    await Promise.all([
      SecureStore.setItemAsync(PRIVATE_KEY, pair.secretKey),
      SecureStore.setItemAsync(PUBLIC_KEY, pair.publicKey),
    ])
  } catch {
    // SecureStore write failed — still return the in-memory pair for this session
  }
  return pair
}
