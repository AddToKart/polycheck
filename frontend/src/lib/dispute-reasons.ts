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
 */
export const DISPUTE_LABELS: Record<DisputeReason, string> = {
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
}

export const DISPUTE_ICONS: Record<DisputeReason, ElementType> = {
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
}

export function disputeReasonLabel(reason: DisputeReason | string | undefined): string {
  if (!reason) return 'Unknown'
  return DISPUTE_LABELS[reason as DisputeReason] ?? 'Unknown'
}

export function disputeReasonIcon(reason: DisputeReason | string | undefined): ElementType {
  if (!reason) return AlertTriangle
  return DISPUTE_ICONS[reason as DisputeReason] ?? AlertTriangle
}
