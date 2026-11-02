/** Institution-level maintenance mode contracts shared by web, mobile, and backend. */

/** Canonical 503 body published while maintenance mode is active. */
export interface MaintenanceBlockBody {
  code: 'system_maintenance'
  message: string
  estimatedEnd?: string
}

/** Public, unauthenticated snapshot served by GET /maintenance/status. */
export interface MaintenanceStatus {
  enabled: boolean
  message?: string
  estimatedEnd?: string
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Polycheck is undergoing scheduled maintenance. Attendance taken during class still works offline — your records are safely stored on this device and will sync when servers reopen.'

export const MAINTENANCE_SETTING_KEYS = [
  'maintenance_mode_enabled',
  'maintenance_message',
  'maintenance_until',
] as const

export type MaintenanceSettingKey = (typeof MAINTENANCE_SETTING_KEYS)[number]

export function isMaintenanceSettingKey(key: string): key is MaintenanceSettingKey {
  return (MAINTENANCE_SETTING_KEYS as readonly string[]).includes(key)
}

/** Public metadata endpoint path (public, exempt from the maintenance guard). */
export const MAINTENANCE_STATUS_PATH = '/maintenance/status'

/**
 * In-process event emitted when a maintenance setting is written. The
 * maintenance state service subscribes to invalidate its memo + Redis snapshot.
 */
export const MAINTENANCE_SETTINGS_CHANGED_EVENT = 'settings.maintenance-changed'
