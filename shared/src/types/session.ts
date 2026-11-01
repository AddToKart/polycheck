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
