import { createSigningKeyPair } from '@polycheck/shared'

const PRIVATE_KEY = 'polycheck-teacher-signing-secret'
const PUBLIC_KEY = 'polycheck-teacher-signing-public'

export function getOrCreateTeacherSigningKey() {
  const secretKey = localStorage.getItem(PRIVATE_KEY)
  const publicKey = localStorage.getItem(PUBLIC_KEY)
  if (secretKey && publicKey) return { secretKey, publicKey }

  const pair = createSigningKeyPair()
  localStorage.setItem(PRIVATE_KEY, pair.secretKey)
  localStorage.setItem(PUBLIC_KEY, pair.publicKey)
  return pair
}
