import { SHARED_DISPUTE_REASON_SET, isSharedDisputeReason, unknownDisputeReason } from './dispute-reason'

describe('dispute reason classification (ING-07)', () => {
  it('accepts every reason the shared contract declares', () => {
    // Pin the count so a union widening that forgets this allowlist fails here
    // rather than silently reporting "unknown" in production logs.
    expect(SHARED_DISPUTE_REASON_SET.size).toBe(21)
    for (const reason of SHARED_DISPUTE_REASON_SET) {
      expect(isSharedDisputeReason(reason)).toBe(true)
    }
  })

  it('classifies gateway-only validator reasons as unknown without rejecting them', () => {
    for (const reason of [
      'missing_location',
      'stale_location',
      'geofence_uncertain',
      'poor_location_accuracy',
      'pin_mismatch',
      'pin_incorrect',
      'pin_locked',
      'pin_required',
      'missing_geofence',
      'client_attempt_conflict',
      'missing_scan_evidence',
    ]) {
      const expectedUnknown = reason === 'missing_scan_evidence' ? null : reason
      expect(unknownDisputeReason(reason)).toBe(expectedUnknown)
    }
  })

  it('treats absent reasons as nothing to report', () => {
    expect(unknownDisputeReason(null)).toBeNull()
    expect(unknownDisputeReason(undefined)).toBeNull()
    expect(unknownDisputeReason('')).toBeNull()
    expect(isSharedDisputeReason(null)).toBe(false)
  })

  it('returns the offending value verbatim so a log line is actionable', () => {
    expect(unknownDisputeReason('some_future_reason')).toBe('some_future_reason')
  })
})
