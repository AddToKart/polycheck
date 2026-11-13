import { describe, expect, it } from 'vitest'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'

const keys = createSigningKeyPair(new Uint8Array(32).fill(7))
const otherKeys = createSigningKeyPair(new Uint8Array(32).fill(9))

const payload = {
  version: 1 as const,
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  teacherName: 'Professor',
  issuedAt: 1_790_000_000_000,
  validityMinutes: 15,
  gracePeriodMinutes: 10,
  mode: 'in_person' as const,
  pinRequired: false,
}

describe('native Ed25519 token verification', () => {
  it('verifies a token signed by the shared (tweetnacl) signer', () => {
    const token = signQRToken(payload, keys.secretKey)
    const decoded = verifyQRTokenNative(token, keys.publicKey)
    expect(decoded).toMatchObject({ sessionId: 'sess-1', teacherId: 'teacher-1', validityMinutes: 15 })
  })

  it('rejects a tampered payload even with a valid signature shape', () => {
    const token = signQRToken(payload, keys.secretKey)
    const [, signature] = token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...payload, sessionId: 'sess-2' }),
    ).toString('base64url')
    expect(verifyQRTokenNative(`${forgedPayload}.${signature}`, keys.publicKey)).toBeNull()
  })

  it('rejects a token signed by another teacher key', () => {
    const token = signQRToken(payload, otherKeys.secretKey)
    expect(verifyQRTokenNative(token, keys.publicKey)).toBeNull()
  })

  it('rejects malformed tokens and unusable public keys without throwing', () => {
    expect(verifyQRTokenNative('not-a-token', keys.publicKey)).toBeNull()
    expect(verifyQRTokenNative(`${'a'.repeat(20)}.${'b'.repeat(20)}`, 'x')).toBeNull()
    const token = signQRToken(payload, keys.secretKey)
    expect(verifyQRTokenNative(token, 'x')).toBeNull()
  })
})
