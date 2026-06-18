export interface GeofenceConfig {
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface Session {
  id: string
  subjectId: string
  subjectName: string
  date: string
  startTime: string
  endTime: string
  gracePeriodMinutes: number
  tokenWindowSeconds: number
  geofence: GeofenceConfig
  isActive: boolean
  qrToken?: string
  qrTokenExpiresAt?: string
  teacherId: string
  createdAt: string
}

export interface QRTokenPayload {
  sessionId: string
  subjectId: string
  issuedAt: number
  windowDurationSeconds: number
  teacherId: string
  teacherName: string
}
