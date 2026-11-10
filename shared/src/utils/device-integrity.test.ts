import { describe, expect, it } from 'vitest'
import { formatCooldownCountdown } from './device-integrity'

describe('formatCooldownCountdown', () => {
  it('renders m:ss below one hour', () => {
    expect(formatCooldownCountdown(1)).toBe('0:01')
    expect(formatCooldownCountdown(59)).toBe('0:59')
    expect(formatCooldownCountdown(60)).toBe('1:00')
    expect(formatCooldownCountdown(125)).toBe('2:05')
    expect(formatCooldownCountdown(3599)).toBe('59:59')
  })

  it('renders h:mm:ss at or above one hour', () => {
    expect(formatCooldownCountdown(3600)).toBe('1:00:00')
    expect(formatCooldownCountdown(3661)).toBe('1:01:01')
    expect(formatCooldownCountdown(7200)).toBe('2:00:00')
    expect(formatCooldownCountdown(90_000)).toBe('25:00:00')
    expect(formatCooldownCountdown(86_399)).toBe('23:59:59')
  })

  it('clamps elapsed, zero, negative, and non-finite values to 0:00', () => {
    expect(formatCooldownCountdown(0)).toBe('0:00')
    expect(formatCooldownCountdown(-5)).toBe('0:00')
    expect(formatCooldownCountdown(Number.NaN)).toBe('0:00')
    expect(formatCooldownCountdown(Number.POSITIVE_INFINITY)).toBe('0:00')
  })

  it('rounds fractional seconds up so an active cooldown never reads 0:00', () => {
    expect(formatCooldownCountdown(0.4)).toBe('0:01')
    expect(formatCooldownCountdown(59.2)).toBe('1:00')
  })
})
