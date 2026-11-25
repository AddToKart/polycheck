import { FINALE_COUNT_STATUSES, type AttendanceRecord, type FinaleCountStatus } from '@polycheck/shared'

/**
 * F1 finale count math, extracted so the degraded path is unit-testable.
 *
 * WEB-06: the kiosk's "ended" fallback used to compute its counts from the
 * return value of the final refetch. A failed refetch produced `[]`, which the
 * count helper turned into all zeros - the projector celebrated a class where
 * nobody showed up. The status map maintained by the live socket deltas is the
 * best truth available then, so the fallback derives counts from it.
 */

export function recordsToCounts(records: AttendanceRecord[]): Record<FinaleCountStatus, number> {
  const totals: Record<FinaleCountStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    incomplete: 0,
    disputed: 0,
    pending: 0,
  }
  for (const record of records) {
    if ((FINALE_COUNT_STATUSES as readonly string[]).includes(record.status)) {
      totals[record.status as FinaleCountStatus] += 1
    }
  }
  return totals
}

/**
 * Counts for the broadcast-less fallback finale.
 *
 * - A successful refetch is authoritative: count its records.
 * - A failed refetch (`null`) falls back to the last observed per-record
 *   statuses. Zero rows only when no record was ever seen (a genuinely empty
 *   session), never because the network blipped.
 */
export function finaleCountsForFallback(
  finalRecords: AttendanceRecord[] | null,
  statuses: ReadonlyMap<string, string>,
): Record<FinaleCountStatus, number> {
  if (finalRecords !== null) return recordsToCounts(finalRecords)
  if (statuses.size === 0) return recordsToCounts([])
  const totals: Record<FinaleCountStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    incomplete: 0,
    disputed: 0,
    pending: 0,
  }
  for (const status of statuses.values()) {
    if ((FINALE_COUNT_STATUSES as readonly string[]).includes(status)) {
      totals[status as FinaleCountStatus] += 1
    }
  }
  return totals
}
