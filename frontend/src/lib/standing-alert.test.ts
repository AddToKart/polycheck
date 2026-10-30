import { describe, expect, it } from 'vitest'
import type { AttendanceStanding } from '@polycheck/shared'
import { pickStandingAlert, standingSessionDismissKey } from './standing-alert'

function makeStanding(overrides: Partial<AttendanceStanding> = {}): AttendanceStanding {
  return {
    sectionId: 'section-1',
    subjectName: 'Software Engineering',
    subjectCode: 'SE',
    sectionName: '1',
    professorName: 'Prof. Reyes',
    thresholdPercent: 75,
    present: 10,
    late: 0,
    absent: 2,
    disputed: 0,
    countedSessions: 12,
    attendanceRate: 83.3,
    status: 'on_track',
    absencesBeforeBelowThreshold: 2,
    ...overrides,
  }
}

describe('pickStandingAlert', () => {
  it('returns null when there is no actionable standing', () => {
    expect(pickStandingAlert([])).toBeNull()
    expect(
      pickStandingAlert([
        makeStanding({ sectionId: 'on-track', status: 'on_track' }),
        makeStanding({ sectionId: 'no-data', status: 'insufficient_data', attendanceRate: null }),
      ]),
    ).toBeNull()
  })

  it('ignores below-threshold standings without a computed rate', () => {
    expect(
      pickStandingAlert([makeStanding({ status: 'below_threshold', attendanceRate: null })]),
    ).toBeNull()
  })

  it('prefers below_threshold over at_risk even when the at-risk rate is lower', () => {
    const below = makeStanding({ sectionId: 'below', status: 'below_threshold', attendanceRate: 72 })
    const atRisk = makeStanding({ sectionId: 'at-risk', status: 'at_risk', attendanceRate: 60 })

    expect(pickStandingAlert([atRisk, below])).toBe(below)
  })

  it('returns the lowest rate among below-threshold sections', () => {
    const highest = makeStanding({ sectionId: 'below-79', status: 'below_threshold', attendanceRate: 79 })
    const lowest = makeStanding({ sectionId: 'below-61', status: 'below_threshold', attendanceRate: 61 })

    expect(pickStandingAlert([highest, lowest])).toBe(lowest)
  })

  it('returns the lowest rate among at-risk sections when nothing is below threshold', () => {
    const first = makeStanding({ sectionId: 'risk-78', status: 'at_risk', attendanceRate: 78 })
    const second = makeStanding({ sectionId: 'risk-76', status: 'at_risk', attendanceRate: 76 })

    expect(pickStandingAlert([first, second])).toBe(second)
  })
})

describe('standingSessionDismissKey', () => {
  it('scopes the session dismissal to both the student and section', () => {
    const key = standingSessionDismissKey('student-1', 'section-1')

    expect(key).toContain('student-1')
    expect(key).toContain('section-1')
    expect(key).not.toBe(standingSessionDismissKey('student-2', 'section-1'))
    expect(key).not.toBe(standingSessionDismissKey('student-1', 'section-2'))
  })
})
