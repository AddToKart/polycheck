import type { AttendanceStandingStatus } from './standing'

export interface StudentAtRisk {
  studentId: string
  studentName: string
  studentNumber?: string
  sectionId: string
  sectionName: string
  subjectName: string
  professorName: string
  thresholdPercent: number
  attendanceRate: number | null
  status: AttendanceStandingStatus
  absencesBeforeBelowThreshold: number | null
  lastAbsenceDate?: string
}

// ── F5 (WF-LD7): CHED CMO No. 40 notice-of-impending-drop referrals ──

/** Referral lifecycle. Any→any transitions are allowed (triage flexibility). */
export type ReferralStatus = 'generated' | 'acknowledged' | 'counseling_scheduled' | 'resolved'

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  generated: 'Generated',
  acknowledged: 'Acknowledged',
  counseling_scheduled: 'Counseling scheduled',
  resolved: 'Resolved',
}

export interface AtRiskReferral {
  id: string
  studentId: string
  studentName: string
  studentNumber?: string
  sectionId: string
  sectionName: string
  subjectName: string
  /** Section teacher of record. */
  professorName: string
  /** Uploader of the referral. */
  generatedById: string
  generatedByName: string
  status: ReferralStatus
  note?: string
  createdAt: string
  updatedAt: string
}

export interface AtRiskReferralFilters {
  status?: ReferralStatus
  sectionId?: string
}
