import { describe, expect, it } from 'vitest'
import {
  createSigningKeyPair,
  signQRToken,
  verifyQRToken,
  isTokenInValidityWindow,
  createQRTokenData,
  encodeTokenPayload,
  decodeTokenPayload,
  encodeBase64Url,
  decodeBase64Url,
} from './token'
import type { QRTokenPayload } from '../types'

function makePayload(overrides: Partial<QRTokenPayload> = {}): QRTokenPayload {
  return {
    version: 1,
    sessionId: 'ses-123',
    sectionId: 'sec-456',
    issuedAt: 1_000_000_000_000,
    validityMinutes: 30,
    gracePeriodMinutes: 15,
    teacherId: 'tch-789',
    teacherName: 'Dr. Ada Lovelace',
    ...overrides,
  }
}

/** Replaces one character with a different one at the given index. */
function flipChar(value: string, index: number): string {
  const chars = value.split('')
  const original = chars[index]
  chars[index] = original === 'A' ? 'B' : 'A'
  return chars.join('')
}

describe('createSigningKeyPair', () => {
  it('is deterministic for a given 32-byte seed', () => {
    const seed = new Uint8Array(32).fill(7)
    const first = createSigningKeyPair(seed)
    const second = createSigningKeyPair(seed)
    expect(second.publicKey).toBe(first.publicKey)
    expect(second.secretKey).toBe(first.secretKey)
  })

  it('produces different keys for different seeds', () => {
    const seedA = new Uint8Array(32).fill(1)
    const seedB = new Uint8Array(32).fill(2)
    const pairA = createSigningKeyPair(seedA)
    const pairB = createSigningKeyPair(seedB)
    expect(pairA.publicKey).not.toBe(pairB.publicKey)
    expect(pairA.secretKey).not.toBe(pairB.secretKey)
  })

  it('returns base64url-encoded keys that a round trip accepts', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(42))
    const payload = makePayload()
    const token = signQRToken(payload, pair.secretKey)
    expect(verifyQRToken(token, pair.publicKey)).toEqual(payload)
  })
})

describe('signQRToken / verifyQRToken', () => {
  it('round trips and returns the exact payload', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(1))
    const payload = makePayload()
    const token = signQRToken(payload, pair.secretKey)
    expect(verifyQRToken(token, pair.publicKey)).toEqual(payload)
  })

  it('round trips a payload with Unicode teacher name', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(2))
    const payload = makePayload({ teacherName: 'María José García-Delgado ✓ 日本語テスト' })
    const token = signQRToken(payload, pair.secretKey)
    expect(verifyQRToken(token, pair.publicKey)).toEqual(payload)
  })

  it('returns null when a character in the payload part is tampered with', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(3))
    const token = signQRToken(makePayload(), pair.secretKey)
    const [encodedPayload, encodedSignature] = token.split('.')
    const tampered = `${flipChar(encodedPayload, 5)}.${encodedSignature}`
    expect(verifyQRToken(tampered, pair.publicKey)).toBeNull()
  })

  it('returns null when a character in the signature part is tampered with', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(4))
    const token = signQRToken(makePayload(), pair.secretKey)
    const [encodedPayload, encodedSignature] = token.split('.')
    const tampered = `${encodedPayload}.${flipChar(encodedSignature, 3)}`
    expect(verifyQRToken(tampered, pair.publicKey)).toBeNull()
  })

  it('returns null when verified with a different public key', () => {
    const signer = createSigningKeyPair(new Uint8Array(32).fill(5))
    const other = createSigningKeyPair(new Uint8Array(32).fill(6))
    const token = signQRToken(makePayload(), signer.secretKey)
    expect(verifyQRToken(token, other.publicKey)).toBeNull()
  })

  it('returns null for garbage input', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(7))
    expect(verifyQRToken('garbage', pair.publicKey)).toBeNull()
  })

  it('returns null for an empty string', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(8))
    expect(verifyQRToken('', pair.publicKey)).toBeNull()
  })

  it('returns null when the signature part is missing', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(9))
    expect(verifyQRToken('only-a-payload', pair.publicKey)).toBeNull()
  })

  it('returns null when the token has an extra third part', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(10))
    const token = signQRToken(makePayload(), pair.secretKey)
    expect(verifyQRToken(`${token}.extra`, pair.publicKey)).toBeNull()
  })

  it('returns null for a token with version !== 1', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(11))
    const payload = makePayload({ version: 2 as unknown as 1 })
    const token = signQRToken(payload, pair.secretKey)
    expect(verifyQRToken(token, pair.publicKey)).toBeNull()
  })
})

