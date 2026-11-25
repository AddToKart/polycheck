import type { DisputeReason } from '@polycheck/shared'

/**
 * Runtime allowlist of the persisted `disputeReason` values the shared contract
 * names. `AttendanceRecord.disputeReason` is a plain string column because the
 * gateway persists validator reasons (location/geofence/PIN classes) that the
 * shared union intentionally does not declare — widening that union would ripple
 * into the Expo client.
 *
 * The list is derived from the union at compile time so it cannot drift: adding
 * a member to `DisputeReason` without adding it here is a type error.
 */
const SHARED_DISPUTE_REASONS = [
  'outside_geofence',
  'expired_token',
  'duplicate_submission',
  'invalid_signature',
  'device_mismatch',
  'suspicious_coordinates',
  'other',
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
] as const satisfies readonly DisputeReason[]

export const SHARED_DISPUTE_REASON_SET: ReadonlySet<string> = new Set(SHARED_DISPUTE_REASONS)

/**
 * True when a persisted reason is part of the shared contract. An unknown reason
 * is not an error — the column is valid data — it just means a client may not
 * have a label for it, which is exactly what we want to observe.
 */
export function isSharedDisputeReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && SHARED_DISPUTE_REASON_SET.has(reason)
}

/**
 * Classifies one persisted reason for observability: `null` when it is absent or
 * contract-known, otherwise the unknown value itself so a log line can carry it.
 */
export function unknownDisputeReason(reason: string | null | undefined): string | null {
  if (reason === null || reason === undefined || reason === '') return null
  return isSharedDisputeReason(reason) ? null : reason
}
