import { describe, expect, it } from 'vitest'
import { isMeetingPinError } from './pin-error'

describe('meeting PIN failure classification (WEB-10)', () => {
  it.each([
    'The meeting PIN is incorrect',
    'Incorrect PIN. 4 attempts remaining.',
    'Too many incorrect meeting PIN attempts. Ask your instructor to verify your attendance.',
    'Enter the meeting PIN announced by your instructor',
    'pin_incorrect',
    'pin_locked',
    'pin_required',
  ])('routes %s back to the PIN form', (message) => {
    expect(isMeetingPinError(message)).toBe(true)
  })

  it.each([
    'The QR attendance window has expired',
    'Attendance was already submitted for this session',
    'You are outside the session geofence (124 m away, allowed 40 m).',
    'Location accuracy is too poor to verify attendance',
    'QR token signature is invalid',
    'The meeting PIN state is unavailable for this checkpoint',
    'QR token PIN state does not match the session',
    'Network failure',
  ])('routes %s to the error phase instead', (message) => {
    expect(isMeetingPinError(message)).toBe(false)
  })

  it('treats empty/absent messages as a non-PIN failure', () => {
    expect(isMeetingPinError('')).toBe(false)
    expect(isMeetingPinError('   ')).toBe(false)
    expect(isMeetingPinError(null)).toBe(false)
    expect(isMeetingPinError(undefined)).toBe(false)
  })
})
