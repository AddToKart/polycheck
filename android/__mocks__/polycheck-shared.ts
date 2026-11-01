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
