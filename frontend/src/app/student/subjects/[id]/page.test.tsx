// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import type { Section, Session, Student } from '@polycheck/shared'

// ── Hoisted mock state (mirrors role-pages.test.tsx conventions) ───────────
const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getStudentRoles: vi.fn(),
  checkSessionPermission: vi.fn(),
  getSection: vi.fn(),
  getSubject: vi.fn(),
  getSessions: vi.fn(),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => ({ id: 'sec-1' }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))

// ── Import AFTER mocks ──────────────────────────────────────────────────────
import StudentSubjectDetailPage from './page'

const student: Student = {
  id: 'stu-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Student One',
  role: 'student',
  program: 'BSIT',
  yearLevel: 2,
  isActive: true,
  enrolledSectionIds: ['sec-1'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const section: Section = {
  id: 'sec-1',
  subjectId: 'subj-1',
  section: 'BSIT-2B',
  room: 'Room 304',
  schedule: [{ day: 'Mon', startTime: '08:00', endTime: '09:30', room: 'Room 304' }],
  semester: '1st Semester 2025-2026',
  teacherId: 'teacher-1',
  teacherName: 'Prof. Juan Dela Cruz',
  studentCount: 40,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const subject = {
  id: 'subj-1',
  name: 'Data Structures and Algorithms',
  code: 'CS-101',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const sessions: Session[] = [
  {
    id: 'sess-1',
    sectionId: 'sec-1',
    subjectName: 'Data Structures and Algorithms',
    date: '2026-07-10',
    startTime: '08:00',
    endTime: '09:30',
    room: 'Room 304',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
    isActive: true,
    teacherId: 'teacher-1',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 'sess-2',
    sectionId: 'sec-1',
    subjectName: 'Data Structures and Algorithms',
    date: '2026-07-03',
    startTime: '10:00',
    endTime: '11:30',
    room: 'Lab 2',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
    isActive: false,
    teacherId: 'teacher-1',
    createdAt: '2026-06-24T00:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getCurrentUser.mockReturnValue(student)
  apiMock.getStudentRoles.mockResolvedValue([])
  apiMock.getSection.mockResolvedValue(section)
  apiMock.getSubject.mockResolvedValue(subject)
  apiMock.getSessions.mockResolvedValue(sessions)
})

describe('Student subject detail page', () => {
  it('renders subject info and session history from the mocked api', async () => {
    render(<StudentSubjectDetailPage />)

    expect(
      await screen.findByRole('heading', { name: 'Data Structures and Algorithms' }),
    ).toBeInTheDocument()
    expect(screen.getByText('CS-101 · Section BSIT-2B')).toBeInTheDocument()
    expect(screen.getByText('Prof. Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Room 304')).toBeInTheDocument()
    expect(screen.getByText('1st Semester 2025-2026')).toBeInTheDocument()

    // Session history rows, newest first
    const sessionLinks = screen.getAllByRole('link')
    expect(sessionLinks).toHaveLength(2)
    expect(sessionLinks[0]).toHaveAttribute('href', '/student/subjects/sec-1/sessions/sess-1')
    expect(sessionLinks[1]).toHaveAttribute('href', '/student/subjects/sec-1/sessions/sess-2')
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiMock.getSection).toHaveBeenCalledWith('sec-1')
      expect(apiMock.getSessions).toHaveBeenCalledWith('sec-1')
    })
  })

  it('is read-only for a regular student — no create/edit controls', async () => {
    render(<StudentSubjectDetailPage />)
    await screen.findByRole('heading', { name: 'Data Structures and Algorithms' })

    // A student without roles gets no president-only controls
    expect(screen.queryByRole('button', { name: /create session/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/create session/i)).not.toBeInTheDocument()

    // Roles were fetched, but the president-only permission check never ran
    expect(apiMock.getStudentRoles).toHaveBeenCalledWith('stu-1')
    expect(apiMock.checkSessionPermission).not.toHaveBeenCalled()
    // No mutation api calls happened
    expect(apiMock.logout).not.toHaveBeenCalled()
  })
})
