import type { AttendanceStanding } from '@polycheck/shared'

/**
 * Picks the one standing worth surfacing on the student dashboard. Alerts are
 * ranked by urgency, not by array order: a below-threshold section always wins
 * over an at-risk one, then the lowest attendance rate wins.
 */
export function pickStandingAlert(standings: AttendanceStanding[]): AttendanceStanding | null {
  const candidates = standings.filter(
    (standing) => typeof standing.attendanceRate === 'number' && Number.isFinite(standing.attendanceRate),
  )

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

/**
 * Mobile equivalent of the web's per-session dismissal: a module-level Set
 * survives for the lifetime of the app process (until the app is killed).
 */
const dismissedStandings = new Set<string>()

export function standingDismissKey(userId: string, sectionId: string): string {
  return `${userId}:${sectionId}`
}

export function isStandingAlertDismissed(userId: string, sectionId: string): boolean {
  return dismissedStandings.has(standingDismissKey(userId, sectionId))
}

export function dismissStandingAlert(userId: string, sectionId: string): void {
  dismissedStandings.add(standingDismissKey(userId, sectionId))
}

/** Clears process-lifetime dismissals (used on sign-out and in tests). */
export function clearStandingDismissals(): void {
  dismissedStandings.clear()
}

/**
 * Floor to one decimal so a below-threshold rate never rounds up to the
 * minimum (e.g. 74.96% must not display as 75%).
 */
export function formatStandingRate(rate: number): string {
  const floored = Math.floor(Math.max(0, rate) * 10) / 10
  return Number.isInteger(floored) ? String(floored) : floored.toFixed(1)
}
