import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha256.js'
import { decodeBase64Url, encodeBase64Url } from './token'

/**
 * Meeting PIN hashing for online attendance checkpoints.
 *
 * A 2–4 digit PIN has at most 10,000 candidates, so a plain hash embedded in a
 * signed QR token would be trivially reversible offline. We therefore use a
 * deliberately expensive PBKDF2-HMAC-SHA256 derivation (higher cost per
 * candidate) with a per-token salt. The server keeps its own copy of the record
 * and re-derives on verification; the plaintext PIN never leaves the teacher's
 * device.
 */
export const MEETING_PIN_KDF_ITERATIONS = 100_000
export const MEETING_PIN_MIN_ITERATIONS = 10_000
export const MEETING_PIN_MAX_ITERATIONS = 600_000
export const MEETING_PIN_PATTERN = /^\d{2,4}$/

const PIN_HASH_VERSION = 'p1'
const PIN_HASH_ALGORITHM = 'pbkdf2-sha256'
const SALT_BYTES = 16
const DIGEST_BYTES = 32

export interface PinHashRecord {
  iterations: number
  salt: Uint8Array
  digest: Uint8Array
}

function defaultRandomBytes(length: number): Uint8Array {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('A secure random source is required to hash a meeting PIN')
  }
  return cryptoApi.getRandomValues(new Uint8Array(length))
}

function normalizePin(pin: string): string {
  return pin.trim()
}

export function isValidPinFormat(value: string): boolean {
  return MEETING_PIN_PATTERN.test(value)
}

export function assertValidMeetingPin(pin: string): void {
  if (!isValidPinFormat(pin)) {
    throw new Error('Meeting PIN must be 2-4 digits')
  }
}

export function encodePinHashRecord(record: PinHashRecord): string {
  return [
    PIN_HASH_VERSION,
    PIN_HASH_ALGORITHM,
    String(record.iterations),
    encodeBase64Url(record.salt),
    encodeBase64Url(record.digest),
  ].join('$')
}

export function decodePinHashRecord(value: string): PinHashRecord | null {
  try {
    const [version, algorithm, iterationsRaw, saltRaw, digestRaw, extra] = value.split('$')
    if (extra !== undefined) return null
    if (version !== PIN_HASH_VERSION || algorithm !== PIN_HASH_ALGORITHM) return null
    const iterations = Number(iterationsRaw)
    if (
      !Number.isInteger(iterations) ||
      iterations < MEETING_PIN_MIN_ITERATIONS ||
      iterations > MEETING_PIN_MAX_ITERATIONS
    ) {
      return null
    }
    const salt = decodeBase64Url(saltRaw ?? '')
    const digest = decodeBase64Url(digestRaw ?? '')
    if (salt.length !== SALT_BYTES || digest.length !== DIGEST_BYTES) return null
    return { iterations, salt, digest }
  } catch {
    return null
  }
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!
  }
  return difference === 0
}

export async function hashMeetingPin(
  pin: string,
  options: { salt?: Uint8Array; randomFn?: (length: number) => Uint8Array; iterations?: number } = {},
): Promise<{ record: PinHashRecord; serialized: string }> {
  assertValidMeetingPin(pin)
  const iterations = options.iterations ?? MEETING_PIN_KDF_ITERATIONS
  if (
    !Number.isInteger(iterations) ||
    iterations < MEETING_PIN_MIN_ITERATIONS ||
    iterations > MEETING_PIN_MAX_ITERATIONS
  ) {
    throw new Error('Meeting PIN iteration count is outside the allowed range')
  }
  const salt = options.salt ?? (options.randomFn ?? defaultRandomBytes)(SALT_BYTES)
  if (salt.length !== SALT_BYTES) throw new Error('Meeting PIN salt must be 16 bytes')
  const digest = await pbkdf2Async(sha256, new TextEncoder().encode(normalizePin(pin)), salt, {
    c: iterations,
    dkLen: DIGEST_BYTES,
  })
  const record: PinHashRecord = { iterations, salt, digest }
  return { record, serialized: encodePinHashRecord(record) }
}

export async function verifyMeetingPin(
  pin: string,
  recordOrSerialized: string | PinHashRecord | null | undefined,
): Promise<boolean> {
  if (!recordOrSerialized || !isValidPinFormat(pin)) return false
  const record =
    typeof recordOrSerialized === 'string' ? decodePinHashRecord(recordOrSerialized) : recordOrSerialized
  if (!record) return false
  if (record.salt.length !== SALT_BYTES || record.digest.length !== DIGEST_BYTES) return false
  if (
    !Number.isInteger(record.iterations) ||
    record.iterations < MEETING_PIN_MIN_ITERATIONS ||
    record.iterations > MEETING_PIN_MAX_ITERATIONS
  ) {
    return false
  }
  const digest = await pbkdf2Async(sha256, new TextEncoder().encode(normalizePin(pin)), record.salt, {
    c: record.iterations,
    dkLen: DIGEST_BYTES,
  })
  return timingSafeEqual(digest, record.digest)
}

/**
 * Generates a random numeric PIN of `digits` length (2-4) using the injected
 * platform CSPRNG (web: crypto.getRandomValues, Android: expo-crypto).
 */
export function randomMeetingPin(digits: number, randomBytes: (length: number) => Uint8Array): string {
  if (!Number.isInteger(digits) || digits < 2 || digits > 4) {
    throw new Error('Meeting PIN length must be 2-4 digits')
  }
  const range = 10 ** digits
  const maxUnbiased = Math.floor(0x100000000 / range) * range
  for (;;) {
    const bytes = randomBytes(4)
    if (bytes.length < 4) throw new Error('Random source returned insufficient bytes')
    const value = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
    if (value < maxUnbiased) {
      return String(value % range).padStart(digits, '0')
    }
  }
}
