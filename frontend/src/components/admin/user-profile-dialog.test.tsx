import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from '@polycheck/shared'
import { UserProfileDialog } from './user-profile-dialog'

const apiMock = vi.hoisted(() => ({ updateUser: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/notifications', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }))

const teacher = (overrides: Partial<User> = {}): User => ({
  id: 't-9',
  fullName: 'Prof. Head',
  email: 'head@pup.edu.ph',
  role: 'teacher',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

function renderDialog(target: User, isSuperAdmin = true) {
  const onSaved = vi.fn()
  render(
    <UserProfileDialog open onOpenChange={() => undefined} target={target} onSaved={onSaved} isSuperAdmin={isSuperAdmin} />,
  )
  return onSaved
}

beforeEach(() => {
  apiMock.updateUser.mockReset()
  apiMock.updateUser.mockImplementation(async (_id: string, input: object) => ({ ...teacher(), ...input }))
})
afterEach(cleanup)

describe('UserProfileDialog course scope', () => {
  it('shows course oversight labels and hides the course scope until a head or registrar designation is on', () => {
    renderDialog(teacher())
    expect(screen.getByText('Course Head')).toBeInTheDocument()
    expect(screen.queryByText('Department Head')).not.toBeInTheDocument()
    expect(screen.queryByTestId('course-scope-editor')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /course head/i }))
    expect(screen.getByTestId('course-scope-editor')).toBeInTheDocument()
  })

  it('submits the designation and the selected courses together', async () => {
    const onSaved = renderDialog(teacher())
    fireEvent.click(screen.getByRole('checkbox', { name: /course head/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^BSIT/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^BSHM/ }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(apiMock.updateUser).toHaveBeenCalledTimes(1))
    expect(apiMock.updateUser).toHaveBeenCalledWith('t-9', {
      isDepartmentHead: true,
      managedCourses: ['BSIT', 'BSHM'],
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('submits all-courses for a Head of Academic Programs and leaves unchanged fields out', async () => {
    renderDialog(teacher({ isDepartmentHead: true, managedCourses: ['BSIT'], managesAllCourses: false }))
    fireEvent.click(screen.getByRole('checkbox', { name: /all courses/i }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(apiMock.updateUser).toHaveBeenCalledTimes(1))
    expect(apiMock.updateUser).toHaveBeenCalledWith('t-9', { managesAllCourses: true })
  })

  it('never offers the designation or course editor to non-super-admins', () => {
    renderDialog(teacher({ isDepartmentHead: true, managedCourses: ['BSIT'] }), false)
    expect(screen.queryByTestId('course-scope-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /course head/i })).not.toBeInTheDocument()
  })
})
