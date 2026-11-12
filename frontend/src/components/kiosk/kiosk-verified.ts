import type { FinaleCountStatus } from '@polycheck/shared'

/** Statuses that count as a verified check-in for the kiosk capacity ring. */
const CHECKED_IN_STATUSES: Readonly<Record<string, true>> = {
  present: true,
  late: true,
  incomplete: true,
}

export function isCheckedInStatus(status: string): boolean {
  return CHECKED_IN_STATUSES[status] === true
}

/**
 * The kiosk ring must follow the authoritative status, including a cockpit
 * override (present→absent or absent→present). Applying each event as a delta
 * from the previously-seen status keeps the projector in sync with the roster
 * without double counting a replayed event.
 */
export function verifiedDelta(previousStatus: string | undefined, nextStatus: string): number {
  const wasChecked = previousStatus !== undefined && isCheckedInStatus(previousStatus)
  const isChecked = isCheckedInStatus(nextStatus)
  if (wasChecked === isChecked) return 0
  return isChecked ? 1 : -1
}

/** Type-level guard that the table above covers the wire statuses it claims. */
export type KioskCheckedInStatus = Extract<FinaleCountStatus, 'present' | 'late' | 'incomplete'>
