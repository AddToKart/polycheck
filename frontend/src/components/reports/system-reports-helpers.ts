/** Pure cockpit configuration/derivations for the system-reports console (no React). */

import type { ReportCategory, ReportSeverity, ReportStatus, SystemReport, SystemReportStats } from '@polycheck/shared'
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS, REPORT_SEVERITIES, REPORT_SEVERITY_LABELS, REPORT_STATUSES, REPORT_STATUS_LABELS } from '@polycheck/shared'

export interface ReportStatsCard {
  key: string
  label: string
  value: (stats: SystemReportStats) => number
  testId: string
}

/** Metric overview cards for the triage cockpit header. */
export const REPORT_STAT_CARDS: readonly ReportStatsCard[] = [
  { key: 'total', label: 'Total reports', value: (s) => s.total, testId: 'stat-total' },
  { key: 'open', label: 'Open / unresolved', value: (s) => s.open + s.inReview, testId: 'stat-open' },
  { key: 'scanner-gps', label: 'Scanner / GPS issues', value: (s) => s.scannerAndGps, testId: 'stat-scanner-gps' },
  { key: 'resolved', label: 'Resolved this month', value: (s) => s.resolvedThisMonth, testId: 'stat-resolved' },
  { key: 'critical', label: 'Critical severity', value: (s) => s.critical, testId: 'stat-critical' },
]

export const STATUS_FILTER_OPTIONS: readonly { value: ReportStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  ...REPORT_STATUSES.map((status) => ({ value: status, label: REPORT_STATUS_LABELS[status] })),
]

export const CATEGORY_FILTER_OPTIONS: readonly { value: ReportCategory | ''; label: string }[] = [
  { value: '', label: 'All categories' },
  ...REPORT_CATEGORIES.map((category) => ({ value: category, label: REPORT_CATEGORY_LABELS[category] })),
]

export const SEVERITY_FILTER_OPTIONS: readonly { value: ReportSeverity | ''; label: string }[] = [
  { value: '', label: 'All severities' },
  ...REPORT_SEVERITIES.map((severity) => ({ value: severity, label: REPORT_SEVERITY_LABELS[severity] })),
]

export const ROLE_FILTER_OPTIONS: readonly { value: '' | 'student' | 'teacher'; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
]

export function statusBadgeClass(status: ReportStatus): string {
  switch (status) {
    case 'open':
      return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
    case 'in_review':
      return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    case 'resolved':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'dismissed':
      return 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500'
    default:
      return ''
  }
}

export function severityBadgeClass(severity: ReportSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
    case 'high':
      return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    case 'medium':
      return 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
    case 'low':
      return 'border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500'
    default:
      return ''
  }
}

/** Bounded telemetry rows for the detail drawer. */
export function describeTelemetry(report: SystemReport): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Submitted by', value: `${report.user.fullName} (${report.user.role})` },
    ...(report.user.studentId ? [{ label: 'Student number', value: report.user.studentId }] : []),
    ...(report.user.email ? [{ label: 'Email', value: report.user.email }] : []),
    ...(report.deviceInfo ? [{ label: 'Platform', value: report.deviceInfo }] : []),
    ...(report.appVersion ? [{ label: 'App version', value: report.appVersion }] : []),
    ...(report.route ? [{ label: 'Current route', value: report.route }] : []),
    ...(report.networkType ? [{ label: 'Network', value: report.networkType }] : []),
    ...(report.resolvedAt ? [{ label: 'Resolved', value: new Date(report.resolvedAt).toLocaleString('en-PH') }] : []),
  ]
  return rows
}
