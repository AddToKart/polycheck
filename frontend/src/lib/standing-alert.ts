import type { AttendanceStanding } from '@polycheck/shared'

/**
 * Picks the one standing worth surfacing on the student dashboard. Alerts are
 * ranked by urgency, not by array order: a below-threshold section always wins
 * over an at-risk one, then the lowest attendance rate wins.
 */
export function pickStandingAlert(standings: AttendanceStanding[]): AttendanceStanding | null {
  const candidates = standings.filter((standing) => standing.attendanceRate !== null)

  const pickLowest = (status: AttendanceStanding['status']) => {
    const matching = candidates.filter((standing) => standing.status === status)
    if (matching.length === 0) return null
    return matching.reduce((lowest, standing) =>
      (standing.attendanceRate ?? Number.POSITIVE_INFINITY) <
      (lowest.attendanceRate ?? Number.POSITIVE_INFINITY)
        ? standing
        : lowest,
    )
  }

  return pickLowest('below_threshold') ?? pickLowest('at_risk')
}

/** Per-tab dismissal key (sessionStorage) for the standing notice. */
export function standingSessionDismissKey(userId: string, sectionId: string): string {
  return `polycheck-standing-dismissed:${userId}:${sectionId}`
}
