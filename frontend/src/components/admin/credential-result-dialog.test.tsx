import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CredentialResultDialog } from './credential-result-dialog'

afterEach(cleanup)

const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText },
})

describe('CredentialResultDialog', () => {
  it('shows the generated password and copies a full credentials summary', async () => {
    render(
      <CredentialResultDialog
        credentials={{
          role: 'student',
          name: 'Juan Dela Cruz',
          identifier: '2024-00001-MN-0',
          password: 'PUP-K7W2M4Q8-tx!',
        }}
        onOpenChange={() => undefined}
      />,
    )

    expect(await screen.findByText('PUP-K7W2M4Q8-tx!')).toBeInTheDocument()
    expect(screen.getByText('2024-00001-MN-0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /copy credentials/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('Polycheck credentials')
    expect(copied).toContain('Role: student')
    expect(copied).toContain('Juan Dela Cruz')
    expect(copied).toContain('2024-00001-MN-0')
    expect(copied).toContain('PUP-K7W2M4Q8-tx!')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('renders no dialog content without credentials', () => {
    render(<CredentialResultDialog credentials={null} onOpenChange={() => undefined} />)
    expect(screen.queryByText(/temporary credentials/i)).not.toBeInTheDocument()
  })
})
