import type { AttendanceRecord } from '@polycheck/shared'

/**
 * WEB-08: a rejected dispute is restored to the status the student held before
 * filing (`disputePreviousStatus`, stamped at submit). Legacy rows carry no
 * stamp and fall back to `absent`, matching the backend resolver
 * (`record.disputePreviousStatus ?? 'absent'`).
 *
 * `disputePreviousStatus` is not part of the shared `AttendanceRecord` union
 * (ING-07 forbids widening `shared/` in this wave), so it is read through a
 * narrow local shape instead of `any`.
 */
type RecordWithPreviousStatus = AttendanceRecord & {
  disputePreviousStatus?: AttendanceRecord['status'] | null
}

export function disputePreviousStatusOf(record: AttendanceRecord): AttendanceRecord['status'] {
  return (record as RecordWithPreviousStatus).disputePreviousStatus ?? 'absent'
}

/** `late` -> `Late`, for status copy in toasts and confirmations. */
export function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}
