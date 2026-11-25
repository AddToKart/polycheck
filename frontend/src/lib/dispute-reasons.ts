import type { ElementType } from 'react'
import {
  AlertTriangle,
  Clock,
  Copy,
  Cpu,
  Fingerprint,
  MapPin,
  ShieldAlert,
  Smartphone,
  Timer,
} from 'lucide-react'
import type { DisputeReason } from '@polycheck/shared'

/**
 * Dispute reason presentation maps (DD-C3). The backend can persist a wire
 * value the client does not know yet (`missing_scan_evidence` was exactly
 * that), so both lookups MUST fall back — an undefined map entry used as a
 * JSX element kills the whole page with "Element type is invalid".
 *
 * ING-07 (web half): the gateway and control plane persist reasons outside the
 * shared `DisputeReason` union (`missing_location`, `stale_location`,
 * `pin_mismatch`, …). The union is NOT widened here (that would ripple to
 * `android/`); instead every known wire reason gets a display entry and
 * anything unexpected renders as a humanized label with a safe icon.
 */

/** Reasons the gateway `writer`/`core/scan` and the control plane may persist. */
type GatewayDisputeReason =
  | 'missing_location'
  | 'missing_geofence'
  | 'geofence_uncertain'
  | 'stale_location'
  | 'poor_location_accuracy'
  | 'duplicate'
  | 'client_attempt_conflict'
  | 'replayed_rejection'
  | 'pin_mismatch'
  // Record-level reasons the control plane writes directly
  // (`AttendanceRecord.disputeReason`), or the gateway writer's commit-time
  // membership gate stamps.
  | 'expired_offline_activation'
  | 'student_blocked_from_section'
  | 'student_not_enrolled'
  | 'device_cooldown_active'
  | 'checkpoint_not_armed'

export type KnownDisputeReason = DisputeReason | GatewayDisputeReason

export const DISPUTE_LABELS: Record<KnownDisputeReason, string> = {
  outside_geofence: 'Outside Geofence',
  expired_token: 'Expired Token',
  duplicate_submission: 'Duplicate Submission',
  invalid_signature: 'Invalid Signature',
  device_mismatch: 'Device Mismatch',
  other: 'Other',
  suspicious_coordinates: 'Suspicious GPS',
  delayed_offline_sync: 'Delayed Offline Sync',
  invalid_timestamp: 'Invalid Timestamp',
  token_mismatch: 'QR Token Mismatch',
  session_inactive: 'Inactive Session',
  not_enrolled: 'Not Enrolled',
  qr_expired: 'QR Expired',
  rate_limited: 'Rate Limited',
  mocked_location: 'Mock GPS / Fake Location',
  rooted_device: 'Rooted / Jailbroken Device',
  hook_detected: 'Hooking Tool Detected',
  emulator_detected: 'Android Emulator Detected',
  concurrent_session_conflict: 'Concurrent Session',
  missing_scan_evidence: 'Missing Scan Evidence',
  implausible_client_timestamp: 'Implausible Client Timestamp',
  // Gateway-persisted reasons (ING-07).
  missing_location: 'Missing Location',
  missing_geofence: 'Missing Geofence',
  geofence_uncertain: 'Uncertain Location',
  stale_location: 'Stale Location',
  poor_location_accuracy: 'Poor Location Accuracy',
  duplicate: 'Duplicate Check-in',
  client_attempt_conflict: 'Conflicting Attempt',
  replayed_rejection: 'Replayed Rejection',
  pin_mismatch: 'Meeting PIN Mismatch',
  expired_offline_activation: 'Expired Offline Activation',
  student_blocked_from_section: 'Blocked From Section',
  student_not_enrolled: 'Not Enrolled',
  device_cooldown_active: 'Device Cooldown',
  checkpoint_not_armed: 'Checkpoint Not Open',
}

export const DISPUTE_ICONS: Record<KnownDisputeReason, ElementType> = {
  outside_geofence: MapPin,
  expired_token: Timer,
  duplicate_submission: Copy,
  invalid_signature: Fingerprint,
  device_mismatch: Smartphone,
  other: AlertTriangle,
  suspicious_coordinates: AlertTriangle,
  delayed_offline_sync: Clock,
  invalid_timestamp: Clock,
  token_mismatch: Fingerprint,
  session_inactive: Timer,
  not_enrolled: AlertTriangle,
  qr_expired: Timer,
  rate_limited: AlertTriangle,
  mocked_location: AlertTriangle,
  rooted_device: ShieldAlert,
  hook_detected: Cpu,
  emulator_detected: Smartphone,
  concurrent_session_conflict: Clock,
  missing_scan_evidence: AlertTriangle,
  implausible_client_timestamp: Clock,
  // Gateway-persisted reasons (ING-07).
  missing_location: MapPin,
  missing_geofence: MapPin,
  geofence_uncertain: MapPin,
  stale_location: Clock,
  poor_location_accuracy: MapPin,
  duplicate: Copy,
  client_attempt_conflict: Copy,
  replayed_rejection: Copy,
  pin_mismatch: Fingerprint,
  expired_offline_activation: Timer,
  student_blocked_from_section: ShieldAlert,
  student_not_enrolled: AlertTriangle,
  device_cooldown_active: Smartphone,
  checkpoint_not_armed: Timer,
}

/**
 * Fallback for a wire value neither map knows: `some_new_reason` ->
 * `Some New Reason`. Never returns an empty string, so the label slot can
 * never render blank.
 */
export function humanizeDisputeReason(reason: string): string {
  const text = reason.trim().replace(/[_-]+/g, ' ')
  if (!text) return 'Unknown Reason'
  return text.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function disputeReasonLabel(reason: KnownDisputeReason | string | undefined): string {
  if (!reason) return 'Unknown'
  return DISPUTE_LABELS[reason as KnownDisputeReason] ?? humanizeDisputeReason(reason)
}

export function disputeReasonIcon(reason: KnownDisputeReason | string | undefined): ElementType {
  if (!reason) return AlertTriangle
  return DISPUTE_ICONS[reason as KnownDisputeReason] ?? AlertTriangle
}
