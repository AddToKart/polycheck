import type { AttendanceRecord, AttendanceStatus, Session } from '../prisma/client'

// ── Constants ──

export const MAX_LOCATION_AGE_MS = 2 * 60_000
export const MAX_LOCATION_ACCURACY_METERS = 50
export const RAW_ATTENDANCE_LIMIT = 1_000
export const RAW_DATE_RANGE_DAYS = 31
export const REPORT_DATE_RANGE_DAYS = 366
export const REPORT_SECTION_LIMIT = 1_000

// ── Types ──

export type CachedSession = Omit<Session, 'endedAt' | 'qrTokenExpiresAt'> & {
  endedAt: string | null
  qrTokenExpiresAt: string | null
  teacherPublicKey?: string
}

export type ScanEvidence = {
  sessionId: string
  latitude: number
  longitude: number
  deviceId?: string
  qrToken: string
  scannedAt?: string
  clientAttemptId?: string
  accuracyMeters?: number
  locationCapturedAt?: string
  mocked?: boolean
  inputChannel?: 'camera' | 'image' | 'manual'
}

export type ScanValidation = {
  success: boolean
  status: AttendanceStatus
  reason?: string
  message: string
  scannedAt: Date
  receivedAt: Date
  distanceMeters?: number
  geofenceRadiusMeters?: number
  riskSignals: string[]
}

export type PresentedAttendance = AttendanceRecord & {
  coordinates: { latitude: number; longitude: number }
}
