import type { AttendanceRecord, AttendanceStatus } from '../types/attendance'

/** Statuses that mean the student's check-in (or a decision about it) already exists. */
const CHECKED_IN: ReadonlySet<AttendanceStatus> = new Set(['present', 'late', 'incomplete', 'excused', 'disputed'])

type SavedAttendance = Pick<
  AttendanceRecord,
  'status' | 'checkInTime' | 'checkInStatus' | 'checkOutTime' | 'checkOutStatus'
>

/**
 * Whether a saved record shows this student has already checked in.
 *
 * Starting a class creates a `pending` row for every enrolled student before anyone has scanned, so the
 * existence of a row proves nothing. Mirrored in
 * `polycheck_mobile/lib/src/features/student/data/student_scan_service.dart`.
 */
export function hasCheckedIn(record: SavedAttendance, online: boolean, checkpoint?: 'start' | 'end' | null): boolean {
  if (!online) return CHECKED_IN.has(record.status)
  const time = checkpoint === 'end' ? record.checkOutTime : record.checkInTime
  const status = checkpoint === 'end' ? record.checkOutStatus : record.checkInStatus
  return Boolean(time) || (status != null && CHECKED_IN.has(status))
}
