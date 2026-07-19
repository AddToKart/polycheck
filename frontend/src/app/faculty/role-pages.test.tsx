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
    totals: { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 },
    summaries: [],
  }),
  exportAttendanceCsv: vi.fn().mockResolvedValue(''),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside data-testid="sidebar" /> }))

import ReportsPage from './reports/page'
import AttendanceOverviewPage from './attendance/page'
import SessionsPage from './sessions/page'

describe('Super Admin monitoring pages', () => {
  beforeEach(() => {
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
      totals: { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 },
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
})
