import type { AdminOverviewCounts, AdminOverviewHealth, AuditLogEntry } from '@polycheck/shared'
import {
  buildAccountSplit,
  describeAdminScope,
  describeAuditOutcome,
  formatRelativeTime,
  humanizeAuditAction,
  summarizeAdminHealth,
  topRecentActivity,
} from '../components/super-admin-dashboard-helpers'

const counts: AdminOverviewCounts = {
  activeFaculty: 8,
  disabledFaculty: 2,
  activeStudents: 120,
  disabledStudents: 5,
  activeSessions: 3,
  pendingDisputes: 1,
}

const auditEntry = (id: string, createdAt: string): AuditLogEntry => ({
  id,
  actorId: 'admin-1',
  actorName: 'Admin One',
  actorRole: 'super_admin',
  action: 'users.role_changed',
  entityType: 'user',
  outcome: 'succeeded',
  createdAt,
})

describe('super-admin dashboard helpers', () => {
  describe('summarizeAdminHealth', () => {
    it('reports unavailable when no probe has arrived', () => {
      expect(summarizeAdminHealth(null)).toMatchObject({
        tone: 'unavailable',
        label: 'Status unavailable',
        databaseOk: false,
        redisOk: false,
      })
    })

    it('reports healthy when the probe and both dependencies respond', () => {
      const health: AdminOverviewHealth = {
        status: 'ok',
        timestamp: '2026-10-26T00:00:00.000Z',
        database: true,
        redis: true,
      }
      expect(summarizeAdminHealth(health)).toMatchObject({
        tone: 'healthy',
        label: 'All systems operational',
        databaseOk: true,
        redisOk: true,
      })
    })

    it('reports degraded and names the failing dependency', () => {
      const summary = summarizeAdminHealth({
        status: 'ok',
        timestamp: '2026-10-26T00:00:00.000Z',
        database: true,
        redis: false,
      })
      expect(summary.tone).toBe('degraded')
      expect(summary.detail).toContain('cache')
      expect(summary.detail).not.toContain('database')
    })

    it('reports degraded when the probe marks the service unavailable but a dependency responds', () => {
      const summary = summarizeAdminHealth({
        status: 'unavailable',
        timestamp: '2026-10-26T00:00:00.000Z',
        database: true,
        redis: false,
      })
      expect(summary.tone).toBe('degraded')
      expect(summary.detail).toContain('cache')
    })

    it('reports unavailable when no dependency responds', () => {
      const summary = summarizeAdminHealth({
        status: 'unavailable',
        timestamp: '2026-10-26T00:00:00.000Z',
        database: false,
        redis: false,
      })
      expect(summary).toMatchObject({ tone: 'unavailable', label: 'Service unavailable' })
    })
  })

  it('splits active and disabled accounts by role', () => {
    expect(buildAccountSplit(counts)).toEqual({
      faculty: { active: 8, disabled: 2, total: 10 },
      students: { active: 120, disabled: 5, total: 125 },
    })
  })

  describe('formatRelativeTime', () => {
    const now = Date.UTC(2026, 2, 2, 12, 0, 0)

    it('formats recent and older timestamps deterministically', () => {
      expect(formatRelativeTime(new Date(now - 20_000).toISOString(), now)).toBe('Just now')
      expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m ago')
      expect(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe('2h ago')
      expect(formatRelativeTime(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe('3d ago')
      expect(formatRelativeTime('2026-01-01T00:00:00.000Z', now)).toBe('Jan 1')
    })

    it('handles invalid timestamps', () => {
      expect(formatRelativeTime('not-a-date', now)).toBe('Unknown time')
    })
  })

  describe('humanizeAuditAction', () => {
    it('turns identifiers into readable copy', () => {
      expect(humanizeAuditAction('users.role_changed')).toBe('Users role changed')
      expect(humanizeAuditAction('auth.key-revoked')).toBe('Auth key revoked')
      expect(humanizeAuditAction('user.createAdmin')).toBe('User create admin')
      expect(humanizeAuditAction('qr.token.rotated')).toBe('QR token rotated')
    })

    it('falls back for empty actions', () => {
      expect(humanizeAuditAction('')).toBe('Recorded change')
    })
  })

  it('maps audit outcomes to labels and tones', () => {
    expect(describeAuditOutcome('succeeded')).toEqual({ label: 'Succeeded', tone: 'success' })
    expect(describeAuditOutcome('failed')).toEqual({ label: 'Failed', tone: 'error' })
    expect(describeAuditOutcome('initiated')).toEqual({ label: 'Incomplete', tone: 'neutral' })
    expect(describeAuditOutcome('unknown')).toEqual({ label: 'Recorded', tone: 'neutral' })
  })

  it('sorts recent activity newest-first and caps the list', () => {
    const entries = [
      auditEntry('old', '2026-10-20T00:00:00.000Z'),
      auditEntry('newest', '2026-10-26T00:00:00.000Z'),
      auditEntry('middle', '2026-10-24T00:00:00.000Z'),
    ]
    expect(topRecentActivity(entries, 2).map((entry) => entry.id)).toEqual(['newest', 'middle'])
    expect(topRecentActivity(entries, 0)).toEqual([])
  })

  it('describes institution and department scope', () => {
    expect(describeAdminScope('institution')).toBe('Institution-wide')
    expect(describeAdminScope('department', 'CCIS')).toBe('Department scope · CCIS')
    expect(describeAdminScope('department')).toBe('Department scope')
  })
})
