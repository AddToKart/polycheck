import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  getCurrentUser: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

import FacultyLayout from './faculty/layout'
import StudentLayout from './student/layout'

const teacher = { id: 'teacher-1', fullName: 'Prof. Test', role: 'teacher' as const }
const student = { id: 'student-1', fullName: 'Test Student', role: 'student' as const }

describe('authenticated dashboard layouts', () => {
  beforeEach(() => {
    apiMock.restoreSession.mockReset()
    routerMock.replace.mockReset()
  })

  afterEach(cleanup)

  it.each([
    ['faculty', FacultyLayout, teacher],
    ['student', StudentLayout, student],
  ] as const)('shows an accessible loading state before the %s session resolves', async (_area, Layout, user) => {
    let resolveSession: (value: typeof user) => void = () => undefined
    apiMock.restoreSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))

    render(<Layout><div>Dashboard content</div></Layout>)

    expect(screen.getByRole('status')).toHaveTextContent('Verifying your session')
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()

    resolveSession(user)
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument()
  })

  it('keeps the faculty user in place and offers retry after a transient outage', async () => {
    apiMock.restoreSession
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(teacher)

    render(<FacultyLayout><div>Faculty dashboard</div></FacultyLayout>)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t verify your session')
    expect(routerMock.replace).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Faculty dashboard')).toBeInTheDocument()
    expect(apiMock.restoreSession).toHaveBeenCalledTimes(2)
  })

  it('keeps the student user in place and offers retry after a server outage', async () => {
    apiMock.restoreSession.mockRejectedValue(new Error('Service unavailable'))

    render(<StudentLayout><div>Student dashboard</div></StudentLayout>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection and try again')
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it('redirects only after the API authoritatively rejects the session', async () => {
    apiMock.restoreSession.mockResolvedValue(null)

    render(<FacultyLayout><div>Faculty dashboard</div></FacultyLayout>)

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('Faculty dashboard')).not.toBeInTheDocument()
  })

  it('redirects immediately when the session is rejected after the dashboard is already visible', async () => {
    apiMock.restoreSession.mockResolvedValue(teacher)
    apiMock.getCurrentUser.mockReturnValue(null)

    render(<FacultyLayout><div>Faculty dashboard</div></FacultyLayout>)
    expect(await screen.findByText('Faculty dashboard')).toBeInTheDocument()

    // A later 401 (e.g. a cockpit refresh) clears the cached user and emits
    // polycheck-auth-changed; protected content must not stay visible.
    fireEvent(window, new Event('polycheck-auth-changed'))

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('Faculty dashboard')).not.toBeInTheDocument()
  })
})
