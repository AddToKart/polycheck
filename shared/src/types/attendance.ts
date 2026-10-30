export type AttendanceStatus = 'present' | 'late' | 'absent' | 'pending' | 'disputed' | 'excused'

export type ExcuseStatus = 'requested' | 'approved' | 'rejected'

export type ExcuseReason =
  | 'medical'
  | 'family_emergency'
  | 'school_activity'
  | 'transportation'
  | 'bereavement'
  | 'other'

export type ExcuseDecision = 'approve' | 'reject'

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
  | 'mocked_location'
  | 'rooted_device'
  | 'hook_detected'
  | 'emulator_detected'

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
  excuseStatus?: ExcuseStatus
  excuseReason?: ExcuseReason
  excuseDescription?: string
  excuseEvidencePath?: string
  excuseReviewedBy?: string
  excuseReviewedAt?: string
  excuseReviewNote?: string
}

export interface AttendanceSummary {
  sectionId: string
  subjectName: string
  totalSessions: number
  present: number
  late: number
  absent: number
  disputed: number
  excused: number
}
