import { describe, expect, it } from 'vitest'
import { isProofWindowOpen } from './proof-window'

// 2026-11-27, 09:00 to 10:30 campus time (UTC+8).
const session = { date: '2026-11-27', startTime: '09:00', endTime: '10:30', isActive: false }
const campus = (time: string, date = '2026-11-27') => new Date(`${date}T${time}:00+08:00`)

describe('isProofWindowOpen', () => {
  it('is open for the whole scheduled class, even after the QR code has closed', () => {
    expect(isProofWindowOpen(session, campus('09:00'))).toBe(true)
    expect(isProofWindowOpen(session, campus('10:00'))).toBe(true)
    expect(isProofWindowOpen(session, campus('10:45'))).toBe(true)
  })

  it('is closed before class, after the grace time and on other days', () => {
    expect(isProofWindowOpen(session, campus('08:59'))).toBe(false)
    expect(isProofWindowOpen(session, campus('10:46'))).toBe(false)
    expect(isProofWindowOpen(session, campus('09:30', '2026-11-28'))).toBe(false)
  })

  it('is open whenever the session is live', () => {
    expect(isProofWindowOpen({ ...session, isActive: true }, campus('15:00', '2026-12-01'))).toBe(true)
  })
})
