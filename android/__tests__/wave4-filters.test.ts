import type { AttendanceRecord, Section, Session } from '@polycheck/shared'
import {
  campusDate,
  datePresetRange,
  filterAttendanceRecords,
  filterSessions,
  isInDateRange,
  sessionStatus,
} from '../lib/filters'

const NOW = new Date('2026-10-27T04:00:00.000Z') // 2026-10-27 12:00 Asia/Manila

const record = (overrides: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  studentName: 'Ana Cruz',
  timestamp: '2026-10-25T02:00:00.000Z',
  status: 'present',
  coordinates: { latitude: 14.87, longitude: 120.99 },
  isSynced: true,
  ...overrides,
})

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  date: '2026-10-27',
  startTime: '08:00',
  endTime: '09:30',
  qrValidityMinutes: 10,
  gracePeriodMinutes: 15,
  geofence: { latitude: 14.87, longitude: 120.99, radiusMeters: 50 },
  isActive: false,
  teacherId: 'teacher-1',
  createdAt: '2026-10-20T00:00:00.000Z',
  ...overrides,
})

const section: Section = {
  id: 'sec-1',
  subjectId: 'subj-1',
  section: '1-A',
  room: 'Room 101',
  schedule: [],
  semester: 'First',
  teacherId: 'teacher-1',
  teacherName: 'Prof. Reyes',
  enrollmentCode: 'ABC123',
  enrollmentCodeExpiry: '2026-12-01',
  studentCount: 20,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('datePresetRange', () => {
  it('uses the Asia/Manila civil date', () => {
    expect(campusDate(NOW)).toBe('2026-10-27')
  })

  it('returns inclusive recent ranges', () => {
    expect(datePresetRange('today', NOW)).toEqual({ startDate: '2026-10-27', endDate: '2026-10-27' })
    expect(datePresetRange('7d', NOW)).toEqual({ startDate: '2026-10-21', endDate: '2026-10-27' })
    expect(datePresetRange('30d', NOW)).toEqual({ startDate: '2026-09-28', endDate: '2026-10-27' })
  })

  it('returns the next seven days for the upcoming preset and no bounds for all', () => {
    expect(datePresetRange('upcoming7', NOW)).toEqual({ startDate: '2026-10-27', endDate: '2026-11-02' })
    expect(datePresetRange('all', NOW)).toEqual({})
  })
})

describe('isInDateRange', () => {
  it('compares ISO timestamps by civil date', () => {
    expect(isInDateRange('2026-10-25T23:59:00.000Z', '2026-10-25', '2026-10-25')).toBe(true)
    expect(isInDateRange('2026-10-26T00:00:00.000Z', '2026-10-25', '2026-10-25')).toBe(false)
    expect(isInDateRange('2026-10-25T12:00:00.000Z')).toBe(true)
  })
})

describe('filterAttendanceRecords', () => {
  const subjectFor = (sectionId: string) => sectionId === 'sec-1' ? 'subj-1' : 'subj-2'

  it('filters by status, subject, section and date', () => {
    const records = [
      record({ id: 'a', status: 'present' }),
      record({ id: 'b', status: 'absent', sectionId: 'sec-2' }),
      record({ id: 'c', status: 'excused', timestamp: '2026-09-01T00:00:00.000Z' }),
    ]

    expect(filterAttendanceRecords(records, { status: 'absent' }, subjectFor).map((r) => r.id)).toEqual(['b'])
    expect(filterAttendanceRecords(records, { subjectId: 'subj-1' }, subjectFor).map((r) => r.id)).toEqual(['a', 'c'])
    expect(filterAttendanceRecords(records, { sectionId: 'sec-2' }, subjectFor).map((r) => r.id)).toEqual(['b'])
    expect(filterAttendanceRecords(records, { startDate: '2026-10-01' }, subjectFor).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('drops subject matches when the resolver has no section', () => {
    expect(filterAttendanceRecords([record()], { subjectId: 'subj-2' }, () => undefined)).toEqual([])
  })
})

describe('sessionStatus / filterSessions', () => {
  const sections = [section, { ...section, id: 'sec-2', subjectId: 'subj-2', section: '2-B' }]
  const subjectFor = (sectionId: string) => sections.find((candidate) => candidate.id === sectionId)?.subjectId

  it('classifies active, upcoming and completed sessions', () => {
    const today = '2026-10-27'
    expect(sessionStatus(session({ isActive: true }), today)).toBe('active')
    expect(sessionStatus(session({ date: '2026-10-30' }), today)).toBe('upcoming')
    expect(sessionStatus(session({ date: '2026-10-27' }), today)).toBe('upcoming')
    expect(sessionStatus(session({ endedAt: '2026-10-27T02:00:00.000Z' }), today)).toBe('completed')
    expect(sessionStatus(session({ date: '2026-10-01' }), today)).toBe('completed')
  })

  it('filters by subject, section, status and date', () => {
    const sessions = [
      session({ id: 'active', isActive: true }),
      session({ id: 'past', date: '2026-10-01' }),
      session({ id: 'other', sectionId: 'sec-2', date: '2026-10-28' }),
      session({ id: 'future', date: '2026-11-10' }),
    ]
    const filters = { today: '2026-10-27', subjectForSection: subjectFor }

    expect(filterSessions(sessions, { status: 'active' }, filters).map((s) => s.id)).toEqual(['active'])
    expect(filterSessions(sessions, { subjectId: 'subj-2' }, filters).map((s) => s.id)).toEqual(['other'])
    expect(filterSessions(sessions, { sectionId: 'sec-1' }, filters).map((s) => s.id)).toEqual(['active', 'past', 'future'])
    expect(filterSessions(sessions, { startDate: '2026-10-27', endDate: '2026-10-31' }, filters).map((s) => s.id)).toEqual(['active', 'other'])
  })
})
