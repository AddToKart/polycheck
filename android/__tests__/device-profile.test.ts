import { cooldownRemainingMinutes, effectivePermission, formatCooldownRemaining } from '@polycheck/shared/utils'

/**
 * Pure logic behind the mobile device panels and cooldown dialog. Widget
 * rendering is covered by the web parity suite; these assertions pin the
 * numbers/copy shown in the Android device & anti-cheat screen and the login
 * cooldown modal.
 */
describe('mobile device governance helpers', () => {
  const now = Date.parse('2026-10-30T10:00:00.000Z')

  it('renders the cooldown countdown used by the profile and login modal', () => {
    const until = '2026-10-30T11:23:00.000Z'
    const minutes = cooldownRemainingMinutes(until, now)
    expect(minutes).toBe(83)
    expect(formatCooldownRemaining(minutes as number)).toBe('1 h 23 min')
  })

  it('hides an expired cooldown', () => {
    expect(cooldownRemainingMinutes('2026-10-30T09:59:00.000Z', now)).toBeNull()
    expect(cooldownRemainingMinutes(null, now)).toBeNull()
  })

  it('merges the per-teacher override with the institution switch', () => {
    expect(effectivePermission(null, true)).toBe(true)
    expect(effectivePermission(false, true)).toBe(false)
    expect(effectivePermission(true, false)).toBe(false)
  })
})
