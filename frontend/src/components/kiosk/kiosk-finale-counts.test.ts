import { describe, expect, it } from 'vitest'
import type { AttendanceRecord } from '@polycheck/shared'
import { finaleCountsForFallback, recordsToCounts } from './kiosk-finale-counts'

function record(id: string, status: AttendanceRecord['status']): AttendanceRecord {
  return {
    id,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: `student-${id}`,
    studentName: `Student ${id}`,
    timestamp: '2026-11-10T08:00:00.000Z',
    status,
    coordinates: { latitude: null, longitude: null },
    isSynced: true,
  }
}

describe('kiosk finale counts (WEB-06)', () => {
  it('counts every finale bucket from a successful refetch', () => {
    const counts = recordsToCounts([
      record('1', 'present'),
      record('2', 'present'),
      record('3', 'late'),
      record('4', 'absent'),
      record('5', 'incomplete'),
      record('6', 'excused'),
      record('7', 'disputed'),
      record('8', 'pending'),
    ])

    expect(counts).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      incomplete: 1,
      disputed: 1,
      pending: 1,
    })
  })

  it('keeps the last known counts when the final refetch fails', () => {
    // The projector had already learned these from the roster + live deltas.
    const statuses = new Map<string, string>([
      ['rec-1', 'present'],
      ['rec-2', 'present'],
      ['rec-3', 'late'],
      ['rec-4', 'absent'],
      ['rec-5', 'pending'],
    ])

    const counts = finaleCountsForFallback(null, statuses)

    expect(counts.present).toBe(2)
    expect(counts.late).toBe(1)
    expect(counts.absent).toBe(1)
    expect(counts.pending).toBe(1)
    // Not the zero-everything regression the old `recordsToCounts([])` produced.
    expect(counts.present + counts.late).toBe(3)
  })

  it('prefers the refetched records over the status map when both exist', () => {
    const statuses = new Map<string, string>([['rec-1', 'present']])
    const counts = finaleCountsForFallback([record('9', 'absent')], statuses)

    expect(counts.absent).toBe(1)
    expect(counts.present).toBe(0)
  })

  it('reports all zeros only when no record was ever observed', () => {
    expect(finaleCountsForFallback(null, new Map())).toEqual(recordsToCounts([]))
    expect(recordsToCounts([])).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      incomplete: 0,
      disputed: 0,
      pending: 0,
    })
  })

  it('ignores statuses the finale contract does not count', () => {
    const statuses = new Map<string, string>([
      ['rec-1', 'present'],
      ['rec-2', 'not-a-status'],
    ])
    expect(finaleCountsForFallback(null, statuses).present).toBe(1)
  })
})
