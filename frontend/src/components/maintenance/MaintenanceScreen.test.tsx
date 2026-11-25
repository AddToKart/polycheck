import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { MaintenanceScreen } from './MaintenanceScreen'

const trustedNowMock = vi.hoisted(() => ({ nowMs: 0, offsetMs: null as number | null }))

vi.mock('@/lib/hooks/use-trusted-now', () => ({
  useTrustedNow: () => trustedNowMock,
}))

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
  beforeEach(() => {
    trustedNowMock.nowMs = Date.parse('2026-11-01T09:00:00.000Z')
    trustedNowMock.offsetMs = null
  })

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
    const estimatedEnd = new Date(trustedNowMock.nowMs + 5 * 60_000).toISOString()
    render(<MaintenanceScreen estimatedEnd={estimatedEnd} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Estimated resumption in 5 min/)
  })

  // ── WEB-03: the countdown reads the `/health`-corrected clock ────────────

  it('shows the estimate as overdue when the device clock is ahead', () => {
    // Device clock reads 4 h ahead of the server (`offsetMs` is server minus
    // device, so a negative offset). The estimate is a server instant 30 min
    // out; trusting the raw device clock would wrongly claim ~3.5 h remaining.
    const deviceNow = Date.parse('2026-11-01T13:00:00.000Z')
    const offsetMs = -4 * 60 * 60_000
    trustedNowMock.nowMs = deviceNow
    trustedNowMock.offsetMs = offsetMs
    const serverNow = deviceNow + offsetMs
    const estimatedEnd = new Date(serverNow + 30 * 60_000).toISOString()

    render(<MaintenanceScreen estimatedEnd={estimatedEnd} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Estimated resumption in 30 min/)
  })

  it('shows the estimate as remaining when the device clock is behind', () => {
    // Device clock reads 4 h behind the server. Naively reading it would claim
    // ~4.5 h remaining instead of the true 30 minutes.
    const deviceNow = Date.parse('2026-11-01T05:00:00.000Z')
    const offsetMs = 4 * 60 * 60_000
    trustedNowMock.nowMs = deviceNow
    trustedNowMock.offsetMs = offsetMs
    const serverNow = deviceNow + offsetMs
    const estimatedEnd = new Date(serverNow + 30 * 60_000).toISOString()

    render(<MaintenanceScreen estimatedEnd={estimatedEnd} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Estimated resumption in 30 min/)
  })

  it('reports overdue once the trusted clock passes the estimate', () => {
    const deviceNow = Date.parse('2026-11-01T05:00:00.000Z')
    const offsetMs = 4 * 60 * 60_000
    trustedNowMock.nowMs = deviceNow
    trustedNowMock.offsetMs = offsetMs
    // 10 minutes before the corrected now.
    const estimatedEnd = new Date(deviceNow + offsetMs - 10 * 60_000).toISOString()

    render(<MaintenanceScreen estimatedEnd={estimatedEnd} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Resumption is overdue/)
  })

  it('can hide the administrator link for embedded login surfaces', () => {
    render(<MaintenanceScreen variant="embedded" showAdminLogin={false} />)
    expect(screen.queryByRole('link', { name: 'Administrator Login' })).not.toBeInTheDocument()
  })
})
