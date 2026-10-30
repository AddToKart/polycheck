import type { DashboardOverview, Section, Subject } from '@polycheck/shared'
import {
  summarizeDashboardTrends,
  TREND_SEGMENT_META,
  TREND_SEGMENT_ORDER,
} from '../lib/dashboard-trend'
import { resolveSessionSectionContext } from '../lib/session-context'
import { pupColors } from '../theme/colors'

const now = '2026-10-27T04:00:00.000Z'

const subject: Subject = {
  id: 'subj-1',
  name: 'Software Engineering',
  code: 'CS 301',
  description: 'Capstone preparation',
  createdAt: now,
  updatedAt: now,
}

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
  createdAt: now,
  updatedAt: now,
}

describe('resolveSessionSectionContext', () => {
  it('returns no context for an absent or blank route param', () => {
    expect(resolveSessionSectionContext(undefined, [section], [subject])).toBeNull()
    expect(resolveSessionSectionContext('', [section], [subject])).toBeNull()
    expect(resolveSessionSectionContext('   ', [section], [subject])).toBeNull()
  })

  it('resolves section and subject metadata for a deep link', () => {
    expect(resolveSessionSectionContext(' sec-1 ', [section], [subject])).toEqual({
      sectionId: 'sec-1',
      sectionName: '1-A',
      subjectId: 'subj-1',
      subjectName: 'Software Engineering',
      subjectCode: 'CS 301',
      known: true,
    })
  })

  it('degrades to an unknown context instead of dropping a stale deep link', () => {
    expect(resolveSessionSectionContext('sec-missing', [section], [subject])).toEqual({
      sectionId: 'sec-missing',
      sectionName: null,
      subjectId: null,
      subjectName: null,
      subjectCode: null,
      known: false,
    })
  })

  it('keeps the section when the parent subject has not loaded yet', () => {
    const context = resolveSessionSectionContext('sec-1', [section], [])
    expect(context).toMatchObject({ sectionId: 'sec-1', known: true, subjectName: null, subjectCode: null })
  })
})

describe('summarizeDashboardTrends', () => {
  const trend = (overrides: Partial<DashboardOverview['trends'][number]> = {}): DashboardOverview['trends'][number] => ({
    date: '2026-10-27',
    present: 0,
    late: 0,
    absent: 0,
    disputed: 0,
    excused: 0,
    ...overrides,
  })

  it('stacks excused and keeps it out of the attendance-rate denominator', () => {
    const summary = summarizeDashboardTrends([
      trend({ present: 5, late: 2, absent: 1, disputed: 1, excused: 3 }),
      trend({ date: '2026-10-26', present: 1 }),
    ])

    expect(summary.totals).toEqual({ present: 6, late: 2, absent: 1, disputed: 1, excused: 3 })
    expect(summary.counted).toBe(9)
    expect(summary.attended).toBe(8)
    expect(summary.attendanceRate).toBe(89)
    expect(summary.total).toBe(12)

    const excused = summary.segments.find((segment) => segment.key === 'excused')
    expect(excused).toMatchObject({ label: 'Excused', value: 3, color: pupColors.excused })
    expect(summary.segments.map((segment) => segment.key)).toEqual(['present', 'late', 'absent', 'excused'])
    expect(summary.segments.reduce((sum, segment) => sum + segment.percent, 0)).toBeCloseTo(100)
  })

  it('handles empty and zero totals without dividing by zero', () => {
    const summary = summarizeDashboardTrends([])
    expect(summary.attendanceRate).toBe(0)
    expect(summary.total).toBe(0)
    expect(summary.segments.map((segment) => segment.percent)).toEqual([0, 0, 0, 0])

    expect(summarizeDashboardTrends(undefined).totals).toEqual({ present: 0, late: 0, absent: 0, disputed: 0, excused: 0 })
  })

  it('keeps disputed out of the stack but in the totals', () => {
    const summary = summarizeDashboardTrends([trend({ present: 1, disputed: 4 })])
    expect(summary.totals.disputed).toBe(4)
    expect(summary.total).toBe(1)
    expect(summary.segments.find((segment) => segment.key === 'excused')?.percent).toBe(0)
  })

  it('tolerates an older backend that omits excused', () => {
    const legacy = [{ date: '2026-10-27', present: 2, late: 0, absent: 0, disputed: 0 }] as unknown as DashboardOverview['trends']
    const summary = summarizeDashboardTrends(legacy)
    expect(summary.totals.excused).toBe(0)
    expect(summary.total).toBe(2)
  })

  it('renders excused with a distinct token colour and segment', () => {
    expect(TREND_SEGMENT_ORDER).toContain('excused')
    expect(TREND_SEGMENT_META.excused.label).toBe('Excused')
    const colours = TREND_SEGMENT_ORDER.map((key) => TREND_SEGMENT_META[key].color)
    expect(new Set(colours).size).toBe(colours.length)
  })
})
