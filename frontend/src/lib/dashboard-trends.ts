import type { DashboardOverview } from '@polycheck/shared'

export type DashboardTrendRow = DashboardOverview['trends'][number]

export interface TrendTotals {
  present: number
  late: number
  absent: number
  disputed: number
  excused: number
}

export interface TrendSegment {
  key: 'present' | 'late' | 'absent' | 'excused'
  label: string
  value: number
  percent: number
  barClassName: string
  textClassName: string
}

/**
 * The stack shows attended outcomes plus excused. Pending and disputed stay out
 * of the stack (both are surfaced as separate totals) and disputed is excluded
 * from the attendance rate.
 */
const SEGMENT_STYLES: ReadonlyArray<Pick<TrendSegment, 'key' | 'label' | 'barClassName' | 'textClassName'>> = [
  { key: 'present', label: 'Present', barClassName: 'bg-golden', textClassName: 'text-golden' },
  { key: 'late', label: 'Late', barClassName: 'bg-maroon', textClassName: 'text-maroon dark:text-red-300' },
  { key: 'absent', label: 'Absent', barClassName: 'bg-maroon-dark', textClassName: 'text-maroon-dark dark:text-red-400' },
  // Badge-system golden-outline/deep-maroon treatment, chart-safe as a fill.
  { key: 'excused', label: 'Excused', barClassName: 'bg-golden-dark', textClassName: 'text-golden-dark' },
]

const EMPTY_TOTALS: TrendTotals = { present: 0, late: 0, absent: 0, disputed: 0, excused: 0 }

/**
 * Folds daily trend rows into period totals. `excused` tolerates payloads from
 * a backend that has not yet shipped the field so charts degrade to zero rather
 * than rendering `NaN`.
 */
export function summarizeTrends(
  rows: ReadonlyArray<DashboardTrendRow> | null | undefined,
): TrendTotals {
  const totals: TrendTotals = { ...EMPTY_TOTALS }
  for (const row of rows ?? []) {
    totals.present += row.present
    totals.late += row.late
    totals.absent += row.absent
    totals.disputed += row.disputed
    totals.excused += row.excused ?? 0
  }
  return totals
}

/** Denominator for the stacked bar: attended outcomes plus excused. */
export function stackedTrendTotal(totals: TrendTotals): number {
  return totals.present + totals.late + totals.absent + totals.excused
}

/**
 * Builds the stacked-bar segments. Every segment is always returned so the
 * legend is stable; `percent` is zero when the stack has no records.
 */
export function buildTrendSegments(totals: TrendTotals): TrendSegment[] {
  const total = stackedTrendTotal(totals)
  return SEGMENT_STYLES.map((style) => ({
    ...style,
    value: totals[style.key],
    percent: total > 0 ? (totals[style.key] / total) * 100 : 0,
  }))
}
