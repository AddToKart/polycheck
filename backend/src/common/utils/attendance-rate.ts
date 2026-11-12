import type { AttendanceStandingStatus } from '@polycheck/shared'

/**
 * Single source of truth for attendance math (DD-B3).
 *
 * The at-risk list, `/me/standing`, the class-record grid and the CHED notice
 * must never disagree about a student. `pending`, `disputed` and `excused`
 * rows are excluded; a half-attended (`incomplete`, one checkpoint only)
 * session counts in the denominator but not the numerator, so it can never
 * inflate a rate while staying visible and excusable.
 */
export interface AttendanceRateCounts {
  present: number
  late: number
  absent: number
  incomplete: number
}

export interface AttendanceRate {
  countedSessions: number
  attendedSessions: number
  /** Percentage of counted sessions attended, rounded to one decimal; null with no data. */
  attendanceRate: number | null
}

export interface AttendanceStanding {
  absencesBeforeBelowThreshold: number | null
  status: AttendanceStandingStatus
}

export function computeAttendanceRate(counts: AttendanceRateCounts): AttendanceRate {
  const countedSessions = counts.present + counts.late + counts.absent + counts.incomplete
  const attendedSessions = counts.present + counts.late
  const attendanceRate = countedSessions === 0 ? null : Math.round((attendedSessions / countedSessions) * 1000) / 10
  return { countedSessions, attendedSessions, attendanceRate }
}

export function attendanceStandingFromRate(
  rate: Pick<AttendanceRate, 'countedSessions' | 'attendedSessions' | 'attendanceRate'>,
  thresholdPercent: number,
): AttendanceStanding {
  const absencesBeforeBelowThreshold =
    rate.countedSessions === 0 || thresholdPercent <= 0
      ? null
      : Math.max(0, Math.floor((rate.attendedSessions * 100) / thresholdPercent) - rate.countedSessions)
  const status: AttendanceStandingStatus =
    rate.countedSessions === 0
      ? 'insufficient_data'
      : rate.attendanceRate! < thresholdPercent
        ? 'below_threshold'
        : absencesBeforeBelowThreshold === 0
          ? 'at_risk'
          : 'on_track'
  return { absencesBeforeBelowThreshold, status }
}
