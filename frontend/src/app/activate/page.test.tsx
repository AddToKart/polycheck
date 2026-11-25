import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const apiMock = vi.hoisted(() => ({
  activationValidate: vi.fn(),
  activationComplete: vi.fn(),
  activationRequestLink: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import ActivatePage from './page'

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

function openWithToken(token: string | null) {
  window.location.hash = token ? `#token=${token}` : ''
}

async function fillAndSubmit(studentId = '2024-00001-MN-0', password = GOOD_PASSWORD, confirm = password) {
  fireEvent.change(await screen.findByLabelText('Student number'), { target: { value: studentId } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Activate account' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.activationValidate.mockResolvedValue({ valid: true, expiresAt: '2026-12-02T00:00:00.000Z' })
})

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('/activate page', () => {
  it('without a token asks for the email link and offers a new one', async () => {
    openWithToken(null)
    render(<ActivatePage />)

    expect(await screen.findByRole('heading', { name: 'Activate your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email on file')).toBeInTheDocument()
    expect(apiMock.activationValidate).not.toHaveBeenCalled()
  })

  it('validates the fragment token without consuming it, then shows the form', async () => {
    openWithToken(TOKEN)
    render(<ActivatePage />)

    expect(await screen.findByLabelText('New password')).toBeInTheDocument()
    expect(apiMock.activationValidate).toHaveBeenCalledWith(TOKEN)
    expect(apiMock.activationComplete).not.toHaveBeenCalled()
  })

  it('shows an invalid or expired link with a way to request a new one', async () => {
    openWithToken(TOKEN)
    apiMock.activationValidate.mockResolvedValue({ valid: false })
    render(<ActivatePage />)

    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeInTheDocument()
  })

  it('offers a retry when the connection fails while checking the link', async () => {
    openWithToken(TOKEN)
    apiMock.activationValidate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<ActivatePage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('New password')).toBeInTheDocument()
    expect(apiMock.activationValidate).toHaveBeenCalledTimes(2)
  })

  it('shows live password requirements and blocks a weak or mismatched submit locally', async () => {
    openWithToken(TOKEN)
    render(<ActivatePage />)

    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'abc' } })
    const list = screen.getByRole('list', { name: 'Password requirements' })
    expect(list).toHaveTextContent('At least 12 characters (not yet)')
    expect(list).toHaveTextContent('A lowercase letter (done)')

    await fillAndSubmit('2024-00001-MN-0', 'weak')
    expect(await screen.findByRole('alert')).toHaveTextContent(/every requirement/i)

    await fillAndSubmit('2024-00001-MN-0', GOOD_PASSWORD, 'Different-Pass#2026')
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(apiMock.activationComplete).not.toHaveBeenCalled()
  })

  it('submits the normalized student number and password, then confirms and links to login', async () => {
    openWithToken(TOKEN)
    apiMock.activationComplete.mockResolvedValue({ ok: true })
    render(<ActivatePage />)

    await fillAndSubmit(' 2024-00001-mn-0 ')

    expect(await screen.findByRole('heading', { name: 'Account activated' })).toBeInTheDocument()
    expect(apiMock.activationComplete).toHaveBeenCalledWith({
      token: TOKEN,
      studentId: '2024-00001-MN-0',
      password: GOOD_PASSWORD,
    })
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login/student')
    // The password is gone from the DOM once activation succeeded.
    expect(document.body.innerHTML).not.toContain(GOOD_PASSWORD)
  })

  it('treats a replay (lost response on flaky data) as already activated', async () => {
    openWithToken(TOKEN)
    apiMock.activationComplete.mockResolvedValue({ ok: true, alreadyActivated: true })
    render(<ActivatePage />)

    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'Already activated' })).toBeInTheDocument()
  })

  it('keeps the form and explains a wrong student number', async () => {
    openWithToken(TOKEN)
    apiMock.activationComplete.mockRejectedValue(
      new ApiError('mismatch', 400, 'activation_student_number_mismatch'),
    )
    render(<ActivatePage />)

    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not match this activation link/i)
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
  })

  it('moves to the expired-link screen if the link dies while the form is open', async () => {
    openWithToken(TOKEN)
    apiMock.activationComplete.mockRejectedValue(new ApiError('invalid', 400, 'activation_link_invalid'))
    render(<ActivatePage />)

    await fillAndSubmit()
    expect(await screen.findByRole('heading', { name: 'This link is no longer valid' })).toBeInTheDocument()
  })

  it('tells the student a network failure is safe to retry and keeps their input', async () => {
    openWithToken(TOKEN)
    apiMock.activationComplete.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<ActivatePage />)

    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/safe to retry/i)
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }))
    await waitFor(() => expect(apiMock.activationComplete).toHaveBeenCalledTimes(2))
  })

  it('ignores a second tap while the first submit is in flight', async () => {
    openWithToken(TOKEN)
    let release: (value: { ok: true }) => void = () => undefined
    apiMock.activationComplete.mockReturnValue(new Promise((resolve) => (release = resolve)))
    render(<ActivatePage />)

    await fillAndSubmit()
    const button = screen.getByRole('button', { name: 'Activating…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(apiMock.activationComplete).toHaveBeenCalledTimes(1)
    release({ ok: true })
    expect(await screen.findByRole('heading', { name: 'Account activated' })).toBeInTheDocument()
  })

  it('request-new-link always answers the same way and never echoes whether the account exists', async () => {
    openWithToken(null)
    apiMock.activationRequestLink.mockResolvedValue({ ok: true })
    render(<ActivatePage />)

    fireEvent.change(await screen.findByLabelText('Student number'), { target: { value: '2024-00001-mn-0' } })
    fireEvent.change(screen.getByLabelText('Email on file'), { target: { value: ' Maria@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }))

    expect(await screen.findByText(/If those details match an account/i)).toBeInTheDocument()
    expect(apiMock.activationRequestLink).toHaveBeenCalledWith({
      studentId: '2024-00001-MN-0',
      email: 'Maria@Example.com',
    })
  })

  it('validates the student number before asking for a new link', async () => {
    openWithToken(null)
    render(<ActivatePage />)

    fireEvent.change(await screen.findByLabelText('Student number'), { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText('Email on file'), { target: { value: 'a@b.ph' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/student number/i)
    expect(apiMock.activationRequestLink).not.toHaveBeenCalled()
  })
})
