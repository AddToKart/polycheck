import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CUSTOM_SLOT_VALUE,
  buildBulkRows,
  buildBulkSlots,
  countSlotOccurrences,
  dayOfWeek,
  defaultSlotSelection,
  firstInvalidSlotRow,
  nextOccurrenceDate,
  parseCampusDate,
  slotLabel,
  slotSelectionForDate,
  type BulkSlotRow,
} from './session-slots'

const row = (
  day: string,
  startTime = '08:00',
  endTime = '10:00',
  selected = true,
): BulkSlotRow => ({ day, startTime, endTime, selected })

afterEach(() => {
  vi.useRealTimers()
})

describe('campus date parsing', () => {
  it('parses a civil date without timezone drift', () => {
    const parsed = parseCampusDate('2026-11-10')
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(10)
    expect(parsed?.getDate()).toBe(10)
    expect(parsed?.getHours()).toBe(12)
  })

  it('rejects malformed and overflowing dates', () => {
    expect(parseCampusDate('2026-02-31')).toBeNull()
    expect(parseCampusDate('not-a-date')).toBeNull()
    expect(parseCampusDate('')).toBeNull()
  })

  it('derives the short weekday code', () => {
    expect(dayOfWeek('2026-11-10')).toBe('Tue')
    expect(dayOfWeek('2026-11-15')).toBe('Sun')
    expect(dayOfWeek('2026-11-16')).toBe('Mon')
    expect(dayOfWeek('')).toBeNull()
  })
})

describe('nextOccurrenceDate', () => {
  it('keeps the same day when the weekday already matches', () => {
    expect(nextOccurrenceDate('Tue', '2026-11-10')).toBe('2026-11-10')
  })

  it('moves to the next instance within the week', () => {
    expect(nextOccurrenceDate('Wed', '2026-11-10')).toBe('2026-11-11')
    expect(nextOccurrenceDate('Mon', '2026-11-10')).toBe('2026-11-16')
  })

  it('wraps across a month and year boundary', () => {
    expect(nextOccurrenceDate('Fri', '2026-12-31')).toBe('2027-01-01')
    expect(nextOccurrenceDate('Thu', '2026-12-31')).toBe('2026-12-31')
  })

  it('falls back to the supplied date for unknown weekdays or bad input', () => {
    expect(nextOccurrenceDate('Funday', '2026-11-10')).toBe('2026-11-10')
    expect(nextOccurrenceDate('Mon', 'bad-date')).toBe('bad-date')
  })

  it('defaults "today" to the Asia/Manila campus date', () => {
    vi.useFakeTimers()
    // 09:00 on Tuesday 10 Nov 2026 in Manila.
    vi.setSystemTime(new Date('2026-11-10T01:00:00.000Z'))
    expect(nextOccurrenceDate('Tue')).toBe('2026-11-10')
    expect(nextOccurrenceDate('Mon')).toBe('2026-11-16')
  })
})

describe('slotLabel', () => {
  it('formats the day, time range and room', () => {
    expect(
      slotLabel({ day: 'Mon', startTime: '08:00', endTime: '10:30', room: 'CCIS Lab 3' }),
    ).toBe('Mon 08:00–10:30 (CCIS Lab 3)')
  })

  it('omits empty rooms', () => {
    expect(slotLabel({ day: 'Wed', startTime: '09:00', endTime: '12:30' })).toBe(
      'Wed 09:00–12:30',
    )
    expect(
      slotLabel({ day: 'Wed', startTime: '09:00', endTime: '12:30', room: '   ' }),
    ).toBe('Wed 09:00–12:30')
  })
})

describe('slot selection defaults', () => {
  const schedule = [
    { day: 'Mon', startTime: '08:00', endTime: '10:30' },
    { day: 'Wed', startTime: '09:00', endTime: '12:30' },
  ]

  it('defaults to the slot matching the current date weekday', () => {
    expect(defaultSlotSelection(schedule, '2026-11-09')).toBe('0') // Monday
    expect(defaultSlotSelection(schedule, '2026-11-11')).toBe('1') // Wednesday
  })

  it('defaults to the first slot when no weekday matches', () => {
    expect(defaultSlotSelection(schedule, '2026-11-10')).toBe('0') // Tuesday
    expect(defaultSlotSelection(schedule, 'bad-date')).toBe('0')
  })

  it('defaults to the custom option when there is no schedule', () => {
    expect(defaultSlotSelection([], '2026-11-10')).toBe(CUSTOM_SLOT_VALUE)
  })

  it('represents unscheduled dates as custom when the date changes', () => {
    expect(slotSelectionForDate(schedule, '2026-11-11')).toBe('1')
    expect(slotSelectionForDate(schedule, '2026-11-10')).toBe(CUSTOM_SLOT_VALUE)
    expect(slotSelectionForDate(schedule, 'bad-date')).toBe(CUSTOM_SLOT_VALUE)
  })
})

