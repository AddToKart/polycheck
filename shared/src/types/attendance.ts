export type AttendanceStatus = 'present' | 'late' | 'absent' | 'pending' | 'disputed'

export type DisputeReason =
  | 'outside_geofence'
  | 'expired_token'
  | 'duplicate_submission'
  | 'invalid_signature'
  | 'device_mismatch'
  | 'suspicious_coordinates'

export interface AttendanceRecord {
  id: string
  sessionId: string
  sectionId: string
  studentId: string
  studentName: string
  studentProgram?: string
  timestamp: string
  status: AttendanceStatus
  coordinates: {
    latitude: number
    longitude: number
  }
  deviceId?: string
  isSynced: boolean
  syncedAt?: string
  disputeReason?: DisputeReason
  disputeResolved?: boolean
  manuallySet?: boolean
  notes?: string
}

export interface AttendanceSummary {
  sectionId: string
  subjectName: string
  totalSessions: number
  present: number
  late: number
  absent: number
  disputed: number
}
