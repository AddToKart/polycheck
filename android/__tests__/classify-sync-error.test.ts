import { classifyAttendanceSyncError } from '../services/api-client'

describe('classifyAttendanceSyncError', () => {
  describe('terminal errors (should not retry)', () => {
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
    ])('classifies "%s" as terminal', (errorMessage) => {
      const result = classifyAttendanceSyncError(errorMessage)
      expect(result).toEqual({ outcome: 'terminal', error: errorMessage })
    })

    it('is case-insensitive for terminal matching', () => {
      const result = classifyAttendanceSyncError('SIGNATURE IS INVALID')
      expect(result.outcome).toBe('terminal')
    })

    it('matches partial strings', () => {
      const result = classifyAttendanceSyncError('Server says: signature is invalid for this token')
      expect(result.outcome).toBe('terminal')
    })
  })

  describe('retryable errors (should retry)', () => {
    it.each([
      'Network request failed',
      'Request timeout',
      'Internal server error',
      'Service unavailable',
      'Something went wrong',
      'fetch failed',
    ])('classifies "%s" as retryable', (errorMessage) => {
      const result = classifyAttendanceSyncError(errorMessage)
      expect(result.outcome).toBe('retryable')
      expect(result.error).toBe(errorMessage)
    })

    it('classifies an empty string as retryable', () => {
      const result = classifyAttendanceSyncError('')
      expect(result.outcome).toBe('retryable')
    })

    it('classifies unknown errors as retryable', () => {
      const result = classifyAttendanceSyncError('totally unexpected error xyz')
      expect(result.outcome).toBe('retryable')
    })
  })

  describe('return type', () => {
    it('always returns an OfflineSendResult with outcome and error', () => {
      const result = classifyAttendanceSyncError('test')
      expect(result).toHaveProperty('outcome')
      expect(result).toHaveProperty('error')
      expect(typeof result.outcome).toBe('string')
      expect(typeof result.error).toBe('string')
    })

    it('preserves the original error message', () => {
      const msg = 'User is not enrolled in this section'
      const result = classifyAttendanceSyncError(msg)
      expect(result.error).toBe(msg)
    })
  })
})