describe('buildBulkRows', () => {
  it('derives one selected row per schedule slot, preserving order and times', () => {
    const rows = buildBulkRows(
      [
        { day: 'Mon', startTime: '08:00', endTime: '10:30', room: 'Room A' },
        { day: 'Wed', startTime: '09:00', endTime: '12:30' },
      ],
      'CCIS Lab 3',
    )
    expect(rows).toStrictEqual([
      { day: 'Mon', startTime: '08:00', endTime: '10:30', room: 'Room A', selected: true },
      { day: 'Wed', startTime: '09:00', endTime: '12:30', room: 'CCIS Lab 3', selected: true },
    ])
  })

  it('omits the room when the slot and fallback room are blank', () => {
    expect(buildBulkRows([{ day: 'Fri', startTime: '13:00', endTime: '14:00' }], '  ')).toStrictEqual([
      { day: 'Fri', startTime: '13:00', endTime: '14:00', selected: true },
    ])
  })
})

describe('countSlotOccurrences', () => {
  it('sums each selected slot over the date range', () => {
    // November 2026: Sundays fall on 1/8/15/22/29, Mondays 2/9/16/23/30,
    // Wednesdays 4/11/18/25.
    expect(countSlotOccurrences([row('Mon'), row('Wed')], '2026-11-01', '2026-11-30')).toBe(9)
  })

  it('ignores unselected rows', () => {
    expect(
      countSlotOccurrences([row('Mon'), row('Wed', '09:00', '12:30', false)], '2026-11-01', '2026-11-30'),
    ).toBe(5)
  })

  it('counts each occurrence for duplicate weekdays', () => {
    expect(countSlotOccurrences([row('Mon'), row('Mon', '13:00', '15:00')], '2026-11-01', '2026-11-07')).toBe(2)
  })

  it('handles single-day ranges', () => {
    expect(countSlotOccurrences([row('Tue')], '2026-11-10', '2026-11-10')).toBe(1)
    expect(countSlotOccurrences([row('Mon')], '2026-11-10', '2026-11-10')).toBe(0)
  })

  it('returns zero for empty, invalid, or reversed ranges', () => {
    expect(countSlotOccurrences([], '2026-11-01', '2026-11-30')).toBe(0)
    expect(countSlotOccurrences([row('Mon')], '2026-11-30', '2026-11-01')).toBe(0)
    expect(countSlotOccurrences([row('Mon')], 'bad', '2026-11-30')).toBe(0)
    expect(countSlotOccurrences([row('Mon')], '2026-11-01', '')).toBe(0)
  })

  it('counts a full week once per selected slot', () => {
    const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => row(day))
    expect(countSlotOccurrences(rows, '2026-11-01', '2026-11-07')).toBe(7)
  })
})

describe('firstInvalidSlotRow', () => {
  it('flags selected rows whose end is not after the start', () => {
    expect(firstInvalidSlotRow([row('Mon', '08:00', '08:00')])?.day).toBe('Mon')
    expect(firstInvalidSlotRow([row('Mon', '10:00', '09:00')])?.day).toBe('Mon')
    expect(firstInvalidSlotRow([row('Mon', '', '09:00')])?.day).toBe('Mon')
  })

  it('ignores unselected rows and returns null when all are valid', () => {
    expect(firstInvalidSlotRow([row('Mon', '10:00', '09:00', false), row('Wed')])).toBeNull()
    expect(firstInvalidSlotRow([row('Mon'), row('Wed', '09:00', '12:30')])).toBeNull()
  })
})

describe('buildBulkSlots', () => {
  it('shapes selected rows into the slots payload', () => {
    const rows: BulkSlotRow[] = [
      { day: 'Mon', startTime: '08:00', endTime: '10:30', room: 'Room A', selected: true },
      { day: 'Wed', startTime: '09:00', endTime: '12:30', selected: false },
      { day: 'Fri', startTime: '13:00', endTime: '14:30', selected: true },
    ]
    expect(buildBulkSlots(rows)).toStrictEqual([
      { day: 'Mon', startTime: '08:00', endTime: '10:30' },
      { day: 'Fri', startTime: '13:00', endTime: '14:30' },
    ])
  })

  it('returns an empty array when nothing is selected', () => {
    expect(buildBulkSlots([row('Mon', '08:00', '10:00', false)])).toEqual([])
  })
})
