import { describe, expect, it } from 'vitest'
import { formatCampusDate, getRecentCampusDateRange } from '@polycheck/shared/utils'

describe('campus calendar dates', () => {
  it('uses the Asia/Manila date around the UTC day boundary', () => {
    expect(formatCampusDate(new Date('2026-07-29T15:59:59.000Z'))).toBe('2026-07-29')
    expect(formatCampusDate(new Date('2026-07-29T16:00:00.000Z'))).toBe('2026-07-30')
  })

  it('builds an inclusive recent range in campus time', () => {
    expect(getRecentCampusDateRange(30, new Date('2026-07-29T16:30:00.000Z'))).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-30',
    })
  })
})
