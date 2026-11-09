import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Section } from '@polycheck/shared'
import { StudentsAtRiskCard } from './StudentsAtRiskCard'

const sections: Section[] = [
  {
    id: 'sec-1',
    subjectId: 'subj-1',
    section: '4-1',
    course: 'BSIT',
    room: 'CCIS Lab 3',
    schedule: [{ day: 'Mon', startTime: '08:00', endTime: '10:30' }],
    semester: '1st Semester 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Dela Cruz',
    studentCount: 20,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sec-2',
    subjectId: 'subj-1',
    section: '2-A',
    room: 'Room 101',
    schedule: [{ day: 'Tue', startTime: '13:00', endTime: '14:30' }],
    semester: '1st Semester 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Dela Cruz',
    studentCount: 18,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

afterEach(cleanup)

describe('StudentsAtRiskCard section options', () => {
  it('appends the course when present and keeps legacy section labels unchanged', () => {
    render(
      <StudentsAtRiskCard
        students={[]}
        sections={sections}
        sectionId=""
        loading={false}
        error=""
        onSectionChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: 'Section 4-1 · BSIT' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Section 2-A' })).toBeInTheDocument()
  })
})
