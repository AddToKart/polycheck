import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatCampusDate,
  getRecentCampusDateRange,
  formatTime,
  getDayName,
  getDayNameFull,
  getMonthName,
  getWeekDays,
  getMonthDays,
  getDateRangeForMonth,
  getDateRangeForWeek,
  getWeeksInMonth,
  isSameDay,
  generateCalendarEvents,
  generateStudentCalendarEvents,
} from './calendar'
import type { Section } from '../types/subject'
import type { Session } from '../types/session'

const section1: Section = {
  id: 'sec-1',
  subjectId: 'sub-1',
  section: 'BSIT-3A',
  room: 'R301',
  schedule: [{ day: 'Mon', startTime: '08:00', endTime: '09:30', room: 'R301' }],
  semester: '1st Sem 2026-2027',
  teacherId: 'tch-1',
  teacherName: 'Dr. Ada Lovelace',
  studentCount: 40,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

const section2: Section = {
  ...section1,
  id: 'sec-2',
  subjectId: 'sub-2',
  section: 'BSIT-3B',
  room: 'R302',
  schedule: [{ day: 'Wed', startTime: '10:00', endTime: '11:30', room: 'R302' }],
}

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: 'ses-1',
    sectionId: 'sec-1',
    subjectName: 'Data Structures',
    date: '2026-08-03',
    startTime: '08:00',
    endTime: '09:30',
    room: 'R301',
    qrValidityMinutes: 30,
    gracePeriodMinutes: 15,
    geofence: { latitude: 14.5995, longitude: 120.9842, radiusMeters: 50 },
    isActive: true,
    teacherId: 'tch-1',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('formatDate', () => {
  it('formats dates as YYYY-MM-DD with zero padding', () => {
    expect(formatDate(new Date(2026, 7, 2))).toBe('2026-08-02')
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('formatCampusDate', () => {
  it('shifts a UTC instant into the PUP (UTC+08:00) civil date', () => {
    // 2026-08-01T20:00:00Z + 8h crosses into 2026-08-02
    expect(formatCampusDate(new Date('2026-08-01T20:00:00Z'))).toBe('2026-08-02')
    // 2026-08-02T00:30:00Z + 8h stays on 2026-08-02
    expect(formatCampusDate(new Date('2026-08-02T00:30:00Z'))).toBe('2026-08-02')
    // 2026-08-02T15:59:59Z + 8h stays on 2026-08-02
    expect(formatCampusDate(new Date('2026-08-02T15:59:59Z'))).toBe('2026-08-02')
  })
})

describe('getRecentCampusDateRange', () => {
  it('returns a 7-day range ending on the campus date', () => {
    expect(getRecentCampusDateRange(7, new Date('2026-08-02T12:00:00Z'))).toEqual({
      startDate: '2026-07-27',
      endDate: '2026-08-02',
    })
  })

  it('clamps days below 1 to a single-day range', () => {
    expect(getRecentCampusDateRange(0, new Date('2026-08-02T12:00:00Z'))).toEqual({
      startDate: '2026-08-02',
      endDate: '2026-08-02',
    })
  })
})

describe('formatTime', () => {
  it('formats 12-hour clock times', () => {
    expect(formatTime('08:30')).toBe('08:30 AM')
    expect(formatTime('13:05')).toBe('01:05 PM')
    expect(formatTime('00:00')).toBe('12:00 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
  })

  it('ignores seconds beyond the first two parts', () => {
    expect(formatTime('09:00:00')).toBe('09:00 AM')
    expect(formatTime('17:45:30')).toBe('05:45 PM')
  })

  it('returns the input unchanged for non-time strings', () => {
    expect(formatTime('abc')).toBe('abc')
    expect(formatTime('9:xx')).toBe('9:xx')
  })

  it('returns an empty string for missing input', () => {
    expect(formatTime(undefined)).toBe('')
    expect(formatTime('')).toBe('')
  })
})

describe('day and month name helpers', () => {
  it('maps day indices to short and full names', () => {
    expect(getDayName(0)).toBe('Sun')
    expect(getDayName(3)).toBe('Wed')
    expect(getDayName(6)).toBe('Sat')
    expect(getDayName(7)).toBe('')
    expect(getDayNameFull(0)).toBe('Sunday')
    expect(getDayNameFull(6)).toBe('Saturday')
    expect(getDayNameFull(7)).toBe('')
  })

  it('maps month indices to names', () => {
    expect(getMonthName(0)).toBe('January')
    expect(getMonthName(7)).toBe('August')
    expect(getMonthName(11)).toBe('December')
    expect(getMonthName(12)).toBe('')
  })
})

describe('getWeekDays', () => {
  it('returns the full week (Sunday to Saturday) containing the date', () => {
    // 2026-08-05 is a Wednesday; the week runs 2026-08-02 .. 2026-08-08
    const week = getWeekDays(new Date(2026, 7, 5))
    expect(week).toHaveLength(7)
    expect(week.map((d) => d.day)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(week.map((d) => d.date)).toEqual([
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
    ])
    expect(week.every((d) => typeof d.isToday === 'boolean')).toBe(true)
    expect(week.every((d) => d.isCurrentMonth)).toBe(true)
  })

  it('marks days from the adjacent month as not in the current month', () => {
    // 2026-08-01 is a Saturday; the week starts 2026-07-26 (Sunday)
    const week = getWeekDays(new Date(2026, 7, 1))
    expect(week[0]).toEqual({ day: 'Sun', date: '2026-07-26', isToday: expect.any(Boolean), isCurrentMonth: false })
    expect(week[6]).toMatchObject({ day: 'Sat', date: '2026-08-01', isCurrentMonth: true })
  })
})

describe('getMonthDays / getWeeksInMonth', () => {
  it('builds a 6-row grid for August 2026 (starts Saturday, 31 days)', () => {
    const grid = getMonthDays(2026, 7)
    expect(grid).toHaveLength(6)
    expect(grid.every((row) => row.length === 7)).toBe(true)

    const flat = grid.flat()
    const nonNull = flat.filter((d): d is Date => d !== null)
    expect(nonNull).toHaveLength(31)
    expect(nonNull.every((d) => d.getMonth() === 7 && d.getFullYear() === 2026)).toBe(true)

    // First row: 6 nulls (Sat-start) then Aug 1
    expect(grid[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(grid[0][6]).not.toBeNull()
    expect(grid[0][6]!.getDate()).toBe(1)
  })

  it('builds a 5-row grid for February 2025 (28 days, Saturday start)', () => {
    const grid = getMonthDays(2025, 1)
    expect(grid).toHaveLength(5)
    const flat = grid.flat()
    expect(flat.filter((d): d is Date => d !== null)).toHaveLength(28)
    expect(grid[0][6]).not.toBeNull()
    expect(grid[0][6]!.getDate()).toBe(1)
  })

  it('reports the row count as weeks in the month', () => {
    expect(getWeeksInMonth(2026, 7)).toBe(6)
    expect(getWeeksInMonth(2025, 1)).toBe(5)
  })
})

describe('getDateRangeForMonth / getDateRangeForWeek', () => {
  it('returns the first and last day of the month', () => {
    expect(getDateRangeForMonth(2026, 7)).toEqual({ start: '2026-08-01', end: '2026-08-31' })
    expect(getDateRangeForMonth(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('returns the Sunday-to-Saturday range of the week', () => {
    expect(getDateRangeForWeek(new Date(2026, 7, 5))).toEqual({ start: '2026-08-02', end: '2026-08-08' })
  })
})

describe('isSameDay', () => {
  it('is true for the same calendar day at different times', () => {
    expect(isSameDay(new Date(2026, 7, 2, 1, 0), new Date(2026, 7, 2, 23, 59))).toBe(true)
  })

  it('is false across days, months, and years', () => {
    expect(isSameDay(new Date(2026, 7, 2), new Date(2026, 7, 3))).toBe(false)
    expect(isSameDay(new Date(2026, 6, 2), new Date(2026, 7, 2))).toBe(false)
    expect(isSameDay(new Date(2025, 7, 2), new Date(2026, 7, 2))).toBe(false)
  })
})

describe('generateCalendarEvents', () => {
  it('renders sessions plus ghost schedule slots, sorted by date then start time', () => {
    const sessions: Session[] = [
      makeSession({ id: 'ses-1', subjectName: 'Data Structures' }),
      makeSession({ id: 'ses-3', date: '2026-08-03', startTime: '13:00', endTime: '14:30', subjectName: 'Discrete Math' }),
    ]
    const events = generateCalendarEvents([section1, section2], sessions, '2026-08-02', '2026-08-08')

    expect(events.map((e) => e.id)).toEqual([
      'ses-1',
      'ses-3',
      'schedule-sec-2-2026-08-05-Wed',
    ])

    expect(events[0]).toMatchObject({
      type: 'session',
      status: 'active',
      title: 'Data Structures',
      date: '2026-08-03',
      sectionName: 'BSIT-3A',
    })

    expect(events[2]).toMatchObject({
      type: 'schedule',
      title: 'BSIT-3B',
      date: '2026-08-05',
      startTime: '10:00',
      endTime: '11:30',
      room: 'R302',
    })
  })

  it('does not emit a ghost slot on a day a regular session exists', () => {
    const sessions: Session[] = [makeSession({ id: 'ses-1' })]
    const events = generateCalendarEvents([section1], sessions, '2026-08-02', '2026-08-08')
    // ses-1 occupies Mon 2026-08-03 -> no schedule-sec-1-... ghost for that day
    expect(events.map((e) => e.id)).toEqual(['ses-1'])
  })

  it('renders a moved slot when the regular session was rescheduled', () => {
    const rescheduled = makeSession({
      id: 'ses-2',
      date: '2026-08-05',
      startTime: '09:00',
      endTime: '10:30',
      room: 'R305',
      isRescheduled: true,
      rescheduledFromDate: '2026-08-03',
    })
    const events = generateCalendarEvents([section1], [rescheduled], '2026-08-02', '2026-08-08')

    // Sorted by date: the moved slot (2026-08-03) precedes the rescheduled session (2026-08-05)
    expect(events.map((e) => e.id)).toEqual([
      'schedule-moved-sec-1-2026-08-03-Mon',
      'ses-2',
    ])
    expect(events[0]).toMatchObject({
      type: 'schedule',
      status: 'moved',
      date: '2026-08-03',
      startTime: '08:00',
      rescheduledTo: { date: '2026-08-05', startTime: '09:00', endTime: '10:30', room: 'R305' },
    })
  })

  it('skips sessions outside the range and sessions with unknown sections', () => {
    const sessions: Session[] = [
      makeSession({ id: 'early', date: '2026-08-01' }), // before range
      makeSession({ id: 'late', date: '2026-08-09' }), // after range
      makeSession({ id: 'unknown-section', sectionId: 'sec-ghost' }), // no matching section
    ]
    const events = generateCalendarEvents([section1], sessions, '2026-08-02', '2026-08-08')
    // Only the plain schedule ghost for Mon 2026-08-03 remains
    expect(events.map((e) => e.id)).toEqual(['schedule-sec-1-2026-08-03-Mon'])
  })
})

describe('generateStudentCalendarEvents', () => {
  it('renders session events with subject code and teacher name, plus ghosts', () => {
    const sessions: Session[] = [
      makeSession({ id: 'ses-1' }),
      // sec-2's schedule slot is Wed 2026-08-05; this session is on Thu so the Wed ghost remains
      makeSession({ id: 'ses-2', sectionId: 'sec-2', date: '2026-08-06', subjectName: 'Operating Systems' }),
    ]
    const events = generateStudentCalendarEvents(
      [section1, section2],
      sessions,
      [],
      (subjectId) => (subjectId === 'sub-1' ? { name: 'Data Structures', code: 'CSC 104' } : undefined),
      '2026-08-02',
      '2026-08-08'
    )

    expect(events.map((e) => e.id)).toEqual(['ses-1', 'ghost-sec-2-2026-08-05-Wed', 'ses-2'])

    expect(events[0]).toMatchObject({
      id: 'ses-1',
      type: 'session',
      title: 'Data Structures',
      subjectCode: 'CSC 104',
      teacherName: 'Dr. Ada Lovelace',
      sectionName: 'BSIT-3A',
    })
    expect(events[1]).toMatchObject({
      id: 'ghost-sec-2-2026-08-05-Wed',
      type: 'schedule',
      title: '',
      date: '2026-08-05',
    })
    expect(events[2]).toMatchObject({
      id: 'ses-2',
      type: 'session',
      title: 'Operating Systems',
    })
    expect(events[2].subjectCode).toBeUndefined()
  })
})
