import type { AttendanceRecord, Session } from '@polycheck/shared'

/**
 * Civil-date helpers mirroring `@polycheck/shared/utils` without importing the
 * shared runtime (Android jest runs against a small manual mock).
 */
const PUP_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'upcoming7'

export function campusDate(date = new Date()): string {
  return new Date(date.getTime() + PUP_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10)
}

/** Last-N-days or next-N-days campus calendar range. `all` means no bound. */
export function datePresetRange(
  preset: DatePreset,
  now = new Date(),
): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {}
  const today = campusDate(now)
  if (preset === 'today') return { startDate: today, endDate: today }
  if (preset === 'upcoming7') {
    const end = new Date(now.getTime() + PUP_TIMEZONE_OFFSET_MS)
    end.setUTCDate(end.getUTCDate() + 6)
    return { startDate: today, endDate: end.toISOString().slice(0, 10) }
  }
  const days = preset === '7d' ? 7 : 30
  const start = new Date(now.getTime() + PUP_TIMEZONE_OFFSET_MS)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: start.toISOString().slice(0, 10), endDate: today }
}

export function isInDateRange(
  value: string | undefined,
  startDate?: string,
  endDate?: string,
): boolean {
  if (!value) return !startDate && !endDate
  const date = value.slice(0, 10)
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false
  return true
}

export type AttendanceFilters = {
  status?: AttendanceRecord['status'] | 'all'
  subjectId?: string
  sectionId?: string
  startDate?: string
  endDate?: string
}

/**
 * Client-side attendance filtering. `subjectForSection` resolves a section to
 * its parent subject so the subject filter works against the roster map the
 * screen already has.
 */
export function filterAttendanceRecords(
  records: AttendanceRecord[],
  filters: AttendanceFilters,
  subjectForSection?: (sectionId: string) => string | undefined,
): AttendanceRecord[] {
  return records.filter((record) => {
    if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false
    if (filters.sectionId && record.sectionId !== filters.sectionId) return false
    if (filters.subjectId && (subjectForSection?.(record.sectionId) ?? '') !== filters.subjectId) return false
    return isInDateRange(record.timestamp, filters.startDate, filters.endDate)
  })
}

export type SessionStatusFilter = 'all' | 'active' | 'completed' | 'upcoming'
export type SessionStatus = Exclude<SessionStatusFilter, 'all'>

export function sessionStatus(session: Session, today = campusDate()): SessionStatus {
  if (session.isActive) return 'active'
  if (session.endedAt || session.date < today) return 'completed'
  return 'upcoming'
}

export type SessionFilters = {
  subjectId?: string
  sectionId?: string
  status?: SessionStatusFilter
  startDate?: string
  endDate?: string
}

export function filterSessions(
  sessions: Session[],
  filters: SessionFilters,
  context: {
    today?: string
    subjectForSection?: (sectionId: string) => string | undefined
  } = {},
): Session[] {
  const today = context.today ?? campusDate()
  return sessions.filter((session) => {
    if (filters.sectionId && session.sectionId !== filters.sectionId) return false
    if (filters.subjectId && (context.subjectForSection?.(session.sectionId) ?? '') !== filters.subjectId) return false
    if (filters.status && filters.status !== 'all' && sessionStatus(session, today) !== filters.status) return false
    return isInDateRange(session.date, filters.startDate, filters.endDate)
  })
}
