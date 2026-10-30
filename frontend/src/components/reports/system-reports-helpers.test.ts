import { describe, expect, it } from 'vitest'
import type { SystemReport, SystemReportStats } from '@polycheck/shared'
import {
  REPORT_STAT_CARDS,
  STATUS_FILTER_OPTIONS,
  describeTelemetry,
  severityBadgeClass,
  statusBadgeClass,
} from './system-reports-helpers'
import { describeWebPlatform, mapEffectiveType } from '@/lib/report-telemetry'

const baseReport: SystemReport = {
  id: 'report-1',
  category: 'geofence_gps',
  severity: 'critical',
  title: 'False outside-geofence',
  description: 'Standing inside the room.',
  status: 'resolved',
  deviceInfo: 'Chrome 130 on Windows',
  appVersion: undefined,
  route: '/student/dashboard',
  networkType: 'wifi',
  screenshotUrl: null,
  adminNotes: 'Calibrated Room 302 geofence from 30m to 45m.',
  resolvedAt: '2026-10-30T12:00:00.000Z',
  resolvedBy: 'admin-1',
  createdAt: '2026-10-30T08:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
  user: {
    id: 's-1',
    fullName: 'Juan Dela Cruz',
    role: 'student',
    studentId: '2024-00001-MN-0',
    email: 'amreyes@iskolar.pup.edu.ph',
    department: 'CCIS',
  },
}

describe('system-reports-helpers', () => {
  const emptyStats: SystemReportStats = {
    total: 12,
    open: 4,
    inReview: 3,
    resolved: 4,
    dismissed: 1,
    scannerAndGps: 6,
    resolvedThisMonth: 2,
    critical: 1,
  }

  it('maps stat cards to cockpit values (open + in review are unresolved)', () => {
    const values = Object.fromEntries(
      REPORT_STAT_CARDS.map((card) => [card.key, card.value(emptyStats)]),
    )
    expect(values).toEqual({ total: 12, open: 7, 'scanner-gps': 6, resolved: 2, critical: 1 })
  })

  it('exposes complete filter option lists', () => {
    expect(STATUS_FILTER_OPTIONS.map((option) => option.value)).toEqual(['', 'open', 'in_review', 'resolved', 'dismissed'])
    expect(STATUS_FILTER_OPTIONS.every((option) => option.label.length > 0)).toBe(true)
  })

  it('styles severe statuses distinctly', () => {
    expect(statusBadgeClass('open')).toContain('zinc')
    expect(statusBadgeClass('in_review')).toContain('amber')
    expect(statusBadgeClass('resolved')).toContain('emerald')
    expect(severityBadgeClass('critical')).toContain('red')
    expect(severityBadgeClass('low')).toContain('zinc')
  })

  it('streams bounded telemetry rows for the detail drawer', () => {
    const rows = describeTelemetry(baseReport)
    const labels = rows.map((row) => row.label)
    expect(labels).toEqual(
      expect.arrayContaining(['Submitted by', 'Student number', 'Email', 'Platform', 'Current route', 'Network', 'Resolved']),
    )
    expect(labels).not.toContain('App version')
  })
})

describe('web report telemetry', () => {
  it('summarizes browsers and operating systems from a UA string', () => {
    expect(describeWebPlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    )).toBe('Chrome 130 on Windows')
    expect(describeWebPlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    )).toBe('Safari 17 on macOS')
  })

  it('maps connection effective types to intake vocabulary', () => {
    expect(mapEffectiveType('wifi')).toBe('wifi')
    expect(mapEffectiveType('4g')).toBe('cellular')
    expect(mapEffectiveType(undefined)).toBe('unknown')
  })
})
