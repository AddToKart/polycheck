import type { AttendanceStatus } from '@polycheck/shared'

/**
 * Disputed and excused records are waiting on, or came out of, a review. Changing them by hand would
 * rewrite that decision, so they are resolved in their own queue (the app applies the same rule).
 */
export function reviewQueueFor(status: AttendanceStatus): 'Disputes' | 'Excuses' | null {
  if (status === 'disputed') return 'Disputes'
  return status === 'excused' ? 'Excuses' : null
}
