import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Section, Student, Subject, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSection: vi.fn(),
  getSectionStudents: vi.fn(),
  getSectionSessions: vi.fn(),
  getSectionRoles: vi.fn(),
  getActiveSessionPermissions: vi.fn(),
  getStudents: vi.fn(),
  getSubject: vi.fn(),
  downloadAssistantFile: vi.fn(),
  logout: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => ({ id: 'sec-1' }),
}))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))
vi.mock('@/components/import/BulkImportDialog', () => ({
  BulkImportDialog: () => null,
}))

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = () => {}
})

import SectionDetailPage from './page'
import { NotificationProvider } from '@/lib/notifications'

const teacherUser: User = {
  id: 't-001',
  fullName: 'Prof. Juan Dela Cruz',
  role: 'teacher',
  department: 'CCIS',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const subject: Subject = {
  id: 'subj-1',
  name: 'Introduction to Computing',
  code: 'CS 101',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const section: Section = {
  id: 'sec-1',
  subjectId: 'subj-1',
  section: 'A',
  room: 'CS Lab 1',
  schedule: [{ day: 'Mon', startTime: '08:00', endTime: '11:00', room: 'CS Lab 1' }],
  semester: '1st Semester 2026-2027',
  teacherId: 't-001',
  teacherName: 'Prof. Juan Dela Cruz',
  enrollmentCode: 'ENROLL1',
  studentCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const rosterStudent: Student & {
  attendance: { present: number; late: number; absent: number }
} = {
  id: 's-001',
  studentId: '2026-01234',
  fullName: 'Ana Reyes',
  role: 'student',
  program: 'BS Computer Science',
  yearLevel: 1,
  enrolledSectionIds: ['sec-1'],
  isActive: true,
  attendance: { present: 9, late: 1, absent: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderPage() {
  return render(
    <NotificationProvider>
      <SectionDetailPage />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  apiMock.getCurrentUser.mockReturnValue(teacherUser)
  apiMock.getSection.mockResolvedValue(section)
  apiMock.getSectionStudents.mockResolvedValue([rosterStudent])
  apiMock.getSectionSessions.mockResolvedValue([])
  apiMock.getSectionRoles.mockResolvedValue([])
  apiMock.getActiveSessionPermissions.mockResolvedValue([])
  apiMock.getStudents.mockResolvedValue([rosterStudent])
  apiMock.getSubject.mockResolvedValue(subject)
})

afterEach(cleanup)

describe('Section detail page (F4 class record export)', () => {
  it('renders the section with the "Class record (PUP)" export action', async () => {
    renderPage()

    expect(
      await screen.findByRole('button', { name: 'Class record (PUP)' }),
    ).toBeEnabled()
    expect(screen.getAllByText('Introduction to Computing').length).toBeGreaterThan(0)
  })

  it('renders a retryable error state when the section load fails', async () => {
    apiMock.getSection.mockRejectedValueOnce(new Error('Backend unavailable'))

    renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(
      await screen.findByRole('button', { name: 'Class record (PUP)' }),
    ).toBeEnabled()
  })

  it('downloads the class record through the authenticated docs path', async () => {
    apiMock.downloadAssistantFile.mockResolvedValue(new Blob(['%PDF-fake']))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Class record (PUP)' }))

    await waitFor(() =>
      expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
        '/docs/class-record/sec-1?format=pdf',
      ),
    )
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(await screen.findByText('Class record downloaded')).toBeInTheDocument()
  })

  it('surfaces download failures as an error toast and keeps the button usable', async () => {
    apiMock.downloadAssistantFile.mockRejectedValue(new Error('Not authorized for this section'))

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Class record (PUP)' }))

    expect(await screen.findByText('Download failed')).toBeInTheDocument()
    expect(screen.getByText('Not authorized for this section')).toBeInTheDocument()

    apiMock.downloadAssistantFile.mockResolvedValue(new Blob(['%PDF-fake']))
    fireEvent.click(screen.getByRole('button', { name: 'Class record (PUP)' }))
    await waitFor(() =>
      expect(apiMock.downloadAssistantFile).toHaveBeenCalledTimes(2),
    )
  })

  it('ignores re-entrant clicks while a download is pending', async () => {
    let resolveDownload: (value: Blob) => void = () => {}
    apiMock.downloadAssistantFile.mockReturnValue(
      new Promise<Blob>((resolve) => {
        resolveDownload = resolve
      }),
    )

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Class record (PUP)' }))
    expect(screen.getByRole('button', { name: 'Class record (PUP)' })).toBeDisabled()

    resolveDownload(new Blob(['%PDF-fake']))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Class record (PUP)' })).toBeEnabled(),
    )
    expect(apiMock.downloadAssistantFile).toHaveBeenCalledTimes(1)
  })
})
