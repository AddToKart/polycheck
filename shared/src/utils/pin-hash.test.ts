import { describe, expect, it } from 'vitest'
import {
  MEETING_PIN_KDF_ITERATIONS,
  assertValidMeetingPin,
  decodePinHashRecord,
  encodePinHashRecord,
  hashMeetingPin,
  isValidPinFormat,
  randomMeetingPin,
  verifyMeetingPin,
} from './pin-hash'

// Keep the KDF fast in tests while staying inside the accepted min bound.
const FAST_ITERATIONS = 10_000

function fixedRandom(byte: number) {
  return (length: number) => new Uint8Array(length).fill(byte)
}

describe('hashMeetingPin / verifyMeetingPin', () => {
  it('produces a serialized record with the expected format', async () => {
    const { serialized, record } = await hashMeetingPin('83', {
      randomFn: fixedRandom(7),
      iterations: FAST_ITERATIONS,
    })
    expect(serialized.startsWith('p1$pbkdf2-sha256$')).toBe(true)
    expect(serialized.split('$')).toHaveLength(5)
    expect(record.iterations).toBe(FAST_ITERATIONS)
    expect(record.salt).toHaveLength(16)
    expect(record.digest).toHaveLength(32)
  })

  it('verifies the correct PIN and rejects a wrong PIN', async () => {
    const { serialized } = await hashMeetingPin('83', { randomFn: fixedRandom(1), iterations: FAST_ITERATIONS })
    await expect(verifyMeetingPin('83', serialized)).resolves.toBe(true)
    await expect(verifyMeetingPin('84', serialized)).resolves.toBe(false)
    await expect(verifyMeetingPin('830', serialized)).resolves.toBe(false)
  })

  it('uses the same digest for the same pin+salt and differs across salts', async () => {
    const first = await hashMeetingPin('1234', { salt: new Uint8Array(16).fill(2), iterations: FAST_ITERATIONS })
    const second = await hashMeetingPin('1234', { salt: new Uint8Array(16).fill(2), iterations: FAST_ITERATIONS })
    const third = await hashMeetingPin('1234', { salt: new Uint8Array(16).fill(3), iterations: FAST_ITERATIONS })
    expect(encodePinHashRecord(first.record)).toBe(encodePinHashRecord(second.record))
    expect(encodePinHashRecord(first.record)).not.toBe(encodePinHashRecord(third.record))
  })

  it('rejects tampered or malformed hashes', async () => {
    const { serialized, record } = await hashMeetingPin('45', {
      randomFn: fixedRandom(4),
      iterations: FAST_ITERATIONS,
    })
    const tampered = serialized.slice(0, -2) + (serialized.endsWith('A') ? 'BB' : 'AA')
    await expect(verifyMeetingPin('45', tampered)).resolves.toBe(false)
    await expect(verifyMeetingPin('45', 'garbage')).resolves.toBe(false)
    await expect(
      verifyMeetingPin('45', { ...record, iterations: 1 } as typeof record),
    ).resolves.toBe(false)
  })

  it('rejects invalid pins without touching the KDF', async () => {
    const { serialized } = await hashMeetingPin('22', { randomFn: fixedRandom(9), iterations: FAST_ITERATIONS })
    await expect(verifyMeetingPin('', serialized)).resolves.toBe(false)
    await expect(verifyMeetingPin('abc', serialized)).resolves.toBe(false)
    await expect(verifyMeetingPin('12345', serialized)).resolves.toBe(false)
  })

  it('decodes what it encodes and rejects invalid iteration counts', async () => {
    const { serialized, record } = await hashMeetingPin('99', {
      randomFn: fixedRandom(5),
      iterations: FAST_ITERATIONS,
    })
    expect(decodePinHashRecord(serialized)).toEqual(record)
    expect(decodePinHashRecord(`p1$pbkdf2-sha256$1$${serialized.split('$')[3]}$${serialized.split('$')[4]}`)).toBeNull()
    expect(decodePinHashRecord('p2$pbkdf2-sha256$10000$AAAA$AAAA')).toBeNull()
  })

  it('defaults to the production iteration count', async () => {
    const { record } = await hashMeetingPin('12', { randomFn: fixedRandom(6) })
    expect(record.iterations).toBe(MEETING_PIN_KDF_ITERATIONS)
  })
})

describe('pin format helpers', () => {
  it('accepts 2-4 digit PINs only', () => {
    expect(isValidPinFormat('12')).toBe(true)
    expect(isValidPinFormat('1234')).toBe(true)
    expect(isValidPinFormat('1')).toBe(false)
    expect(isValidPinFormat('12345')).toBe(false)
    expect(isValidPinFormat('12a')).toBe(false)
    expect(() => assertValidMeetingPin('123')).not.toThrow()
    expect(() => assertValidMeetingPin('12345')).toThrow()
  })
})

describe('randomMeetingPin', () => {
  it('generates the requested digit length using injected entropy', () => {
    expect(randomMeetingPin(2, () => new Uint8Array([0, 0, 0, 5]))).toBe('05')
    expect(randomMeetingPin(3, () => new Uint8Array([0, 0, 0x03, 0xe7]))).toBe('999')
    expect(randomMeetingPin(4, () => new Uint8Array([0, 0, 0, 42]))).toBe('0042')
    expect(() => randomMeetingPin(5, () => new Uint8Array(4))).toThrow()
  })

  it('rejects a random source that returns too few bytes', () => {
    expect(() => randomMeetingPin(3, () => new Uint8Array([1, 2]))).toThrow()
  })
})
