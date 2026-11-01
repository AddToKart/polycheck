import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(() => ({
    id: 'admin-1',
    email: 'admin@pup.edu.ph',
    fullName: 'System Administrator',
    role: 'super_admin' as const,
    scope: 'institution' as const,
  })),
  getSessions: vi.fn().mockResolvedValue([]),
  getSubjects: vi.fn().mockResolvedValue([]),
  getSections: vi.fn().mockResolvedValue([]),
  getTeachers: vi.fn().mockResolvedValue([]),
  getAttendanceRecords: vi.fn().mockResolvedValue([]),
  getAttendanceReport: vi.fn().mockResolvedValue({
    range: { startDate: '2026-06-19', endDate: '2026-07-18' },
    totals: { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0, excused: 0 },
    summaries: [],
  }),
  exportAttendanceCsv: vi.fn().mockResolvedValue(''),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const searchParamsMock = vi.hoisted(() => ({ current: new URLSearchParams() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/faculty/attendance',
  useSearchParams: () => searchParamsMock.current,
}))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside data-testid="sidebar" /> }))

import ReportsPage from './reports/page'
import AttendanceOverviewPage from './attendance/page'
import SessionsPage from './sessions/page'

describe('Super Admin monitoring pages', () => {
  beforeEach(() => {
    searchParamsMock.current = new URLSearchParams()
    apiMock.getCurrentUser.mockReturnValue({
      id: 'admin-1',
      email: 'admin@pup.edu.ph',
      fullName: 'System Administrator',
      role: 'super_admin',
      scope: 'institution',
    })
    apiMock.getSessions.mockResolvedValue([])
    apiMock.getSubjects.mockResolvedValue([])
    apiMock.getSections.mockResolvedValue([])
    apiMock.getTeachers.mockResolvedValue([])
    apiMock.getAttendanceRecords.mockResolvedValue([])
    apiMock.getAttendanceReport.mockResolvedValue({
      range: { startDate: '2026-06-19', endDate: '2026-07-18' },
      totals: { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0, excused: 0 },
      summaries: [],
    })
    apiMock.exportAttendanceCsv.mockResolvedValue('')
  })

  it('hydrates the sessions page without changing hook order', async () => {
    render(<SessionsPage />)

    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /new session/i })).not.toBeInTheDocument()
    await waitFor(() => expect(apiMock.getSessions).toHaveBeenCalled())
  })

  it('shows section context from a sessions deep link and clears only sectionId', async () => {
    searchParamsMock.current = new URLSearchParams('sectionId=sec-1&status=active&tab=calendar')
    apiMock.getSections.mockResolvedValue([
      { id: 'sec-1', subjectId: 'subj-1', section: 'A', room: 'Room 101' },
    ])
    apiMock.getSubjects.mockResolvedValue([{ id: 'subj-1', name: 'Algorithms', code: 'CS 101' }])

    render(<SessionsPage />)

    expect(await screen.findByText(/Algorithms \(CS 101\) · Section A · Room 101/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clear section/i })).toHaveAttribute(
      'href',
      '/faculty/sessions?status=active&tab=calendar',
    )
    expect(screen.getByRole('link', { name: /section detail/i })).toHaveAttribute(
      'href',
      '/faculty/sections/sec-1',
    )
  })

  it('paginates sessions list when exceeding page size', async () => {
    const mockSessions = Array.from({ length: 15 }, (_, i) => ({
      id: `sess-${i + 1}`,
      subjectName: 'Algorithms',
      sectionId: 'sec-1',
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      startTime: '08:00',
      endTime: '11:00',
      room: 'Room 101',
      isActive: false,
    }))
    apiMock.getSessions.mockResolvedValue(mockSessions)
    apiMock.getSections.mockResolvedValue([
      { id: 'sec-1', subjectId: 'subj-1', section: 'A', room: 'Room 101' },
    ])
    apiMock.getSubjects.mockResolvedValue([{ id: 'subj-1', name: 'Algorithms', code: 'CS 101' }])

    render(<SessionsPage />)

    expect(await screen.findByText(/Showing/)).toBeInTheDocument()
    expect(screen.getByText(/15 sessions/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('hydrates the reports page without changing hook order', async () => {
    render(<ReportsPage />)

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByText('No data matching filters.')).toBeInTheDocument()
    await waitFor(() => expect(apiMock.getAttendanceReport).toHaveBeenCalled())
    expect(apiMock.getAttendanceRecords).not.toHaveBeenCalled()
  })

  it('includes pending and disputed records in report percentages and summaries', async () => {
    apiMock.getAttendanceReport.mockResolvedValue({
      range: { startDate: '2026-06-19', endDate: '2026-07-18' },
      totals: {
        totalRecords: 10,
        totalSessions: 2,
        present: 4,
        late: 1,
        absent: 1,
        pending: 3,
        disputed: 1,
        excused: 0,
      },
      summaries: [
        {
          sectionId: 'section-1',
          subjectName: 'Algorithms',
          totalSessions: 2,
          present: 4,
          late: 1,
          absent: 1,
          pending: 3,
          disputed: 1,
        },
      ],
    })

    const view = render(<ReportsPage />)
    const page = within(view.container)

    expect(await page.findByText('Algorithms')).toBeInTheDocument()
    expect(page.getAllByText('40%').length).toBeGreaterThan(0)
    expect(page.getAllByText('30%').length).toBeGreaterThan(0)
    expect(page.getByRole('columnheader', { name: 'Pending' })).toBeInTheDocument()
    expect(page.getByRole('columnheader', { name: 'Disputed' })).toBeInTheDocument()
  })

  it('shows all attendance statuses in the attendance overview', async () => {
    apiMock.getAttendanceReport.mockResolvedValue({
      range: { startDate: '2026-06-19', endDate: '2026-07-18' },
      totals: {
        totalRecords: 10,
        totalSessions: 2,
        present: 4,
        late: 1,
        absent: 1,
        pending: 3,
        disputed: 1,
        excused: 0,
      },
      summaries: [
        {
          sectionId: 'section-1',
          subjectName: 'Algorithms',
          totalSessions: 2,
          present: 4,
          late: 1,
          absent: 1,
          pending: 3,
          disputed: 1,
        },
      ],
    })

    const view = render(<AttendanceOverviewPage />)
    const page = within(view.container)

    expect(await page.findByText('Algorithms')).toBeInTheDocument()
    expect(page.getByRole('columnheader', { name: 'Pending' })).toBeInTheDocument()
    expect(page.getByRole('columnheader', { name: 'Disputed' })).toBeInTheDocument()
  })

  it("paginates attendance summaries when exceeding 10 sections", async () => {
    const mockSummaries = Array.from({ length: 15 }, (_, i) => ({
      sectionId: "sec-" + (i + 1),
      subjectName: "Subject " + (i + 1),
      totalSessions: 10,
      present: 8,
      late: 1,
      incomplete: 0,
      absent: 1,
      pending: 0,
      disputed: 0,
      excused: 0,
    }))
    apiMock.getAttendanceReport.mockResolvedValue({
      range: { startDate: "2026-06-19", endDate: "2026-07-18" },
      totals: { totalRecords: 150, totalSessions: 150, present: 120, late: 15, absent: 15, pending: 0, disputed: 0, excused: 0 },
      summaries: mockSummaries,
    })

    const view = render(<AttendanceOverviewPage />)
    const page = within(view.container)

    expect(await page.findByText("Subject 1")).toBeInTheDocument()
    expect(page.getByText(/Showing/)).toBeInTheDocument()
    const paginationNav = page.getByLabelText('Pagination Navigation')
    expect(within(paginationNav).getByText('15')).toBeInTheDocument()
    expect(within(paginationNav).getByText(/sections/)).toBeInTheDocument()
    expect(page.getByRole("button", { name: /previous/i })).toBeDisabled()
    expect(page.getByRole("button", { name: /next/i })).toBeEnabled()
  })
})
