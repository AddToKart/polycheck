/**
 * Shared shape for the 403 bodies returned by the device-integrity login
 * gates. Both clients branch on `code` and can render a countdown from
 * `remainingSeconds` (exact, rounded up) while older clients keep using
 * `remainingMinutes`.
 */
export type ActiveDeviceKind = 'mobile' | 'web'

export interface DeviceIntegrityErrorPayload {
  code: 'device_cooldown_active' | 'active_session_elsewhere'
  message?: string
  /** Whole minutes remaining, rounded up. Kept for pre-countdown clients. */
  remainingMinutes?: number
  /** Exact whole seconds remaining, rounded up. Drives the live countdown. */
  remainingSeconds?: number
  /** Device kind holding the blocking session; null when it predates device stamping. */
  activeDeviceKind?: ActiveDeviceKind | null
  /** ISO timestamp of the blocking session's last activity. */
  activeSessionLastActiveAt?: string
}
