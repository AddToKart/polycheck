import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const apiMock = vi.hoisted(() => ({ passwordResetRequest: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import ForgotPasswordPage from './page'

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

async function submit(studentId: string) {
  fireEvent.change(screen.getByLabelText('Student number'), { target: { value: studentId } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => cleanup())

describe('/forgot-password page', () => {
  it('asks for the student number and links back to login', () => {
    render(<ForgotPasswordPage />)
    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login/student')
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDisabled()
  })

  it('sends the normalized student number and tells the student to check their email', async () => {
    apiMock.passwordResetRequest.mockResolvedValue({ ok: true, delivery: 'email' })
    render(<ForgotPasswordPage />)
    await submit(' 2024-00001-mn-0 ')

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(apiMock.passwordResetRequest).toHaveBeenCalledWith('2024-00001-MN-0')
    expect(screen.getByText(/email address on your profile/i)).toBeInTheDocument()
  })

  it('explains the teacher temporary-password route when no email is bound', async () => {
    apiMock.passwordResetRequest.mockResolvedValue({ ok: true, delivery: 'unavailable' })
    render(<ForgotPasswordPage />)
    await submit('2024-00001-MN-0')

    expect(await screen.findByRole('heading', { name: 'No email on file' })).toBeInTheDocument()
    expect(screen.getByText(/ask your instructor to reset your password/i)).toBeInTheDocument()
    expect(screen.getByText(/temporary password/i)).toBeInTheDocument()
  })

  it('lets the student try a different number after either outcome', async () => {
    apiMock.passwordResetRequest.mockResolvedValue({ ok: true, delivery: 'unavailable' })
    render(<ForgotPasswordPage />)
    await submit('2024-00001-MN-0')
    fireEvent.click(await screen.findByRole('button', { name: 'Check a different student number' }))
    expect(await screen.findByLabelText('Student number')).toBeInTheDocument()
  })

  it('rejects a malformed student number without calling the API', async () => {
    render(<ForgotPasswordPage />)
    await submit('not-a-number')
    expect(await screen.findByRole('alert')).toHaveTextContent(/exactly as shown on your ID/i)
    expect(apiMock.passwordResetRequest).not.toHaveBeenCalled()
  })

  it('says to wait when rate limited, and offers a retry message on network failure', async () => {
    apiMock.passwordResetRequest.mockRejectedValueOnce(new ApiError('slow down', 429, 'password_reset_rate_limited'))
    render(<ForgotPasswordPage />)
    await submit('2024-00001-MN-0')
    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a few minutes/i)

    apiMock.passwordResetRequest.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reach Polycheck/i))
  })
})
