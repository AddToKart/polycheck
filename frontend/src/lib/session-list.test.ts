import { describe, expect, it } from 'vitest'
import { canReschedule, sortSessions } from './session-list'
import { matchesQuery } from './list-search'

const session = (date: string, startTime = '09:00', subjectName = 'A') => ({
  id: `${date}-${startTime}`,
  date,
  startTime,
  subjectName,
  sectionId: 'sec',
})
const rows = [session('2026-11-30'), session('2026-11-02'), session('2026-12-07'), session('2026-11-09')]
const dates = (list: { date: string }[]) => list.map((row) => row.date.slice(5))

describe('sortSessions', () => {
  it('lists the newest date first by default without changing the input', () => {
    expect(dates(sortSessions(rows, ''))).toEqual(['12-07', '11-30', '11-09', '11-02'])
    expect(dates(rows)).toEqual(['11-30', '11-02', '12-07', '11-09'])
  })

  it('can list the oldest date first', () => {
    expect(dates(sortSessions(rows, 'oldest'))).toEqual(['11-02', '11-09', '11-30', '12-07'])
  })

  it('puts the next class first and past classes afterwards, latest first', () => {
    expect(dates(sortSessions(rows, 'upcoming', '2026-11-28'))).toEqual(['11-30', '12-07', '11-09', '11-02'])
  })

  it('sorts by subject, then newest', () => {
    const mixed = [session('2026-11-02', '09:00', 'Zoology'), session('2026-11-09', '09:00', 'Algebra')]
    expect(sortSessions(mixed, 'subject').map((row) => row.subjectName)).toEqual(['Algebra', 'Zoology'])
  })
})

describe('canReschedule', () => {
  it('allows a class that has never been started', () => {
    expect(canReschedule({ isActive: false })).toBe(true)
  })

  it.each([
    { isActive: true },
    { isActive: false, endedAt: '2026-11-28T00:00:00Z' },
    { isActive: false, qrToken: 'token' },
    { isActive: false, startQrToken: 'token' },
    { isActive: false, autoEndAt: '2026-11-28T00:00:00Z' },
  ])('refuses once it has been started: %j', (state) => {
    expect(canReschedule(state)).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('needs every word, in any order, across the fields', () => {
    expect(matchesQuery('finance 4-2', ['Business Finance', 'Section 4-2'])).toBe(true)
    expect(matchesQuery('finance 4-1', ['Business Finance', 'Section 4-2'])).toBe(false)
    expect(matchesQuery('   ', [undefined])).toBe(true)
  })
})
