import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUserPage, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getUsers: vi.fn(),
  setUserStatus: vi.fn(),
  createTeacher: vi.fn(),
  createStudent: vi.fn(),
  createAdmin: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
  changeUserRole: vi.fn(),
  resendActivation: vi.fn(),
  resendPendingActivation: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({
  api: apiMock,
  requestUserLogout: vi.fn().mockResolvedValue({ loggedOut: false }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))
vi.mock('@/components/import/BulkImportDialog', () => ({
  BulkImportDialog: () => <div data-testid="bulk-import" />,
}))
vi.mock('@/components/admin/create-admin-dialog', () => ({
  CreateAdminDialog: () => <div data-testid="create-admin" />,
}))
vi.mock('@/components/admin/credential-result-dialog', () => ({
  CredentialResultDialog: () => <div data-testid="credentials" />,
}))
vi.mock('@/components/admin/user-profile-dialog', () => ({
  UserProfileDialog: () => <div data-testid="user-profile" />,
}))
vi.mock('@/components/admin/user-role-dialog', () => ({
  UserRoleDialog: () => <div data-testid="user-role" />,
}))
vi.mock('@/lib/notifications', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }))

import UsersPage from './page'

const admin: User = {
  id: 'admin-1',
  email: 'admin@example.edu.ph',
  fullName: 'System Administrator',
  role: 'super_admin',
  scope: 'institution',
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
} as User & { scope: 'institution' }

const emptyPage: AdminUserPage = { data: [], total: 0, limit: 20, offset: 0, hasMore: false }

describe('Users console revalidation churn (WEB-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no matchMedia; the desktop breakpoint decides which layout
    // mounts (only one should exist in the tree).
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getUsers.mockResolvedValue(emptyPage)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not refetch the paginated table when an identical profile re-emits auth-changed', async () => {
    render(<UsersPage />)

    // Initial page load + the inactive-count probe.
    await waitFor(() => expect(apiMock.getUsers).toHaveBeenCalled())
    const afterInitialLoad = apiMock.getUsers.mock.calls.length
    expect(afterInitialLoad).toBeGreaterThan(0)

    // A revalidation hands back an equal-but-not-identical profile object (the
    // pre-WEB-13 `restoreSession` path always did this). The console must key
    // on the account id, not the object identity, or every poll refetches the
    // whole paginated table.
    apiMock.getCurrentUser.mockImplementation(() => ({ ...admin }))
    window.dispatchEvent(new Event('polycheck-auth-changed'))
    await waitFor(() => expect(apiMock.getCurrentUser).toHaveBeenCalledTimes(2))
    // Let any (wrong) effect-triggered refetch land before asserting absence.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // No extra fetch: the fetch effects key on the account id.
    expect(apiMock.getUsers).toHaveBeenCalledTimes(afterInitialLoad)
    expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument()
  })

  it('refetches when the signed-in account actually changed', async () => {
    render(<UsersPage />)
    await waitFor(() => expect(apiMock.getUsers).toHaveBeenCalled())
    const afterInitialLoad = apiMock.getUsers.mock.calls.length

    // A different registrar account takes over the tab.
    apiMock.getCurrentUser.mockReturnValue({
      ...admin,
      id: 'admin-2',
      role: 'teacher',
      isUserRegistrar: true,
      department: 'CCIS',
    })
    window.dispatchEvent(new Event('polycheck-auth-changed'))

    await waitFor(() => expect(apiMock.getUsers.mock.calls.length).toBeGreaterThan(afterInitialLoad))
  })
})

