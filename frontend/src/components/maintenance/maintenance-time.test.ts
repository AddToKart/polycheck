import { describe, expect, it } from 'vitest'
import { formatMaintenanceRemaining } from './maintenance-time'

const NOW = Date.parse('2026-11-01T09:00:00.000Z')

describe('formatMaintenanceRemaining', () => {
  it('returns nothing to show when no estimate exists', () => {
    expect(formatMaintenanceRemaining(undefined, NOW)).toEqual({ tone: 'none', label: '' })
    expect(formatMaintenanceRemaining('not-a-date', NOW)).toEqual({ tone: 'none', label: '' })
  })

  it('formats a near estimate in minutes', () => {
    expect(formatMaintenanceRemaining('2026-11-01T09:10:00.000Z', NOW)).toEqual({
      tone: 'pending',
      label: 'Estimated resumption in 10 min',
    })
  })

  it('formats a longer estimate in hours and minutes', () => {
    expect(formatMaintenanceRemaining('2026-11-01T10:35:00.000Z', NOW)).toEqual({
      tone: 'pending',
      label: 'Estimated resumption in 1 h 35 min',
    })
    expect(formatMaintenanceRemaining('2026-11-01T11:00:00.000Z', NOW)).toEqual({
      tone: 'pending',
      label: 'Estimated resumption in 2 h',
    })
  })

  it('flags an overdue estimate without implying an automatic reopen', () => {
    expect(formatMaintenanceRemaining('2026-11-01T08:00:00.000Z', NOW)).toEqual({
      tone: 'overdue',
      label: 'Resumption is overdue — contact the IT desk',
    })
  })
})
