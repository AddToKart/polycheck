import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { MaintenanceScreen } from './MaintenanceScreen'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, ...rest } = props as {
      src: string
      alt: string
      width: number
      height: number
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} {...rest} />
  },
}))

describe('MaintenanceScreen', () => {
  afterEach(cleanup)

  it('renders the branded heading, default copy, and administrator login', () => {
    render(<MaintenanceScreen />)

    expect(
      screen.getByRole('heading', { name: 'Polycheck is under scheduled maintenance' }),
    ).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_MAINTENANCE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Administrator Login' })).toHaveAttribute(
      'href',
      '/login/faculty',
    )
    expect(screen.getByText(/Campus MIS Office/)).toBeInTheDocument()
  })

  it('uses the custom announcement when provided', () => {
    render(<MaintenanceScreen message="We return at 10 AM." />)
    expect(screen.getByText('We return at 10 AM.')).toBeInTheDocument()
    expect(screen.queryByText(DEFAULT_MAINTENANCE_MESSAGE)).not.toBeInTheDocument()
  })

  it('renders a live countdown for the announced estimate', () => {
    const estimatedEnd = new Date(Date.now() + 5 * 60_000).toISOString()
    render(<MaintenanceScreen estimatedEnd={estimatedEnd} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Estimated resumption in 5 min/)
  })

  it('can hide the administrator link for embedded login surfaces', () => {
    render(<MaintenanceScreen variant="embedded" showAdminLogin={false} />)
    expect(screen.queryByRole('link', { name: 'Administrator Login' })).not.toBeInTheDocument()
  })
})
