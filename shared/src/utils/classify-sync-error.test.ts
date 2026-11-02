import { describe, expect, it } from 'vitest'
import { classifyAttendanceSyncError } from './classify-sync-error'

describe('classifyAttendanceSyncError', () => {
  it.each([
    'Signature is invalid',
    'Token does not match this session',
    'Location is outside the session geofence',
    'Mocked locations are not accepted',
    'Location accuracy is too poor',
    'Location fix is stale',
    'Location uncertainty extends outside the geofence',
    'Scan timestamp is invalid',
    'Attendance window has expired',
    'Already submitted for this session',
    'Not enrolled in this section',
    'ClientAttemptId was already used',
  ])('marks evidence rejection "%s" as terminal', (message) => {
    expect(classifyAttendanceSyncError(message)).toEqual({ outcome: 'terminal', error: message })
  })

  it.each([
    'Network request failed',
    'Request timeout',
    'Internal server error',
    'Service unavailable',
    '',
    'totally unexpected error xyz',
  ])('marks "%s" as retryable', (message) => {
    expect(classifyAttendanceSyncError(message)).toEqual({ outcome: 'retryable', error: message })
  })
})
