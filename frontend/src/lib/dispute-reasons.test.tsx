import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DISPUTE_ICONS,
  DISPUTE_LABELS,
  disputeReasonIcon,
  disputeReasonLabel,
  humanizeDisputeReason,
} from './dispute-reasons'

/**
 * ING-07 (web half): the gateway writer and the control-plane validator persist
 * reasons outside the shared `DisputeReason` union (the union is deliberately
 * NOT widened - that would ripple to `android/`). Every one of those wire values
 * needs a display entry, and any future value must degrade to a humanized label
 * with a safe icon instead of crashing the disputes page.
 *
 * Source of truth for this list:
 *  - `services/ingest/src/core/scan.ts` `failed(...)` calls (validator reasons),
 *  - `services/ingest/src/writer.ts` commit-time membership gate,
 *  - `backend/src/attendance/attendance.service.ts` record-level stamps
 *    (`expired_offline_activation`, `suspicious_coordinates`).
 * Keeping this local copy explicit is intentional: it must fail when a new
 * persisted reason appears without a display entry.
 */
const GATEWAY_PERSISTED_REASONS = [
  // ingest gateway validator (`core/scan.ts`)
  'missing_location',
  'missing_geofence',
  'geofence_uncertain',
  'stale_location',
  'poor_location_accuracy',
  'pin_mismatch',
  'checkpoint_not_armed',
  // control-plane denial funnels / replay classification
  'duplicate',
  'client_attempt_conflict',
  'replayed_rejection',
  // gateway writer commit-time membership gate
  'student_blocked_from_section',
  'student_not_enrolled',
  'device_cooldown_active',
  // control-plane record stamps
  'expired_offline_activation',
] as const

const GATEWAY_REASON_LABELS: Record<(typeof GATEWAY_PERSISTED_REASONS)[number], string> = {
  missing_location: 'Missing Location',
  missing_geofence: 'Missing Geofence',
  geofence_uncertain: 'Uncertain Location',
  stale_location: 'Stale Location',
  poor_location_accuracy: 'Poor Location Accuracy',
  pin_mismatch: 'Meeting PIN Mismatch',
  checkpoint_not_armed: 'Checkpoint Not Open',
  duplicate: 'Duplicate Check-in',
  client_attempt_conflict: 'Conflicting Attempt',
  replayed_rejection: 'Replayed Rejection',
  student_blocked_from_section: 'Blocked From Section',
  student_not_enrolled: 'Not Enrolled',
  device_cooldown_active: 'Device Cooldown',
  expired_offline_activation: 'Expired Offline Activation',
}

const SHARED_UNION_REASONS = [
  'outside_geofence',
  'expired_token',
  'duplicate_submission',
  'invalid_signature',
  'device_mismatch',
  'other',
  'suspicious_coordinates',
  'delayed_offline_sync',
  'missing_scan_evidence',
  'invalid_timestamp',
  'implausible_client_timestamp',
  'token_mismatch',
  'session_inactive',
  'not_enrolled',
  'qr_expired',
  'rate_limited',
  'mocked_location',
  'rooted_device',
  'hook_detected',
  'emulator_detected',
  'concurrent_session_conflict',
] as const

describe('dispute reason labels (ING-07 web)', () => {
  it('labels and icons every gateway-persisted reason', () => {
    for (const reason of GATEWAY_PERSISTED_REASONS) {
      expect(disputeReasonLabel(reason)).not.toBe('Unknown')
      expect(disputeReasonLabel(reason)).not.toBe('')
      expect(disputeReasonIcon(reason)).toBeTypeOf('object')
      // The exact copy matters: a humanized fallback would silently mask a
      // missing map entry, so pin the intended string.
      expect(disputeReasonLabel(reason)).toBe(GATEWAY_REASON_LABELS[reason])
    }
  })

  it('keeps every shared-union reason labelled (no regression)', () => {
    for (const reason of SHARED_UNION_REASONS) {
      expect(disputeReasonLabel(reason)).not.toBe('Unknown')
      expect(disputeReasonIcon(reason)).toBeTypeOf('object')
    }
  })

  it('renders an icon element for every entry in both maps', () => {
    for (const reason of [...GATEWAY_PERSISTED_REASONS, ...SHARED_UNION_REASONS]) {
      const Icon = disputeReasonIcon(reason)
      expect(() => render(<Icon aria-hidden="true" />)).not.toThrow()
    }
  })

  it('humanizes an unknown wire value instead of showing a blank/undefined', () => {
    expect(disputeReasonLabel('future_reason_from_the_backend')).toBe(
      'Future Reason From The Backend',
    )
    expect(disputeReasonLabel('new-cause')).toBe('New Cause')
    expect(disputeReasonLabel('')).toBe('Unknown')
    expect(disputeReasonLabel(undefined)).toBe('Unknown')
    expect(disputeReasonIcon('future_reason_from_the_backend')).toBe(DISPUTE_ICONS.other)
  })

  it('humanizeDisputeReason never returns an empty label', () => {
    expect(humanizeDisputeReason('some_reason')).toBe('Some Reason')
    expect(humanizeDisputeReason('  multi__part--value ')).toBe('Multi Part Value')
    expect(humanizeDisputeReason('   ')).toBe('Unknown Reason')
  })

  it('has equal coverage between the label and icon maps', () => {
    expect(Object.keys(DISPUTE_LABELS).sort()).toEqual(Object.keys(DISPUTE_ICONS).sort())
  })
})
