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
