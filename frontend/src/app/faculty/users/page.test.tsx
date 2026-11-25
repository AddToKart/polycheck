import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
  email: 'admin@pup.edu.ph',
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
