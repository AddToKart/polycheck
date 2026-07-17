import type { QRTokenPayload } from '../types'
import nacl from 'tweetnacl'

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytesToBase64(bytes: Uint8Array): string {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0
    const chunk = (first << 16) | (second << 8) | third
    output += BASE64[(chunk >>> 18) & 63]
    output += BASE64[(chunk >>> 12) & 63]
    output += index + 1 < bytes.length ? BASE64[(chunk >>> 6) & 63] : '='
    output += index + 2 < bytes.length ? BASE64[chunk & 63] : '='
  }
  return output
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const clean = padded.replace(/[^A-Za-z0-9+/=]/g, '')
  const output: number[] = []
  for (let index = 0; index < clean.length; index += 4) {
    const a = BASE64.indexOf(clean[index])
    const b = BASE64.indexOf(clean[index + 1])
    const c = clean[index + 2] === '=' ? 0 : BASE64.indexOf(clean[index + 2])
    const d = clean[index + 3] === '=' ? 0 : BASE64.indexOf(clean[index + 3])
    const chunk = (a << 18) | (b << 12) | (c << 6) | d
    output.push((chunk >>> 16) & 255)
    if (clean[index + 2] !== '=') output.push((chunk >>> 8) & 255)
    if (clean[index + 3] !== '=') output.push(chunk & 255)
  }
  return new Uint8Array(output)
}

function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function bytesToUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value)
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function decodeBase64Url(value: string): Uint8Array {
  return base64ToBytes(value)
}

export function createSigningKeyPair(seed?: Uint8Array): { publicKey: string; secretKey: string } {
  const pair = seed ? nacl.sign.keyPair.fromSeed(seed) : nacl.sign.keyPair()
  return { publicKey: encodeBase64Url(pair.publicKey), secretKey: encodeBase64Url(pair.secretKey) }
}

export function signQRToken(payload: QRTokenPayload, secretKey: string): string {
  const encodedPayload = encodeBase64Url(utf8ToBytes(JSON.stringify(payload)))
  const signature = nacl.sign.detached(utf8ToBytes(encodedPayload), decodeBase64Url(secretKey))
  return `${encodedPayload}.${encodeBase64Url(signature)}`
}

export function verifyQRToken(token: string, publicKey: string): QRTokenPayload | null {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split('.')
    if (!encodedPayload || !encodedSignature || extra) return null
    const valid = nacl.sign.detached.verify(
      utf8ToBytes(encodedPayload),
      decodeBase64Url(encodedSignature),
      decodeBase64Url(publicKey),
    )
    if (!valid) return null
    const payload = JSON.parse(bytesToUtf8(decodeBase64Url(encodedPayload))) as QRTokenPayload
    return payload.version === 1 ? payload : null
  } catch {
    return null
  }
}

export function isTokenInValidityWindow(
  payload: QRTokenPayload,
  _serverTimeMs?: number
): { valid: boolean; inGrace: boolean } {
  const issuedAt = payload.issuedAt
  const validityEnd = issuedAt + payload.validityMinutes * 60 * 1000
  const graceEnd = validityEnd + payload.gracePeriodMinutes * 60 * 1000
  const now = _serverTimeMs ?? Date.now()

  if (now <= validityEnd) return { valid: true, inGrace: false }
  if (now <= graceEnd) return { valid: true, inGrace: true }
  return { valid: false, inGrace: false }
}

export function encodeTokenPayload(payload: QRTokenPayload): string {
  return encodeBase64Url(utf8ToBytes(JSON.stringify(payload)))
}

export function decodeTokenPayload(encoded: string): QRTokenPayload | null {
  try {
    const payloadPart = encoded.includes('.') ? encoded.split('.')[0] : encoded
    const payload = JSON.parse(bytesToUtf8(decodeBase64Url(payloadPart))) as QRTokenPayload
    return payload.version === 1 ? payload : null
  } catch {
    return null
  }
}

export function createQRTokenData(
  sessionId: string,
  sectionId: string,
  teacherId: string,
  teacherName: string,
  validityMinutes: number,
  gracePeriodMinutes: number
): string {
  const payload: QRTokenPayload = {
    version: 1,
    sessionId,
    sectionId,
    issuedAt: Date.now(),
    validityMinutes,
    gracePeriodMinutes,
    teacherId,
    teacherName,
  }
  return encodeTokenPayload(payload)
}
