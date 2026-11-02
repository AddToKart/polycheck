import { formatCampusDate, type Session } from '@polycheck/shared'

export type SessionListStatus = 'active' | 'scheduled' | 'completed' | 'rescheduled'

type SessionTiming = Pick<
  Session,
  'isActive' | 'endedAt' | 'isRescheduled' | 'rescheduledFromDate' | 'date'
>

/**
 * Client-side lifecycle status used by the sessions list filter. The backend
 * has no single `status` field, so derive it deterministically:
 * live > completed > rescheduled > scheduled.
 */
export function deriveSessionStatus(session: SessionTiming, today = formatCampusDate()): SessionListStatus {
  if (session.isActive) return 'active'
  if (session.endedAt || session.date < today) return 'completed'
  if (session.isRescheduled || session.rescheduledFromDate) return 'rescheduled'
  return 'scheduled'
}

export const SESSION_STATUS_LABELS: Record<SessionListStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  completed: 'Completed',
  rescheduled: 'Rescheduled',
}
