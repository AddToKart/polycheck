export type AttendanceStatus = 'present' | 'late' | 'absent' | 'pending' | 'disputed'

export type StudentDisputeReason =
  | 'outside_geofence'
  | 'expired_token'
  | 'duplicate_submission'
  | 'invalid_signature'
  | 'device_mismatch'
  | 'suspicious_coordinates'

export type SystemDisputeReason =
  | 'delayed_offline_sync'
  | 'invalid_timestamp'
  | 'token_mismatch'
  | 'session_inactive'
  | 'not_enrolled'
  | 'qr_expired'
  | 'rate_limited'

export type DisputeReason = StudentDisputeReason | SystemDisputeReason

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
  tokenSnapshot?: string
  isSynced: boolean
  syncedAt?: string
  disputeReason?: DisputeReason
  disputeResolved?: boolean
  disputeDescription?: string
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
