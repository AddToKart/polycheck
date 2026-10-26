import type { AdminOverviewCounts, AdminOverviewHealth, AuditLogEntry } from '@polycheck/shared'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export type AdminHealthState = 'operational' | 'degraded' | 'unavailable'

export interface AdminHealthSummary {
  state: AdminHealthState
  label: string
  services: Array<{ label: string; ok: boolean }>
  /** Screen-reader friendly one-line summary of the probe. */
  statusLine: string
}

export function formatHealthTimestamp(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'unknown time'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function summarizeAdminHealth(health: AdminOverviewHealth): AdminHealthSummary {
  const services = [
    { label: 'Database', ok: health.database },
    { label: 'Redis', ok: health.redis },
  ]
  const state: AdminHealthState =
    health.status === 'unavailable'
      ? 'unavailable'
      : health.database && health.redis
        ? 'operational'
        : 'degraded'
  const label = state === 'operational' ? 'Operational' : state === 'degraded' ? 'Degraded' : 'Unavailable'
  const serviceLine = services
    .map((service) => `${service.label} ${service.ok ? 'connected' : 'unavailable'}`)
    .join('. ')
  return {
    state,
    label,
    services,
    statusLine: `System health: ${label}. ${serviceLine}. Checked ${formatHealthTimestamp(health.timestamp)}.`,
  }
}

export interface AccountSplit {
  key: 'faculty' | 'students'
  label: string
  active: number
  inactive: number
  total: number
  /** Rounded percentage of active accounts; safe when there are no accounts. */
  activePercent: number
}

export function buildAccountSplits(counts: AdminOverviewCounts): AccountSplit[] {
  const build = (key: AccountSplit['key'], label: string, active: number, inactive: number): AccountSplit => {
    const total = active + inactive
    return {
      key,
      label,
      active,
      inactive,
      total,
      activePercent: total > 0 ? Math.round((active / total) * 100) : 0,
    }
  }
  return [
    build('faculty', 'Faculty accounts', counts.activeFaculty, counts.disabledFaculty),
    build('students', 'Student accounts', counts.activeStudents, counts.disabledStudents),
  ]
}

/** Human-readable "2m ago" style timestamp for the recent-activity feed. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'Unknown time'
  const delta = now - then
  if (delta < MINUTE_MS) return 'Just now'
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`
  if (delta < 7 * DAY_MS) return `${Math.floor(delta / DAY_MS)}d ago`
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(then),
  )
}

export function formatActivityAction(action: string): string {
  const normalized = action.replace(/[._-]+/g, ' ').trim()
  if (!normalized) return 'Unknown action'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function activityOutcomeLabel(outcome: AuditLogEntry['outcome']): string {
  if (outcome === 'initiated') return 'Incomplete'
  if (outcome === 'succeeded') return 'Succeeded'
  return 'Failed'
}

export type ActivityOutcomeTone = 'success' | 'danger' | 'neutral'

export function activityOutcomeTone(outcome: AuditLogEntry['outcome']): ActivityOutcomeTone {
  if (outcome === 'succeeded') return 'success'
  if (outcome === 'failed') return 'danger'
  return 'neutral'
}
