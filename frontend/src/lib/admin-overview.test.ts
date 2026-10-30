import { describe, expect, it } from 'vitest'
import type { AdminOverviewCounts, AdminOverviewHealth } from '@polycheck/shared'
import {
  activityOutcomeLabel,
  activityOutcomeTone,
  buildAccountSplits,
  formatActivityAction,
  formatRelativeTime,
  summarizeAdminHealth,
} from './admin-overview'

const counts: AdminOverviewCounts = {
  activeFaculty: 12,
  disabledFaculty: 3,
  activeStudents: 180,
  disabledStudents: 20,
  activeSessions: 4,
  pendingDisputes: 2,
}

const healthy: AdminOverviewHealth = {
  status: 'ok',
  timestamp: '2026-10-26T02:30:00.000Z',
  database: true,
  redis: true,
}

describe('admin overview helpers', () => {
  it('splits faculty and student account counts', () => {
    const splits = buildAccountSplits(counts)
    expect(splits).toEqual([
      { key: 'faculty', label: 'Faculty accounts', active: 12, inactive: 3, total: 15, activePercent: 80 },
      { key: 'students', label: 'Student accounts', active: 180, inactive: 20, total: 200, activePercent: 90 },
    ])
  })

  it('never divides by zero for empty account sets', () => {
    const splits = buildAccountSplits({
      activeFaculty: 0,
      disabledFaculty: 0,
      activeStudents: 0,
      disabledStudents: 0,
      activeSessions: 0,
      pendingDisputes: 0,
    })
    expect(splits.every((split) => split.total === 0 && split.activePercent === 0)).toBe(true)
  })

  it('marks a healthy probe operational', () => {
    const summary = summarizeAdminHealth(healthy)
    expect(summary.state).toBe('operational')
    expect(summary.label).toBe('Operational')
    expect(summary.services).toEqual([
      { label: 'Database', ok: true },
      { label: 'Redis', ok: true },
    ])
    expect(summary.statusLine).toContain('Database connected')
    expect(summary.statusLine).toContain('Redis connected')
  })

  it('marks partial dependencies degraded and an unavailable probe unavailable', () => {
    expect(summarizeAdminHealth({ ...healthy, redis: false }).state).toBe('degraded')
    expect(summarizeAdminHealth({ ...healthy, status: 'unavailable' }).state).toBe('unavailable')
    expect(summarizeAdminHealth({ ...healthy, status: 'unavailable' }).statusLine).toContain(
      'System health: Unavailable',
    )
  })

  it('formats recent activity relative to a fixed clock', () => {
    const now = new Date('2026-10-26T12:00:00.000Z').getTime()
    expect(formatRelativeTime('2026-10-26T11:59:40.000Z', now)).toBe('Just now')
    expect(formatRelativeTime('2026-10-26T11:45:00.000Z', now)).toBe('15m ago')
    expect(formatRelativeTime('2026-10-26T09:00:00.000Z', now)).toBe('3h ago')
    expect(formatRelativeTime('2026-10-24T12:00:00.000Z', now)).toBe('2d ago')
    expect(formatRelativeTime('not-a-date', now)).toBe('Unknown time')
  })

  it('humanizes audit actions and outcomes', () => {
    expect(formatActivityAction('users.create')).toBe('Users create')
    expect(formatActivityAction('attendance-status_update')).toBe('Attendance status update')
    expect(activityOutcomeLabel('initiated')).toBe('Incomplete')
    expect(activityOutcomeTone('succeeded')).toBe('success')
    expect(activityOutcomeTone('failed')).toBe('danger')
    expect(activityOutcomeTone('initiated')).toBe('neutral')
  })
})
