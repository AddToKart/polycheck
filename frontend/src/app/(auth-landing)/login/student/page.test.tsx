import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiHttpError } from '@/lib/api-client'
import StudentLoginPage from './page'

const apiMock = vi.hoisted(() => ({
  loginStudent: vi.fn(),
  logout: vi.fn(),
  refreshServerClockOffset: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, api: apiMock }
})
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('../../layout', () => ({ useLanding: () => ({ exitingRoute: null }) }))

const studentUser = {
  id: 'student-1',
  studentId: '2024-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
  isActive: true,
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText(/student number/i), {
    target: { value: '2024-00001-MN-0' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'strong-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: /authenticate/i }))
}

beforeEach(() => {
  apiMock.loginStudent.mockReset()
  apiMock.logout.mockReset()
  apiMock.refreshServerClockOffset.mockReset().mockResolvedValue(undefined)
  routerMock.push.mockReset()
  routerMock.replace.mockReset()
})

afterEach(cleanup)

describe('student login device gates', () => {
  it('locks the form, ticks the cooldown countdown, and retries with the same credentials', async () => {
    apiMock.loginStudent
      .mockRejectedValueOnce(
        new ApiHttpError(
          'This account is locked while a device change cools down. Ask your instructor for an emergency release.',
          403,
          'device_cooldown_active',
          2,
          undefined,
          undefined,
          undefined,
          undefined,
          2,
        ),
      )
      .mockResolvedValueOnce(studentUser)

    render(<StudentLoginPage />)
    fillCredentials()

    expect(
      await screen.findByRole('heading', { name: /device change cooling down/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(apiMock.refreshServerClockOffset).toHaveBeenCalled(),
    )
    expect(screen.queryByLabelText(/student number/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/this account is locked while a device change cools down/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/ask your instructor to issue an emergency device release/i),
    ).toBeInTheDocument()

    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('0:02')
    await waitFor(() => expect(timer).toHaveTextContent('0:01'), { timeout: 2_500 })

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith('/student/dashboard'),
    )
    expect(apiMock.loginStudent).toHaveBeenCalledTimes(2)
    expect(apiMock.loginStudent).toHaveBeenNthCalledWith(
      2,
      '2024-00001-MN-0',
      'strong-password',
    )
  })

  it('explains the active session and which device holds it (no timer)', async () => {
    apiMock.loginStudent.mockRejectedValueOnce(
      new ApiHttpError(
        'Sign out from the active device, then try again.',
        403,
        'active_session_elsewhere',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'mobile',
      ),
    )

    render(<StudentLoginPage />)
    fillCredentials()

    expect(
      await screen.findByRole('heading', { name: /already signed in elsewhere/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/your account is currently signed in on another device/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/the active session is on your phone/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/student number/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('names the browser when the blocking session is another web login', async () => {
    apiMock.loginStudent.mockRejectedValueOnce(
      new ApiHttpError(
        'Sign out from the active device, then try again.',
        403,
        'active_session_elsewhere',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'web',
      ),
    )

    render(<StudentLoginPage />)
    fillCredentials()

    expect(
      await screen.findByText(/the active session is on the web browser/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('falls back to generic device phrasing when the holder kind is unknown', async () => {
    apiMock.loginStudent.mockRejectedValueOnce(
      new ApiHttpError(
        'This device could not be identified.',
        403,
        'active_session_elsewhere',
      ),
    )

    render(<StudentLoginPage />)
    fillCredentials()

    expect(
      await screen.findByText(/the active session is on another device/i),
    ).toBeInTheDocument()
  })
})
