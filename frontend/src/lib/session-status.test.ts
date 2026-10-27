import { describe, expect, it } from 'vitest'
import type { Session } from '@polycheck/shared'
import { deriveSessionStatus } from './session-status'

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    sectionId: 'section-1',
    subjectName: 'Software Engineering',
    date: '2026-10-27',
    startTime: '08:00',
    endTime: '10:00',
    qrValidityMinutes: 15,
    gracePeriodMinutes: 15,
    geofence: { latitude: 14.87, longitude: 120.99, radiusMeters: 40 },
    isActive: false,
    teacherId: 'teacher-1',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('deriveSessionStatus', () => {
  const today = '2026-10-27'

  it('prioritises a live session', () => {
    expect(deriveSessionStatus(session({ isActive: true, endedAt: '2026-10-27T10:00:00.000Z' }), today)).toBe('active')
  })

  it('marks ended or past sessions completed', () => {
    expect(deriveSessionStatus(session({ endedAt: '2026-10-27T10:00:00.000Z' }), today)).toBe('completed')
    expect(deriveSessionStatus(session({ date: '2026-10-20' }), today)).toBe('completed')
  })

  it('marks future rescheduled sessions separately', () => {
    expect(deriveSessionStatus(session({ date: '2026-11-02', isRescheduled: true }), today)).toBe('rescheduled')
    expect(deriveSessionStatus(session({ date: '2026-11-02', rescheduledFromDate: '2026-10-30' }), today)).toBe('rescheduled')
  })

  it('defaults future sessions to scheduled', () => {
    expect(deriveSessionStatus(session({ date: '2026-11-02' }), today)).toBe('scheduled')
  })
})
