export type SessionMode = 'in_person' | 'online'

export type CheckpointType = 'start' | 'end'

export interface GeofenceConfig {
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface Session {
  id: string
  sectionId: string
  subjectName: string
  date: string
  startTime: string
  endTime: string
  room?: string
  mode: SessionMode
  qrValidityMinutes: number
  gracePeriodMinutes: number
  geofence?: GeofenceConfig
  isActive: boolean
  endedAt?: string
  qrToken?: string
  qrTokenExpiresAt?: string
  qrGeneratedAt?: string
  startQrValiditySeconds?: number
  startGraceMinutes?: number
  endQrValiditySeconds?: number
  endGraceMinutes?: number
  startQrToken?: string
  startTokenExpiresAt?: string
  startQrGeneratedAt?: string
  endQrToken?: string
  endTokenExpiresAt?: string
  endQrGeneratedAt?: string
  pinRequired?: boolean
  autoEndAt?: string
  teacherId: string
  teacherPublicKey?: string
  createdAt: string
  isRescheduled?: boolean
  rescheduledFromDate?: string
  originalScheduleTime?: string
  originalRoom?: string
}

export interface QRTokenPayload {
  version: 1
  sessionId: string
  sectionId: string
  issuedAt: number
  validityMinutes: number
  gracePeriodMinutes: number
  teacherId: string
  teacherName: string
  mode: SessionMode
  checkpoint?: CheckpointType
  pinRequired: boolean
  pinHash?: string
  validitySeconds?: number
}

// ── F1/F2 (WF-LD3/LD4): realtime event names + session finale contracts ──

/** Broadcast when a scan is denied in person with coordinates (geofence radar). */
export const ATTENDANCE_ANOMALY_EVENT = 'attendance:anomaly'

/** Broadcast by `end()` and the auto-end cron once attendance resolves. */
export const SESSION_FINALE_EVENT = 'session:finale'

/** Projector kiosk presence handshake (session-scoped staff views). */
export const KIOSK_JOIN_EVENT = 'kiosk:join'
export const KIOSK_JOINED_EVENT = 'kiosk:joined'
export const KIOSK_LEAVE_EVENT = 'kiosk:leave'

export const FINALE_COUNT_STATUSES = [
  'present',
  'late',
  'absent',
  'excused',
  'incomplete',
  'disputed',
  'pending',
] as const

export type FinaleCountStatus = (typeof FINALE_COUNT_STATUSES)[number]

export interface SessionFinaleSummary {
  sessionId: string
  /** Server commit instant — lets clients dedupe repeated broadcasts. */
  endedAt: string
  counts: Record<FinaleCountStatus, number>
  /** Roster size of the section (enrollment count) when known. */
  capacity: number
}
