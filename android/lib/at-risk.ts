import type { AttendanceStandingStatus, StudentAtRisk } from '@polycheck/shared'

export type AtRiskMeta = {
  label: string
  classes: string
  textClasses: string
}

const META: Record<AttendanceStandingStatus, AtRiskMeta> = {
  below_threshold: {
    label: 'Below minimum',
    classes: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    textClasses: 'text-red-800 dark:text-red-300',
  },
  at_risk: {
    label: 'At risk',
    classes: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    textClasses: 'text-amber-800 dark:text-amber-300',
  },
  on_track: {
    label: 'On track',
    classes: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    textClasses: 'text-emerald-800 dark:text-emerald-300',
  },
  insufficient_data: {
    label: 'No data',
    classes: 'border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5',
    textClasses: 'text-muted dark:text-zinc-300',
  },
}

export function describeAtRiskStatus(status: AttendanceStandingStatus): AtRiskMeta {
  return META[status] ?? META.insufficient_data
}

export function formatAtRiskRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—'
  const floored = Math.floor(Math.max(0, rate) * 10) / 10
  return `${Number.isInteger(floored) ? floored : floored.toFixed(1)}%`
}

/** One-line explanation shown under a student in the widget. */
export function describeAtRiskDetail(student: StudentAtRisk): string {
  const rate = formatAtRiskRate(student.attendanceRate)
  const minimum = `${student.thresholdPercent}% minimum`
  if (student.status === 'insufficient_data') return 'Not enough recorded sessions yet'
  if (student.status === 'below_threshold') return `${rate} attendance · ${minimum}`
  if (student.status === 'at_risk') {
    const remaining = student.absencesBeforeBelowThreshold
    if (typeof remaining === 'number') {
      return `${rate} attendance · ${remaining} absence${remaining === 1 ? '' : 's'} before ${minimum}`
    }
    return `${rate} attendance · ${minimum}`
  }
  return `${rate} attendance · ${minimum}`
}
