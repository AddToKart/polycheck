import type { AttendanceStanding } from '@polycheck/shared'
import {
  clearStandingDismissals,
  dismissStandingAlert,
  formatStandingRate,
  isStandingAlertDismissed,
  pickStandingAlert,
} from '../lib/standing-alert'

const standing = (overrides: Partial<AttendanceStanding> = {}): AttendanceStanding => ({
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  subjectCode: 'COMP 20043',
  sectionName: '1-A',
  professorName: 'Prof. Cruz',
  thresholdPercent: 75,
  present: 8,
  late: 1,
  absent: 2,
  disputed: 0,
  countedSessions: 11,
  attendanceRate: 81.8,
  status: 'on_track',
  absencesBeforeBelowThreshold: 2,
  lastSessionDate: '2026-10-24',
  ...overrides,
})

describe('pickStandingAlert', () => {
  it('returns null when there are no standings', () => {
    expect(pickStandingAlert([])).toBeNull()
  })

  it('ignores on-track and insufficient-data rows', () => {
    expect(pickStandingAlert([
      standing({ sectionId: 'on-track', status: 'on_track', attendanceRate: 60 }),
      standing({ sectionId: 'insufficient', status: 'insufficient_data', attendanceRate: null, absencesBeforeBelowThreshold: null }),
    ])).toBeNull()
  })

  it('prefers below_threshold over at_risk regardless of rate', () => {
    const below = standing({ sectionId: 'below', status: 'below_threshold', attendanceRate: 84 })
    const atRisk = standing({ sectionId: 'risk', status: 'at_risk', attendanceRate: 70 })
    expect(pickStandingAlert([atRisk, below])?.sectionId).toBe('below')
  })

  it('picks the lowest rate among below-threshold sections', () => {
    const higher = standing({ sectionId: 'higher', status: 'below_threshold', attendanceRate: 60 })
    const lower = standing({ sectionId: 'lower', status: 'below_threshold', attendanceRate: 42.5 })
    const middle = standing({ sectionId: 'middle', status: 'below_threshold', attendanceRate: 55 })
    expect(pickStandingAlert([higher, lower, middle])?.sectionId).toBe('lower')
  })

  it('falls back to the lowest at-risk section when no section is below threshold', () => {
    const higher = standing({ sectionId: 'higher-risk', status: 'at_risk', attendanceRate: 78 })
    const lower = standing({ sectionId: 'lower-risk', status: 'at_risk', attendanceRate: 75.5 })
    expect(pickStandingAlert([higher, lower])?.sectionId).toBe('lower-risk')
  })

  it('skips a null rate even when the status is actionable', () => {
    expect(pickStandingAlert([
      standing({ sectionId: 'null-rate', status: 'at_risk', attendanceRate: null }),
      standing({ sectionId: 'real', status: 'at_risk', attendanceRate: 74 }),
    ])?.sectionId).toBe('real')
  })
})

describe('standing dismissals', () => {
  beforeEach(() => {
    clearStandingDismissals()
  })

  it('starts undismissed and remembers a per-user, per-section dismissal', () => {
    expect(isStandingAlertDismissed('user-1', 'sec-1')).toBe(false)
    dismissStandingAlert('user-1', 'sec-1')
    expect(isStandingAlertDismissed('user-1', 'sec-1')).toBe(true)
    expect(isStandingAlertDismissed('user-1', 'sec-2')).toBe(false)
    expect(isStandingAlertDismissed('user-2', 'sec-1')).toBe(false)
  })

  it('clearStandingDismissals resets the app-process bookkeeping', () => {
    dismissStandingAlert('user-1', 'sec-1')
    clearStandingDismissals()
    expect(isStandingAlertDismissed('user-1', 'sec-1')).toBe(false)
  })
})

describe('formatStandingRate', () => {
  it('floors to one decimal so a rate under the minimum never displays as the minimum', () => {
    expect(formatStandingRate(74.96)).toBe('74.9')
    expect(formatStandingRate(81.86)).toBe('81.8')
  })

  it('keeps whole numbers clean', () => {
    expect(formatStandingRate(75)).toBe('75')
    expect(formatStandingRate(0)).toBe('0')
  })

  it('clamps negative values to zero', () => {
    expect(formatStandingRate(-2)).toBe('0')
  })
})
