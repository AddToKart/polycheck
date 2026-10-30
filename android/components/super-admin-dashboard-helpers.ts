import type {
  AdminOverviewCounts,
  AdminOverviewHealth,
  AdminScopeKind,
  AuditLogEntry,
  AuditOutcome,
} from '@polycheck/shared'

export type AdminHealthTone = 'healthy' | 'degraded' | 'unavailable'

export interface AdminHealthSummary {
  tone: AdminHealthTone
  label: string
  detail: string
  databaseOk: boolean
  redisOk: boolean
}

const HEALTH_UNAVAILABLE: AdminHealthSummary = {
  tone: 'unavailable',
  label: 'Status unavailable',
  detail: 'The health probe has not reported yet.',
  databaseOk: false,
  redisOk: false,
}

/** Maps the admin-overview health probe into label + tone for the dashboard. */
export function summarizeAdminHealth(health: AdminOverviewHealth | null | undefined): AdminHealthSummary {
  if (!health) return HEALTH_UNAVAILABLE

  const databaseOk = health.database === true
  const redisOk = health.redis === true
  if (health.status === 'ok' && databaseOk && redisOk) {
    return {
      tone: 'healthy',
      label: 'All systems operational',
      detail: 'Database and cache are responding.',
      databaseOk,
      redisOk,
    }
  }

  const failed = [
    !databaseOk ? 'database' : null,
    !redisOk ? 'cache' : null,
  ].filter(Boolean)
  if (failed.length === 0) {
    return {
      tone: 'degraded',
      label: 'Degraded service',
      detail: 'The health probe reported the service as unavailable.',
      databaseOk,
      redisOk,
    }
  }
  if (failed.length === 2) {
    return {
      tone: 'unavailable',
      label: 'Service unavailable',
      detail: 'Database and cache are not responding.',
      databaseOk,
      redisOk,
    }
  }
  return {
    tone: 'degraded',
    label: 'Degraded service',
    detail: `${failed[0]} ${failed.length === 1 ? 'is' : 'are'} not responding.`,
    databaseOk,
    redisOk,
  }
}

export interface AccountSplit {
  active: number
  disabled: number
  total: number
}

export interface AdminAccountSplit {
  faculty: AccountSplit
  students: AccountSplit
}

/** Active/disabled splits rendered by the dashboard accounts panel. */
export function buildAccountSplit(counts: AdminOverviewCounts): AdminAccountSplit {
  return {
    faculty: {
      active: counts.activeFaculty,
      disabled: counts.disabledFaculty,
      total: counts.activeFaculty + counts.disabledFaculty,
    },
    students: {
      active: counts.activeStudents,
      disabled: counts.disabledStudents,
      total: counts.activeStudents + counts.disabledStudents,
    },
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Compact, locale-independent relative timestamp for activity/health rows. */
export function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return 'Unknown time'

  const diffMs = Math.max(0, nowMs - timestamp)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const date = new Date(timestamp)
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

const ACRONYMS = new Set(['qr', 'gps', 'api', 'id'])

/** Turns audit action identifiers (`users.role_changed`) into display copy. */
export function humanizeAuditAction(action: string): string {
  const words = action
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._:/-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'Recorded change'

  return words
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1)
      return lower
    })
    .join(' ')
}

export type AuditTone = 'success' | 'error' | 'neutral'

export interface AuditOutcomeSummary {
  label: string
  tone: AuditTone
}

export function describeAuditOutcome(outcome: AuditOutcome | string): AuditOutcomeSummary {
  switch (outcome) {
    case 'succeeded':
      return { label: 'Succeeded', tone: 'success' }
    case 'failed':
      return { label: 'Failed', tone: 'error' }
    case 'initiated':
      return { label: 'Incomplete', tone: 'neutral' }
    default:
      return { label: 'Recorded', tone: 'neutral' }
  }
}

/** Most recent N administrative actions for the dashboard feed. */
export function topRecentActivity(entries: AuditLogEntry[], limit = 6): AuditLogEntry[] {
  if (limit <= 0) return []
  return [...entries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function describeAdminScope(scope: AdminScopeKind, department?: string): string {
  if (scope === 'institution') return 'Institution-wide'
  return department ? `Department scope · ${department}` : 'Department scope'
}
