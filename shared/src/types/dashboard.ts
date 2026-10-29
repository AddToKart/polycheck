import type { AuditLogEntry } from './api'
import type { User } from './user'

export type AdminScopeKind = 'institution' | 'department'

export interface AdminOverviewHealth {
  status: 'ok' | 'unavailable'
  timestamp: string
  database: boolean
  redis: boolean
}

export interface AdminOverviewCounts {
  activeFaculty: number
  disabledFaculty: number
  activeStudents: number
  disabledStudents: number
  activeSessions: number
  pendingDisputes: number
}

/** Contract shared by the web and Android super-admin dashboards (SA2). */
export interface AdminOverview {
  scope: AdminScopeKind
  department?: string
  counts: AdminOverviewCounts
  health: AdminOverviewHealth
  recentActivity: AuditLogEntry[]
}

export type AdminUserRoleFilter = 'super_admin' | 'teacher' | 'student'
export type AdminUserStatusFilter = 'active' | 'inactive'

/** Server-side filters for the super-admin user directory (SA3). */
export interface AdminUserFilters {
  role?: AdminUserRoleFilter
  q?: string
  department?: string
  status?: AdminUserStatusFilter
  limit?: number
  offset?: number
}

export interface AdminUserPage {
  data: User[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/** Whitelisted profile fields (SA3 / Locked Decision 8). */
export interface UpdateUserInput {
  fullName?: string
  department?: string
  email?: string
  program?: string
  yearLevel?: number
  /** Teacher-only governance overrides; null clears the override and follows the institution setting. */
  canResetStudentPasswords?: boolean | null
  canEmergencyUnbindDevices?: boolean | null
}

/** Only student <-> teacher transitions are allowed (Locked Decision 6). */
export type AssignableRole = 'teacher' | 'student'

/**
 * Promote an existing teacher (`userId`) or create a fresh super admin
 * (fullName + email + password) — Open Question 2 default: both.
 */
export interface CreateAdminInput {
  userId?: string
  fullName?: string
  email?: string
  password?: string
  department?: string
}

/** One live server-status tick streamed over Socket.IO (SA7). */
export interface ServerStatusSnapshot {
  timestamp: string
  uptimeSeconds: number
  httpRequestsTotal: number
  httpErrorsTotal: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  eventLoopLagMs: number | null
  memoryRssBytes: number
  cpuSecondsTotal: number
  applicationReady: boolean
  databaseReady: boolean
  redisReady: boolean
  queue: {
    wait: number
    active: number
    failed: number
  }
  /** Sockets connected to this backend instance (v1 single-instance view). */
  activeSockets: number
}

export const SERVER_METRICS_EVENT = 'server:metrics'
export const SERVER_SUBSCRIBE_EVENT = 'server:subscribe'
export const SERVER_SUBSCRIBED_EVENT = 'server:subscribed'
export const SERVER_UNSUBSCRIBE_EVENT = 'server:unsubscribe'
export const SERVER_METRICS_ROOM = 'server:metrics'
