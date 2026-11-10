// Mock @polycheck/shared for Jest

// Mirrors shared/src/utils/classify-sync-error.ts (manual mock must stay in sync).
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

export function classifyAttendanceSyncError(error: string): { outcome: 'retryable' | 'terminal'; error: string } {
  const message = error.toLowerCase()
  return TERMINAL_EVIDENCE_FAILURES.some((failure) => message.includes(failure))
    ? { outcome: 'terminal', error }
    : { outcome: 'retryable', error }
}

export function isWithinGeofence(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  radiusMeters: number,
): boolean {
  const R = 6371000
  const dLat = ((centerLat - lat) * Math.PI) / 180
  const dLng = ((centerLng - lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) * Math.cos((centerLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMeters
}

export function signQRToken(_payload: unknown, _secretKey: string): string {
  return 'signed-token-placeholder'
}

// Decodes the unsigned payload segment of a QR token (`<base64url(JSON payload)>.<signature>`).
// Signature verification is intentionally skipped in tests; any parse failure returns null so the
// offline pipeline can exercise its invalid-signature paths.
export function verifyQRToken(token: string, _publicKey: string): unknown {
  try {
    const encoded = token.split('.')[0]
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64').toString('utf8')
    return decoded ? JSON.parse(decoded) : null
  } catch {
    return null
  }
}

export function createSigningKeyPair(_seed: Uint8Array) {
  return { publicKey: 'test-public-key', secretKey: 'test-secret-key' }
}

// Mirrors shared/src/utils/designations.ts (manual mock must stay in sync).
export const DEFAULT_MAINTENANCE_MESSAGE =
  'Polycheck is undergoing scheduled maintenance. Attendance taken during class still works offline — your records are safely stored on this device and will sync when servers reopen.'

export const MAINTENANCE_STATUS_PATH = '/maintenance/status'

export const MAINTENANCE_SETTINGS_CHANGED_EVENT = 'settings.maintenance-changed'

const DESIGNATION_FLAGS: Record<string, string> = {
  it_operations: 'isItCoordinator',
  academic_oversight: 'isDepartmentHead',
  user_admin: 'isUserRegistrar',
}

function teacherHasFlag(user: any, flag: string): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.role === 'teacher' && user[flag] === true
}

export function hasDesignation(user: any, designation: string): boolean {
  return teacherHasFlag(user, DESIGNATION_FLAGS[designation])
}

export function canAccessItOperations(user: any): boolean {
  return teacherHasFlag(user, 'isItCoordinator')
}

export function canAccessAcademicOversight(user: any): boolean {
  return teacherHasFlag(user, 'isDepartmentHead')
}

export function canAccessUserAdmin(user: any): boolean {
  return teacherHasFlag(user, 'isUserRegistrar')
}

export function isMaintenanceExempt(user: any): boolean {
  return teacherHasFlag(user, 'isItCoordinator')
}

export function activeDesignations(user: any): string[] {
  return Object.keys(DESIGNATION_FLAGS).filter((designation) => hasDesignation(user, designation))
}

export function oversightDepartment(user: any): string | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return null
  const department = user.department?.trim()
  return department ? department : null
}

// Mirrors shared/src/types/attendance.ts label maps (manual mock must stay in sync).
export const RECORD_TIMELINE_EVENT_KIND_LABELS = {
  activation: 'Activation',
  scan: 'Scan attempt',
  signature: 'Signature',
  queue: 'Queued on device',
  network: 'Network',
  sync: 'Sync',
  dispute: 'Dispute',
  decision: 'Decision',
  excuse: 'Excuse',
}

export const DISPUTE_RECOMMENDATION_LABELS = {
  accept: 'Accept',
  review: 'Review',
  reject: 'Reject',
}

// Mirrors shared/src/types/session.ts realtime event constants (F1/F2).
export const ATTENDANCE_ANOMALY_EVENT = 'attendance:anomaly'
export const SESSION_FINALE_EVENT = 'session:finale'
export const KIOSK_JOIN_EVENT = 'kiosk:join'
export const KIOSK_JOINED_EVENT = 'kiosk:joined'
export const KIOSK_LEAVE_EVENT = 'kiosk:leave'

// Mirrors shared/src/utils/calendar.ts getRecentCampusDateRange (manual mock must stay in sync).
const PUP_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000

export function getRecentCampusDateRange(days = 30, date = new Date()) {
  const normalizedDays = Math.max(1, Math.trunc(days))
  const campusDate = new Date(date.getTime() + PUP_TIMEZONE_OFFSET_MS)
  const endDate = campusDate.toISOString().slice(0, 10)
  campusDate.setUTCDate(campusDate.getUTCDate() - (normalizedDays - 1))
  return { startDate: campusDate.toISOString().slice(0, 10), endDate }
}

// Mirrors shared/src/utils/id-hologram.ts (manual mock must stay in sync).
export const HOLOGRAM_WATERMARK_TEXT = 'PUP-ID-VERIFIED' as const
export const HOLOGRAM_WEB_SESSION_CHIP = 'WEB-SESSION' as const
export const HOLOGRAM_DEVICE_CHIP_PREFIX = 'DEVICE-BOUND •·•·' as const
export const HOLOGRAM_DEVICE_CHIP_FULL_MASK = 'DEVICE-BOUND •·•·•·' as const

const EPOCH_FALLBACK_STAMP = '1970-01-01 00:00:00'

function hologramPad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatLiveUtcStamp(nowMs: number, offsetMs = 0): string {
  if (!Number.isFinite(nowMs) || !Number.isFinite(offsetMs)) {
    return EPOCH_FALLBACK_STAMP
  }
  const date = new Date(nowMs + offsetMs)
  return (
    `${hologramPad2(date.getUTCFullYear())}` +
    `-${hologramPad2(date.getUTCMonth() + 1)}` +
    `-${hologramPad2(date.getUTCDate())}` +
    ` ${hologramPad2(date.getUTCHours())}` +
    `:${hologramPad2(date.getUTCMinutes())}` +
    `:${hologramPad2(date.getUTCSeconds())}`
  )
}

export function maskDeviceChip(deviceId?: string | null): string {
  if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    return HOLOGRAM_WEB_SESSION_CHIP
  }
  const alphanumeric = deviceId.replace(/[^A-Za-z0-9]/g, '')
  if (alphanumeric.length < 4) {
    return HOLOGRAM_DEVICE_CHIP_FULL_MASK
  }
  const tail = alphanumeric.slice(-4)
  return `${HOLOGRAM_DEVICE_CHIP_PREFIX}${tail}`
}

