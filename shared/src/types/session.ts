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
  qrValidityMinutes: number
  gracePeriodMinutes: number
  geofence: GeofenceConfig
  isActive: boolean
  qrToken?: string
  qrTokenExpiresAt?: string
  qrGeneratedAt?: string
  teacherId: string
  createdAt: string
  isRescheduled?: boolean
  rescheduledFromDate?: string
  originalScheduleTime?: string
  originalRoom?: string
}

export interface QRTokenPayload {
  sessionId: string
  sectionId: string
  issuedAt: number
  validityMinutes: number
  gracePeriodMinutes: number
  teacherId: string
  teacherName: string
}
