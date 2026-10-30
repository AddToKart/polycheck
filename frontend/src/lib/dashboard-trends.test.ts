import { describe, expect, it } from 'vitest'
import { buildTrendSegments, stackedTrendTotal, summarizeTrends, type TrendTotals } from './dashboard-trends'

const totals = (patch: Partial<TrendTotals> = {}): TrendTotals => ({
  present: 0,
  late: 0,
  absent: 0,
  disputed: 0,
  excused: 0,
  ...patch,
})

describe('dashboard trend aggregation', () => {
  it('sums the excused bucket alongside attended outcomes and disputed', () => {
    const summary = summarizeTrends([
      { date: '2026-08-01', present: 3, late: 1, absent: 2, disputed: 1, excused: 2 },
      { date: '2026-08-02', present: 4, late: 0, absent: 1, disputed: 0, excused: 1 },
    ])

    expect(summary).toEqual({ present: 7, late: 1, absent: 3, disputed: 1, excused: 3 })
  })

  it('tolerates missing excused values and empty payloads', () => {
    const legacyRows = [{ date: '2026-08-01', present: 1, late: 0, absent: 0, disputed: 0 }] as never
    expect(summarizeTrends(legacyRows).excused).toBe(0)
    expect(summarizeTrends(undefined)).toEqual(totals())
  })

  it('includes an excused segment with a stable zero state', () => {
    const segments = buildTrendSegments(totals({ present: 4, late: 1, absent: 1, disputed: 2 }))
    const excused = segments.find((segment) => segment.key === 'excused')

    expect(excused).toBeDefined()
    expect(excused?.value).toBe(0)
    expect(excused?.percent).toBe(0)
    expect(excused?.barClassName).toBe('bg-golden-dark')
    expect(segments.map((segment) => segment.key)).toEqual(['present', 'late', 'absent', 'excused'])
  })

  it('rounds the stack against attended outcomes plus excused, excluding disputed', () => {
    const summary = totals({ present: 5, late: 2, absent: 1, excused: 2, disputed: 9 })

    expect(stackedTrendTotal(summary)).toBe(10)
    const segments = buildTrendSegments(summary)
    expect(segments.find((segment) => segment.key === 'excused')?.percent).toBe(20)
    expect(segments.find((segment) => segment.key === 'present')?.percent).toBe(50)
  })

  it('does not divide by zero when a period has only disputed records', () => {
    const segments = buildTrendSegments(totals({ disputed: 4 }))
    expect(segments.every((segment) => segment.percent === 0)).toBe(true)
  })
})
