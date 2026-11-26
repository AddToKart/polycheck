import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ api: { changePassword: vi.fn() } }))

import type { User } from '@polycheck/shared'
import { PendingPasswordChange } from './PendingPasswordChange'

const user = { id: 'u-1', fullName: 'System Administrator' } as User

afterEach(() => cleanup())

function metStates() {
  return screen
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('data-met') === 'true')
}

describe('PendingPasswordChange', () => {
  it('lists every requirement as not met before anything is typed', () => {
    render(<PendingPasswordChange user={user} onDone={vi.fn()} />)
    expect(screen.getByLabelText('Password requirements')).toBeInTheDocument()
    expect(metStates()).toEqual([false, false, false, false, false])
  })

  it('ticks each requirement live as the password meets it', () => {
    render(<PendingPasswordChange user={user} onDone={vi.fn()} />)
    const input = screen.getByLabelText('New password')

    fireEvent.change(input, { target: { value: 'abc' } })
    expect(metStates()).toEqual([false, true, false, false, false])

    fireEvent.change(input, { target: { value: 'Abcdefghijkl1' } })
    expect(metStates()).toEqual([true, true, true, true, false])

    fireEvent.change(input, { target: { value: 'Abcdefghijkl1!' } })
    expect(metStates()).toEqual([true, true, true, true, true])
  })

  it('shows and hides both password fields with the eye toggle', () => {
    render(<PendingPasswordChange user={user} onDone={vi.fn()} />)
    const password = screen.getByLabelText('New password')
    const confirm = screen.getByLabelText('Confirm new password')
    expect(password).toHaveAttribute('type', 'password')
    expect(confirm).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(confirm).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
