import { describe, expect, it } from 'vitest'
import { isCheckedInStatus, verifiedDelta } from './kiosk-verified'

describe('kiosk verified ring', () => {
  it('counts the checked-in statuses only', () => {
    expect(isCheckedInStatus('present')).toBe(true)
    expect(isCheckedInStatus('late')).toBe(true)
    expect(isCheckedInStatus('incomplete')).toBe(true)
    expect(isCheckedInStatus('absent')).toBe(false)
    expect(isCheckedInStatus('pending')).toBe(false)
    expect(isCheckedInStatus('disputed')).toBe(false)
  })

  it('adds a new check-in and ignores a replayed one', () => {
    expect(verifiedDelta(undefined, 'present')).toBe(1)
    expect(verifiedDelta(undefined, 'late')).toBe(1)
    expect(verifiedDelta(undefined, 'incomplete')).toBe(1)
    expect(verifiedDelta(undefined, 'absent')).toBe(0)
    expect(verifiedDelta('present', 'present')).toBe(0)
  })

  it('follows a cockpit override in both directions', () => {
    expect(verifiedDelta('present', 'absent')).toBe(-1)
    expect(verifiedDelta('late', 'absent')).toBe(-1)
    expect(verifiedDelta('present', 'disputed')).toBe(-1)
    expect(verifiedDelta('absent', 'present')).toBe(1)
    expect(verifiedDelta('absent', 'incomplete')).toBe(1)
  })
})
