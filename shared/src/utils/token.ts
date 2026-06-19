import type { QRTokenPayload } from '../types'

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
  return btoa(JSON.stringify(payload))
}

export function decodeTokenPayload(encoded: string): QRTokenPayload | null {
  try {
    const json = atob(encoded)
    return JSON.parse(json) as QRTokenPayload
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