export function buildWatermarkLine(stamp: string, chip: string): string {
  return `${HOLOGRAM_WATERMARK_TEXT} • LIVE UTC: ${stamp} • ${chip}`
}
// Mirrors shared/src/utils/outage-simulator.ts (manual mock must stay in sync).
export const SIMULATED_NETWORK_OUTAGE_MESSAGE = 'Simulated network outage (Polycheck simulator)'
let outageArmed = false
const outageListeners = new Set<(armed: boolean) => void>()
export function armOutage(): void {
  if (outageArmed) return
  outageArmed = true
  for (const listener of outageListeners) listener(true)
}
export function disarmOutage(): void {
  if (!outageArmed) return
  outageArmed = false
  for (const listener of outageListeners) listener(false)
}
export function isOutageArmed(): boolean {
  return outageArmed
}
export function subscribeToOutage(listener: (armed: boolean) => void): () => void {
  outageListeners.add(listener)
  listener(outageArmed)
  return () => {
    outageListeners.delete(listener)
  }
}
export function createSimulatedNetworkOutage(): TypeError {
  return new TypeError(SIMULATED_NETWORK_OUTAGE_MESSAGE)
}
export function formatOutageReceipt(sequence: number, operationId?: string | null): string {
  const id8 = operationId ? operationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : ''
  return `Receipt #${Number.isFinite(sequence) && sequence > 0 ? sequence : 0}${id8 ? ` · ${id8}` : ''}`
}

// Mirrors shared/src/types/at-risk.ts REFERRAL_STATUS_LABELS.
export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  generated: 'Generated',
  acknowledged: 'Acknowledged',
  counseling_scheduled: 'Counseling scheduled',
  resolved: 'Resolved',
}