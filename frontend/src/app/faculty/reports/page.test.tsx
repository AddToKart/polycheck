import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceReport, Section, Subject } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSubjects: vi.fn(),
  getSections: vi.fn(),
  getTeachers: vi.fn(),
  getAttendanceReport: vi.fn(),
  exportAttendanceCsv: vi.fn(),
  downloadAssistantFile: vi.fn(),
  logout: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = () => {}
})

import ReportsPage from './page'
import { NotificationProvider } from '@/lib/notifications'

const superAdmin = {
  id: 'admin-1',
  fullName: 'System Administrator',
  email: 'admin@pup.edu.ph',
  role: 'super_admin' as const,
  scope: 'institution' as const,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const subjects: Subject[] = [
  {
    id: 'subj-1',
    name: 'Introduction to Computing',
    code: 'CS 101',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const sections: Section[] = [
  {
    id: 'sec-1',
    subjectId: 'subj-1',
    section: 'A',
    room: 'CS Lab 1',
    schedule: [],
    semester: '1st Semester 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Dela Cruz',
    studentCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sec-2',
    subjectId: 'subj-1',
    section: 'B',
    room: 'CS Lab 2',
    schedule: [],
    semester: '1st Semester 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Dela Cruz',
    studentCount: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const emptyReport: AttendanceReport = {
  range: { startDate: '2026-06-19', endDate: '2026-07-18' },
  totals: {
    totalRecords: 0,
    totalSessions: 0,
    present: 0,
    late: 0,
    absent: 0,
    pending: 0,
    disputed: 0,
    excused: 0,
    incomplete: 0,
  },
  summaries: [],
}

function renderPage() {
  return render(
    <NotificationProvider>
      <ReportsPage />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  apiMock.getCurrentUser.mockReturnValue(superAdmin)
  apiMock.getSubjects.mockResolvedValue(subjects)
  apiMock.getSections.mockResolvedValue(sections)
  apiMock.getTeachers.mockResolvedValue([])
  apiMock.getAttendanceReport.mockResolvedValue(emptyReport)
  apiMock.exportAttendanceCsv.mockResolvedValue('')
})

afterEach(cleanup)

describe('Reports page (F4 class record export)', () => {
  it('omits the class record action until a section filter is chosen', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Export$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Class record' })).not.toBeInTheDocument()
  })

  it('exports the official PUP class record when a section is selected', async () => {
    apiMock.downloadAssistantFile.mockResolvedValue(new Blob(['%PDF-fake']))

    renderPage()

    await screen.findByRole('heading', { name: 'Reports' })
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'sec-1' } })
    await waitFor(() => expect(apiMock.getAttendanceReport).toHaveBeenCalledTimes(2))

    fireEvent.click(await screen.findByRole('button', { name: 'Class record' }))

    await waitFor(() =>
      expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
        '/docs/class-record/sec-1?format=pdf',
      ),
    )
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(await screen.findByText('Class record downloaded')).toBeInTheDocument()

    // Selecting another section re-exports from the new section id.
    apiMock.downloadAssistantFile.mockClear()
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'sec-2' } })
    await waitFor(() => expect(apiMock.getAttendanceReport).toHaveBeenCalledTimes(3))
    fireEvent.click(screen.getByRole('button', { name: 'Class record' }))
    await waitFor(() =>
      expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
        '/docs/class-record/sec-2?format=pdf',
      ),
    )
  })

  it('surfaces download failures as an error toast', async () => {
    apiMock.downloadAssistantFile.mockRejectedValue(new Error('Not authorized for this section'))

    renderPage()

    await screen.findByRole('heading', { name: 'Reports' })
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'sec-1' } })

    fireEvent.click(await screen.findByRole('button', { name: 'Class record' }))

    expect(await screen.findByText('Download failed')).toBeInTheDocument()
    expect(screen.getByText('Not authorized for this section')).toBeInTheDocument()
  })
})
