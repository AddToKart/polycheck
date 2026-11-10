/**
 * Shared identifiers for the RA 10173 privacy center (F6). Kept in a neutral
 * module so `SettingsService` and the cron `MaintenanceService` can both
 * import them without creating a circular module graph — the shredder calls
 * into settings through injected DI, never through this module.
 */

/** Institution setting key for the geolocation retention window (7–90 days). */
export const GEOLOCATION_RETENTION_DAYS_KEY = 'geolocation_retention_days'

export const GEOLOCATION_RETENTION_DEFAULT_DAYS = 30

/**
 * Redis key holding the last nightly telemetry-shred summary (48 h TTL).
 * Deliberately NOT part of the institution settings table: it is operational
 * telemetry, not configuration, per the F6 design decision.
 */
export const PRIVACY_SHRED_LAST_RUN_REDIS_KEY = 'privacy:shred:last'

export const PRIVACY_SHRED_LAST_RUN_TTL_SECONDS = 48 * 60 * 60

/** Shape of the value stored at `PRIVACY_SHRED_LAST_RUN_REDIS_KEY`. */
export interface PrivacyShredRecord {
  lastRunAt: string
  recordsShredded: number
  attemptsShredded: number
}

/** Type-guard for values read back from Redis (or stale local fallbacks). */
export function isShredRecord(value: unknown): value is PrivacyShredRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PrivacyShredRecord>
  if (typeof candidate.lastRunAt !== 'string') return false
  if (Number.isNaN(Date.parse(candidate.lastRunAt))) return false
  if (typeof candidate.recordsShredded !== 'number' || !Number.isFinite(candidate.recordsShredded)) return false
  return typeof candidate.attemptsShredded === 'number' && Number.isFinite(candidate.attemptsShredded)
}