describe('encodeBase64Url / decodeBase64Url', () => {
  it('round trips fixed byte arrays of every padding length', () => {
    const cases: Uint8Array[] = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([0, 1]),
      new Uint8Array([0, 1, 2]),
      new Uint8Array([0, 1, 2, 3]),
      new Uint8Array([0xff, 0x00, 0x80, 0x7f, 0x3c]),
      new Uint8Array([251, 109, 204, 33, 7, 254, 0, 90, 128]),
    ]
    for (const bytes of cases) {
      const encoded = encodeBase64Url(bytes)
      expect(encoded).not.toContain('=')
      expect(decodeBase64Url(encoded)).toEqual(bytes)
    }
  })

  it('produces the expected base64url encoding for a known input', () => {
    // "???" is 0x3f 0x3f 0x3f -> standard base64 "Pz8/" -> url-safe "Pz8_"
    expect(encodeBase64Url(new Uint8Array([0x3f, 0x3f, 0x3f]))).toBe('Pz8_')
    expect(decodeBase64Url('Pz8_')).toEqual(new Uint8Array([0x3f, 0x3f, 0x3f]))
  })
})

describe('encodeTokenPayload / decodeTokenPayload', () => {
  it('round trips the payload exactly', () => {
    const payload = makePayload()
    expect(decodeTokenPayload(encodeTokenPayload(payload))).toEqual(payload)
  })

  it('round trips Unicode payload strings', () => {
    const payload = makePayload({ teacherName: 'María José García-Delgado ✓ 日本語テスト' })
    expect(decodeTokenPayload(encodeTokenPayload(payload))).toEqual(payload)
  })

  it('decodes the payload part of a full signed token', () => {
    const pair = createSigningKeyPair(new Uint8Array(32).fill(12))
    const payload = makePayload()
    const token = signQRToken(payload, pair.secretKey)
    expect(decodeTokenPayload(token)).toEqual(payload)
  })

  it('returns null for garbage', () => {
    expect(decodeTokenPayload('not-valid-base64-!')).toBeNull()
    expect(decodeTokenPayload('')).toBeNull()
  })

  it('returns null for a payload with version !== 1', () => {
    const payload = makePayload({ version: 2 as unknown as 1 })
    expect(decodeTokenPayload(encodeTokenPayload(payload))).toBeNull()
  })
})

describe('createQRTokenData', () => {
  it('includes all fields and is deterministic for a fixed issuedAtMs', () => {
    const issuedAtMs = 1_234_567_890_123
    const expected: QRTokenPayload = {
      version: 1,
      sessionId: 'ses-abc',
      sectionId: 'sec-def',
      issuedAt: issuedAtMs,
      validityMinutes: 45,
      gracePeriodMinutes: 10,
      teacherId: 'tch-ghi',
      teacherName: 'Prof. José Rizal',
    }
    const first = createQRTokenData('ses-abc', 'sec-def', 'tch-ghi', 'Prof. José Rizal', 45, 10, issuedAtMs)
    const second = createQRTokenData('ses-abc', 'sec-def', 'tch-ghi', 'Prof. José Rizal', 45, 10, issuedAtMs)
    expect(first).toBe(second)
    expect(decodeTokenPayload(first)).toEqual(expected)
  })
})

describe('isTokenInValidityWindow', () => {
  const issuedAt = 1_000_000_000_000
  const validityMinutes = 30
  const gracePeriodMinutes = 15
  const validityEnd = issuedAt + validityMinutes * 60 * 1000
  const graceEnd = validityEnd + gracePeriodMinutes * 60 * 1000
  const payload = makePayload({
    issuedAt,
    validityMinutes,
    gracePeriodMinutes,
  })

  it('is valid (not in grace) exactly at the end of validity', () => {
    expect(isTokenInValidityWindow(payload, validityEnd)).toEqual({ valid: true, inGrace: false })
  })

  it('is in grace immediately after the validity window ends', () => {
    expect(isTokenInValidityWindow(payload, validityEnd + 1)).toEqual({ valid: true, inGrace: true })
  })

  it('is in grace exactly at the end of the grace period', () => {
    expect(isTokenInValidityWindow(payload, graceEnd)).toEqual({ valid: true, inGrace: true })
  })

  it('is invalid just past the grace period', () => {
    expect(isTokenInValidityWindow(payload, graceEnd + 1)).toEqual({ valid: false, inGrace: false })
  })

  it('is still valid before issuance (implementation treats now <= validityEnd as valid)', () => {
    expect(isTokenInValidityWindow(payload, issuedAt - 1)).toEqual({ valid: true, inGrace: false })
  })

  it('is valid inside the validity window', () => {
    expect(isTokenInValidityWindow(payload, issuedAt + 60 * 1000)).toEqual({ valid: true, inGrace: false })
  })
})
