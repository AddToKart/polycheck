import { describe, expect, it } from 'vitest'
import { hasCheckedIn } from './check-in'

describe('hasCheckedIn', () => {
  it('does not count the placeholder row created when a class starts', () => {
    expect(hasCheckedIn({ status: 'pending' }, false)).toBe(false)
    expect(hasCheckedIn({ status: 'pending' }, true, 'start')).toBe(false)
    expect(hasCheckedIn({ status: 'pending', checkInStatus: 'pending' }, true, 'start')).toBe(false)
  })

  it('does not count a student marked absent', () => {
    expect(hasCheckedIn({ status: 'absent' }, false)).toBe(false)
  })

  it.each(['present', 'late', 'incomplete', 'excused', 'disputed'] as const)('counts %s', (status) => {
    expect(hasCheckedIn({ status }, false)).toBe(true)
  })

  it('judges each online checkpoint on its own', () => {
    const started = { status: 'pending' as const, checkInTime: '2026-11-28T01:00:00Z' }
    expect(hasCheckedIn(started, true, 'start')).toBe(true)
    expect(hasCheckedIn(started, true, 'end')).toBe(false)
    expect(hasCheckedIn({ status: 'pending', checkOutStatus: 'present' }, true, 'end')).toBe(true)
  })
})
