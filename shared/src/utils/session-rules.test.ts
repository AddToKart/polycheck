import { describe, expect, it } from 'vitest'
import { sessionTimeIssue } from './session-rules'

describe('sessionTimeIssue', () => {
  it('accepts an ordinary class, including the shortest and longest allowed', () => {
    expect(sessionTimeIssue('09:00', '10:30')).toBeNull()
    expect(sessionTimeIssue('09:00', '09:15')).toBeNull()
    expect(sessionTimeIssue('07:00', '19:00')).toBeNull()
  })

  it.each([
    ['9:00', '10:00', /HH:mm/],
    ['09:00', '25:00', /HH:mm/],
    ['', '10:00', /HH:mm/],
    ['10:00', '10:00', /after start/],
    ['10:00', '09:00', /after start/],
    ['09:00', '09:14', /at least 15 minutes/],
    ['06:00', '18:01', /at most 12 hours/],
  ])('explains why %s to %s is refused', (start, end, message) => {
    expect(sessionTimeIssue(start, end)).toMatch(message)
  })
})
