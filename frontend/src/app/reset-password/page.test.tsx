import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const apiMock = vi.hoisted(() => ({
  passwordResetValidate: vi.fn(),
  passwordResetComplete: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import ResetPasswordPage from './page'

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v'
const GOOD_PASSWORD = 'Sturdy-Pass#2026'

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

// replaceState (unlike assigning location.hash) does not fire an async `hashchange`.
function setHash(hash: string) {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
}

async function fillAndSubmit(password = GOOD_PASSWORD, confirm = password) {
  fireEvent.change(await screen.findByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.passwordResetValidate.mockResolvedValue({ valid: true })
})

afterEach(() => {
  cleanup()
  setHash('')
})

describe('/reset-password page', () => {
  it('without a token offers a new link and never calls the API', async () => {
    setHash('')
    render(<ResetPasswordPage />)
    expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    expect(apiMock.passwordResetValidate).not.toHaveBeenCalled()
  })

  it('shows the form for a live link and resets the password with the fragment token', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetComplete.mockResolvedValue({ ok: true })
    render(<ResetPasswordPage />)
    await fillAndSubmit()

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
    expect(apiMock.passwordResetValidate).toHaveBeenCalledWith(TOKEN)
    expect(apiMock.passwordResetComplete).toHaveBeenCalledWith({ token: TOKEN, password: GOOD_PASSWORD })
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login/student')
    expect(screen.getByText(/every device was signed out/i)).toBeInTheDocument()
  })

  it('treats an unusable link as expired and points to a new request', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetValidate.mockResolvedValue({ valid: false })
    render(<ResetPasswordPage />)
    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument()
  })

  it('blocks a weak password and a mismatch before calling the API', async () => {
    setHash(`#token=${TOKEN}`)
    render(<ResetPasswordPage />)
    await fillAndSubmit('weak')
    expect(await screen.findByRole('alert')).toHaveTextContent(/needs every requirement/i)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: GOOD_PASSWORD } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: `${GOOD_PASSWORD}x` } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i))
    expect(apiMock.passwordResetComplete).not.toHaveBeenCalled()
  })

  it('switches to the expired state when the server rejects the link at submit time', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetComplete.mockRejectedValue(new ApiError('bad', 400, 'password_reset_link_invalid'))
    render(<ResetPasswordPage />)
    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument()
  })

  it('keeps the form and reports a retryable message on a network failure', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetComplete.mockRejectedValue(new Error('network'))
    render(<ResetPasswordPage />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/safe to retry/i)
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
  })

  it('reports an already-used link as done', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetComplete.mockResolvedValue({ ok: true, alreadyReset: true })
    render(<ResetPasswordPage />)
    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'Password already reset' })).toBeInTheDocument()
  })

  it('retries the link check after a transient failure', async () => {
    setHash(`#token=${TOKEN}`)
    apiMock.passwordResetValidate.mockRejectedValueOnce(new Error('offline'))
    render(<ResetPasswordPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('New password')).toBeInTheDocument()
  })
})
