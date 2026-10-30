/** Deterministic attendance standing contract (AI4). */

export type AttendanceStandingStatus = 'on_track' | 'at_risk' | 'below_threshold' | 'insufficient_data'

export interface AttendanceStanding {
  sectionId: string
  subjectName: string
  subjectCode: string
  sectionName: string
  professorName: string
  thresholdPercent: number
  present: number
  late: number
  absent: number
  disputed: number
  /** Sessions that count toward the rate (present + late + absent). */
  countedSessions: number
  /** (present + late) / countedSessions as a 0-100 percentage; null with no data. */
  attendanceRate: number | null
  status: AttendanceStandingStatus
  /**
   * How many more counted absences the student can absorb before dropping below
   * the threshold at the current count. Null when insufficient data.
   */
  absencesBeforeBelowThreshold: number | null
  lastSessionDate?: string
  /** Human-readable data-quality note (e.g. disputed/pending records excluded). */
  caveat?: string
}
