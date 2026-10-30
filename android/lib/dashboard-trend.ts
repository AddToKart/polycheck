import type { DashboardOverview } from '@polycheck/shared'
import { pupColors } from '../theme/colors'

export type TrendSegmentKey = 'present' | 'late' | 'absent' | 'excused'

export type TrendTotals = Record<TrendSegmentKey | 'disputed', number>

export type TrendSegment = {
  key: TrendSegmentKey
  label: string
  color: string
  value: number
  percent: number
}

export const TREND_SEGMENT_ORDER: readonly TrendSegmentKey[] = [
  'present',
  'late',
  'absent',
  'excused',
]

const TREND_BUCKETS: readonly (TrendSegmentKey | 'disputed')[] = [...TREND_SEGMENT_ORDER, 'disputed']

/**
 * Chart colours mirror the reports donut so a record keeps the same colour on
 * every Android surface. `excused` uses the dedicated cyan token added in
 * Wave 4 and stays distinct from present/late/absent.
 */
export const TREND_SEGMENT_META: Record<TrendSegmentKey, { label: string; color: string }> = {
  present: { label: 'Present', color: pupColors.golden },
  late: { label: 'Late', color: pupColors.maroon },
  absent: { label: 'Absent', color: pupColors.maroonDark },
  excused: { label: 'Excused', color: pupColors.excused },
}

export type DashboardTrendSummary = {
  totals: TrendTotals
  /** Present + late + absent; excused and disputed are excluded. */
  counted: number
  /** Present + late, the numerator of the attendance rate. */
  attended: number
  /** 0 when there is no counted attendance. */
  attendanceRate: number
  /** Stack denominator: every rendered segment, excluding pending and disputed. */
  total: number
  segments: TrendSegment[]
}

/**
 * Folds the dashboard trend rows into one stack. Pending and disputed stay out
 * of the stack (both are surfaced as separate totals, matching the web
 * dashboard); `excused` renders as its own segment while staying out of the
 * attendance-rate denominator.
 */
export function summarizeDashboardTrends(
  trends: DashboardOverview['trends'] | undefined | null,
): DashboardTrendSummary {
  const totals: TrendTotals = { present: 0, late: 0, absent: 0, disputed: 0, excused: 0 }

  for (const day of trends ?? []) {
    for (const key of TREND_BUCKETS) {
      const value = day[key]
      if (Number.isFinite(value)) totals[key] += Math.max(0, value)
    }
  }

  const total = TREND_SEGMENT_ORDER.reduce((sum, key) => sum + totals[key], 0)
  const counted = totals.present + totals.late + totals.absent
  const attended = totals.present + totals.late
  const attendanceRate = counted > 0 ? Math.round((attended / counted) * 100) : 0

  const segments = TREND_SEGMENT_ORDER.map((key) => ({
    key,
    label: TREND_SEGMENT_META[key].label,
    color: TREND_SEGMENT_META[key].color,
    value: totals[key],
    percent: total > 0 ? (totals[key] / total) * 100 : 0,
  }))

  return { totals, counted, attended, attendanceRate, total, segments }
}
