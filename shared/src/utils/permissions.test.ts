import { describe, expect, it } from 'vitest'
import { cooldownRemainingMinutes, effectivePermission, formatCooldownRemaining } from './permissions'

describe('effectivePermission', () => {
  it('honours the institution master switch before any override', () => {
    expect(effectivePermission(true, false)).toBe(false)
    expect(effectivePermission(null, false)).toBe(false)
    expect(effectivePermission(false, false)).toBe(false)
  })

  it('follows the institution default when the override is null/undefined', () => {
    expect(effectivePermission(null, true)).toBe(true)
    expect(effectivePermission(undefined, true)).toBe(true)
  })

  it('lets an override restrict a teacher further', () => {
    expect(effectivePermission(false, true)).toBe(false)
    expect(effectivePermission(true, true)).toBe(true)
  })
})

describe('cooldownRemainingMinutes', () => {
  const now = Date.parse('2026-10-30T10:00:00.000Z')

  it('returns null when no cooldown is stored', () => {
    expect(cooldownRemainingMinutes(null, now)).toBeNull()
    expect(cooldownRemainingMinutes(undefined, now)).toBeNull()
  })

  it('returns null once the cooldown has exactly expired', () => {
    expect(cooldownRemainingMinutes('2026-10-30T10:00:00.000Z', now)).toBeNull()
    expect(cooldownRemainingMinutes('2026-10-30T09:59:59.000Z', now)).toBeNull()
  })

  it('rounds partial minutes up so the UI never shows zero while locked', () => {
    expect(cooldownRemainingMinutes('2026-10-30T10:00:30.000Z', now)).toBe(1)
    expect(cooldownRemainingMinutes('2026-10-30T12:00:00.000Z', now)).toBe(120)
  })

  it('accepts Date objects and rejects malformed strings', () => {
    expect(cooldownRemainingMinutes(new Date('2026-10-30T10:05:00.000Z'), now)).toBe(5)
    expect(cooldownRemainingMinutes('not-a-date', now)).toBeNull()
  })
})

describe('formatCooldownRemaining', () => {
  it('formats minutes and hours compactly', () => {
    expect(formatCooldownRemaining(45)).toBe('45 min')
    expect(formatCooldownRemaining(60)).toBe('1 h')
    expect(formatCooldownRemaining(83)).toBe('1 h 23 min')
    expect(formatCooldownRemaining(0)).toBe('0 min')
    expect(formatCooldownRemaining(-5)).toBe('0 min')
  })
})
