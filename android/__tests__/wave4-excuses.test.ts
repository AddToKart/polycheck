import type { AttendanceRecord } from '@polycheck/shared'
import {
  EXCUSE_STATUS_META,
  excuseReasonLabel,
  filterExcuseRecords,
  isExcuseEligible,
  validateExcuseForm,
} from '../lib/excuses'
import { describeAtRiskDetail, describeAtRiskStatus, formatAtRiskRate } from '../lib/at-risk'

const record = (overrides: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  studentName: 'Ana Cruz',
  timestamp: '2026-10-25T02:00:00.000Z',
  status: 'absent',
  coordinates: { latitude: 14.87, longitude: 120.99 },
  isSynced: true,
  ...overrides,
})

describe('isExcuseEligible', () => {
  it('allows synced absent and late records only', () => {
    expect(isExcuseEligible(record())).toBe(true)
    expect(isExcuseEligible(record({ status: 'late' }))).toBe(true)
    expect(isExcuseEligible(record({ status: 'present' }))).toBe(false)
    expect(isExcuseEligible(record({ isSynced: false }))).toBe(false)
    expect(isExcuseEligible(null)).toBe(false)
  })

  it('blocks open/approved requests and allows a rejected one to be filed again', () => {
    expect(isExcuseEligible(record({ excuseStatus: 'requested' }))).toBe(false)
    expect(isExcuseEligible(record({ excuseStatus: 'approved' }))).toBe(false)
    expect(isExcuseEligible(record({ excuseStatus: 'rejected' }))).toBe(true)
  })
})

describe('validateExcuseForm', () => {
  it('requires a reason and a meaningful description', () => {
    expect(validateExcuseForm({ reason: null, description: 'medical certificate attached' })).toContain('reason')
    expect(validateExcuseForm({ reason: 'medical', description: 'too short' })).toContain('10 characters')
    expect(validateExcuseForm({ reason: 'medical', description: '   ' })).toContain('10 characters')
  })

  it('accepts a valid form and the 1,000 character limit', () => {
    expect(validateExcuseForm({ reason: 'medical', description: 'Fever and medical certificate from the clinic.' })).toBeNull()
    expect(validateExcuseForm({ reason: 'other', description: 'x'.repeat(1_001) })).toContain('under 1,000')
  })
})

describe('labels and status metadata', () => {
  it('exposes reason and status labels', () => {
    expect(excuseReasonLabel('family_emergency')).toBe('Family emergency')
    expect(excuseReasonLabel()).toBe('')
    expect(EXCUSE_STATUS_META.requested.label).toBe('Requested')
    expect(EXCUSE_STATUS_META.approved.label).toBe('Approved')
    expect(EXCUSE_STATUS_META.rejected.label).toBe('Rejected')
  })
})

describe('filterExcuseRecords', () => {
  const records = [
    record({ id: 'pending', excuseStatus: 'requested', timestamp: '2026-10-25T02:00:00.000Z' }),
    record({ id: 'approved', excuseStatus: 'approved', timestamp: '2026-10-24T02:00:00.000Z' }),
    record({ id: 'rejected', excuseStatus: 'rejected', sectionId: 'sec-2', timestamp: '2026-10-20T02:00:00.000Z' }),
    record({ id: 'none', timestamp: '2026-10-23T02:00:00.000Z' }),
  ]

  it('splits pending from resolved and sorts newest-first', () => {
    expect(filterExcuseRecords(records, { tab: 'pending' }).map((item) => item.id)).toEqual(['pending'])
    expect(filterExcuseRecords(records, { tab: 'resolved' }).map((item) => item.id)).toEqual(['approved', 'rejected'])
  })

  it('filters by section and date', () => {
    expect(filterExcuseRecords(records, { tab: 'resolved', sectionId: 'sec-2' }).map((item) => item.id)).toEqual(['rejected'])
    expect(filterExcuseRecords(records, { tab: 'resolved', startDate: '2026-10-23' }).map((item) => item.id)).toEqual(['approved'])
  })
})

describe('at-risk helpers', () => {
  it('formats floors, labels and detail lines', () => {
    expect(formatAtRiskRate(74.96)).toBe('74.9%')
    expect(formatAtRiskRate(80)).toBe('80%')
    expect(formatAtRiskRate(null)).toBe('—')
    expect(describeAtRiskStatus('below_threshold').label).toBe('Below minimum')
    expect(describeAtRiskStatus('at_risk').label).toBe('At risk')
    expect(describeAtRiskStatus('on_track').label).toBe('On track')
    expect(describeAtRiskStatus('insufficient_data').label).toBe('No data')
    expect(describeAtRiskDetail({
      studentId: 's-1',
      studentName: 'Ana Cruz',
      sectionId: 'sec-1',
      sectionName: '1-A',
      subjectName: 'Software Engineering',
      professorName: 'Prof. Reyes',
      thresholdPercent: 75,
      attendanceRate: 70,
      status: 'below_threshold',
      absencesBeforeBelowThreshold: 0,
    })).toBe('70% attendance · 75% minimum')
    expect(describeAtRiskDetail({
      studentId: 's-1',
      studentName: 'Ana Cruz',
      sectionId: 'sec-1',
      sectionName: '1-A',
      subjectName: 'Software Engineering',
      professorName: 'Prof. Reyes',
      thresholdPercent: 75,
      attendanceRate: 78,
      status: 'at_risk',
      absencesBeforeBelowThreshold: 1,
    })).toBe('78% attendance · 1 absence before 75% minimum')
  })
})
