import { render, screen, waitFor } from '@testing-library/react'
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
  exportAttendanceCsv: vi.fn().mockResolvedValue(''),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside data-testid="sidebar" /> }))

import ReportsPage from './reports/page'
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
    await waitFor(() => expect(apiMock.getAttendanceRecords).toHaveBeenCalled())
  })
})
