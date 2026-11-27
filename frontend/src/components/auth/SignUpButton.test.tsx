// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { SignUpButton } from './SignUpButton'

const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SignUpButton', () => {
  it('links to the landing page form while sign-up is open', async () => {
    const fetchMock = reply({ open: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<SignUpButton />)

    const link = await screen.findByRole('link', { name: 'Sign up' })
    expect(link).toHaveAttribute('href', 'https://polycheck.live/register')
    // The public route rejects requests that carry cookies.
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ credentials: 'omit' }))
  })

  it.each([
    ['closed', reply({ open: false })],
    ['an older server without sign-up', reply({ message: 'Not Found' }, false)],
    ['unreachable', vi.fn().mockRejectedValue(new Error('offline'))],
  ])('shows nothing when sign-up is %s', async (_case, fetchMock) => {
    vi.stubGlobal('fetch', fetchMock)
    render(<SignUpButton />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument()
  })
})
