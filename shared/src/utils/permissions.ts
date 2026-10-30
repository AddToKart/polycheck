/** Pure account-governance helpers shared by web, mobile, and backend tests. */

/**
 * Resolves a nullable per-teacher override against the institution policy.
 * The institution switch is a master gate: an override can restrict a teacher
 * further, but it can never enable a capability the institution disabled.
 */
export function effectivePermission(
  override: boolean | null | undefined,
  settingEnabled: boolean,
): boolean {
  if (!settingEnabled) return false
  return override ?? true
}

/** Remaining whole minutes of an active device cooldown, or null when inactive/expired. */
export function cooldownRemainingMinutes(
  cooldownUntil: string | Date | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!cooldownUntil) return null
  const untilMs = typeof cooldownUntil === 'string' ? Date.parse(cooldownUntil) : cooldownUntil.getTime()
  if (!Number.isFinite(untilMs)) return null
  const remainingMs = untilMs - nowMs
  if (remainingMs <= 0) return null
  return Math.ceil(remainingMs / 60_000)
}

/** Human-readable cooldown duration, e.g. "1 h 23 min" or "45 min". */
export function formatCooldownRemaining(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const whole = Math.ceil(minutes)
  if (whole < 60) return `${whole} min`
  const hours = Math.floor(whole / 60)
  const remainder = whole % 60
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`
}
