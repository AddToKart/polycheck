/**
 * Classifies attendance-sync failures for offline queues (web + mobile).
 *
 * Terminal failures mean the server evaluated the evidence and rejected it —
 * retrying would only burn attempts. Everything else (network, timeout, 5xx,
 * unknown) stays retryable so evidence is never discarded on transient faults.
 */
export type AttendanceSyncErrorClassification = {
  outcome: 'retryable' | 'terminal'
  error: string
}

const TERMINAL_EVIDENCE_FAILURES = [
  'signature is invalid',
  'does not match this session',
  'outside the session geofence',
  'mocked locations are not accepted',
  'location accuracy is too poor',
  'location fix is stale',
  'location uncertainty extends outside',
  'scan timestamp is invalid',
  'attendance window has expired',
  'already submitted for this session',
  'not enrolled in this section',
  'clientattemptid was already used',
]

export function classifyAttendanceSyncError(error: string): AttendanceSyncErrorClassification {
  const message = error.toLowerCase()
  return TERMINAL_EVIDENCE_FAILURES.some((failure) => message.includes(failure))
    ? { outcome: 'terminal', error }
    : { outcome: 'retryable', error }
}