describe('Users console registrar scope', () => {
  const registrar = (extra: Record<string, unknown> = {}) =>
    ({
      id: 'reg-1',
      email: 'reg@example.edu.ph',
      fullName: 'Registrar',
      role: 'teacher',
      isUserRegistrar: true,
      department: 'CCIS',
      isActive: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      ...extra,
    }) as User

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    apiMock.getUsers.mockResolvedValue(emptyPage)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not pin a campus-wide registrar to their legacy department', async () => {
    apiMock.getCurrentUser.mockReturnValue(registrar({ managesAllCourses: true, courseScopeMode: 'course' }))
    render(<UsersPage />)

    await waitFor(() => expect(apiMock.getUsers).toHaveBeenCalled())
    expect(apiMock.getUsers.mock.calls[0][0]).not.toHaveProperty('department', 'CCIS')
    expect(await screen.findByText(/across every course/i)).toBeInTheDocument()
  })

  it('describes a course-pinned registrar by their courses', async () => {
    apiMock.getCurrentUser.mockReturnValue(registrar({ managedCourses: ['BSIT', 'BSHM'], courseScopeMode: 'course' }))
    render(<UsersPage />)

    await waitFor(() => expect(apiMock.getUsers).toHaveBeenCalled())
    expect(await screen.findByText(/students enrolled in BSIT, BSHM/)).toBeInTheDocument()
  })

  it('keeps the department pin for a registrar without a course scope (legacy)', async () => {
    apiMock.getCurrentUser.mockReturnValue(registrar({ courseScopeMode: 'legacy' }))
    render(<UsersPage />)

    await waitFor(() => expect(apiMock.getUsers).toHaveBeenCalled())
    expect(apiMock.getUsers.mock.calls[0][0]).toHaveProperty('department', 'CCIS')
    expect(await screen.findByText(/only lists and manages accounts in CCIS/i)).toBeInTheDocument()
  })
})

describe('Users console email activation', () => {
  const admin: User = {
    id: 'admin-1',
    email: 'admin@example.edu.ph',
    fullName: 'System Administrator',
    role: 'super_admin',
    scope: 'institution',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as User & { scope: 'institution' }

  const student = (id: string, overrides: Partial<User> = {}): User => ({
    id,
    studentId: `2024-0000${id}-MN-0`,
    fullName: `Student ${id}`,
    email: `s${id}@example.com`,
    role: 'student',
    program: 'BSIT',
    yearLevel: 1,
    department: 'BSIT',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  })

  const pageOf = (data: User[]): AdminUserPage => ({ data, total: data.length, limit: 20, offset: 0, hasMore: false })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getUsers.mockResolvedValue(
      pageOf([
        student('1', { activationPending: true, activationMail: { status: 'sent' } }),
        student('2', { activationPending: true, email: undefined }),
        student('3'),
      ]),
    )
    apiMock.resendActivation.mockResolvedValue({ queued: true, alreadyQueued: false })
    apiMock.resendPendingActivation.mockResolvedValue({ pending: 2, queued: 1, alreadyQueued: 0, noEmail: 1 })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  async function openStudents() {
    render(<UsersPage />)
    fireEvent.click(await screen.findByRole('tab', { name: /students/i }).catch(() => screen.findByRole('button', { name: /^students/i })))
    await screen.findByText('Student 1')
  }

  it('shows pending students as Invited with the delivery state, not as Active', async () => {
    await openStudents()
    expect(screen.getAllByText('Invited')).toHaveLength(2)
    expect(screen.getByText('Email sent')).toBeInTheDocument()
    expect(screen.getByText('No email on file')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('offers a per-row resend only for pending students and reports the result', async () => {
    await openStudents()
    const resend = screen.getAllByRole('button', { name: /resend activation/i })
    expect(resend).toHaveLength(2)

    fireEvent.click(resend[0])
    await waitFor(() => expect(apiMock.resendActivation).toHaveBeenCalledWith('1'))
  })

  it('filters to students awaiting activation and re-sends to all of them', async () => {
    await openStudents()
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'pending' } })

    await waitFor(() =>
      expect(apiMock.getUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: 'student', activation: 'pending' }),
        expect.anything(),
      ),
    )
    const bulk = await screen.findByRole('button', { name: /resend to all pending \(3\)/i })
    fireEvent.click(bulk)
    await waitFor(() => expect(apiMock.resendPendingActivation).toHaveBeenCalledTimes(1))
  })

  it('only offers the awaiting-activation filter on the students tab', async () => {
    render(<UsersPage />)
    await screen.findByText('User Management')
    expect(screen.queryByRole('option', { name: 'Awaiting activation' })).not.toBeInTheDocument()
  })
})
