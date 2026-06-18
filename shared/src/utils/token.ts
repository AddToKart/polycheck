import type { QRTokenPayload } from '../types'

export function isTokenExpired(
  payload: QRTokenPayload,
  _serverTimeMs?: number
): boolean {
  const issuedAt = payload.issuedAt
  const expiresAt = issuedAt + payload.windowDurationSeconds * 1000
  const now = _serverTimeMs ?? Date.now()
  return now > expiresAt
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
  subjectId: string,
  teacherId: string,
  teacherName: string,
  windowDurationSeconds: number
): string {
  const payload: QRTokenPayload = {
    sessionId,
    subjectId,
    issuedAt: Date.now(),
    windowDurationSeconds,
    teacherId,
    teacherName,
  }
  return encodeTokenPayload(payload)
}
