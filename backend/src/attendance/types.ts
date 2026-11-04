import type { AttendanceRecord, AttendanceStatus, Session, SessionMode } from '../prisma/client'
import type { DeviceSecurityEvidence } from '@polycheck/shared'

// ── Constants ──

export const MAX_LOCATION_AGE_MS = 2 * 60_000
export const MAX_LOCATION_ACCURACY_METERS = 50
export const RAW_ATTENDANCE_LIMIT = 1_000
export const RAW_DATE_RANGE_DAYS = 31
export const REPORT_DATE_RANGE_DAYS = 366
export const REPORT_SECTION_LIMIT = 1_000
export const MIN_ONLINE_CHECKPOINT_VALIDITY_SECONDS = 60
export const MAX_ONLINE_CHECKPOINT_VALIDITY_SECONDS = 300
export const PIN_ATTEMPT_LIMIT = 6
export const PIN_ATTEMPT_WINDOW_SECONDS = 10 * 60

// ── Types ──

export type CachedSession = Omit<
  Session,
  'endedAt' | 'qrTokenExpiresAt' | 'startTokenExpiresAt' | 'endTokenExpiresAt' | 'autoEndAt'
> & {
  endedAt: string | null
  qrTokenExpiresAt: string | null
  startTokenExpiresAt: string | null
  endTokenExpiresAt: string | null
  autoEndAt: string | null
  teacherPublicKey?: string
}

export type ScanEvidence = {
  sessionId: string
  latitude?: number
  longitude?: number
  deviceId?: string
  qrToken: string
  scannedAt?: string
  clientAttemptId?: string
  accuracyMeters?: number
  locationCapturedAt?: string
  mocked?: boolean
  inputChannel?: 'camera' | 'image' | 'manual'
  deviceSecurity?: DeviceSecurityEvidence
  /** Meeting PIN for online checkpoints; validated server-side and never stored. */
  pin?: string
}

export type ScanValidation = {
  success: boolean
  status: AttendanceStatus
  reason?: string
  message: string
  scannedAt: Date
  receivedAt: Date
  mode?: SessionMode
  checkpoint?: 'start' | 'end'
  pinVerified?: boolean
  distanceMeters?: number
  geofenceRadiusMeters?: number
  riskSignals: string[]
}

export type PresentedAttendance = AttendanceRecord & {
  coordinates: { latitude: number | null; longitude: number | null }
}
