import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordTimeline } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getRecordTimeline: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import { DisputeTimeline } from './DisputeTimeline'

function timelineFixture(overrides?: Partial<RecordTimeline>): RecordTimeline {
  return {
    recordId: 'rec-1',
    events: [
      {
        kind: 'activation',
        at: '2026-11-02T08:00:00.000Z',
        label: 'Attendance window opened (QR activated by teacher)',
        source: 'session',
      },
      {
        kind: 'signature',
        at: '2026-11-02T08:01:05.000Z',
        label: 'Local ED25519 signature generated',
        source: 'token',
      },
      {
        kind: 'scan',
        at: '2026-11-02T08:01:41.000Z',
        label: 'Scan accepted',
        source: 'scan_attempt',
        detail: {
          distanceMeters: 21.4,
          radiusMeters: 50,
          insideGeofence: true,
          channel: 'camera',
          deviceIdMasked: '…9F2A',
        },
      },
      {
        kind: 'queue',
        at: '2026-11-02T08:01:41.000Z',
        label: 'Queued on device during the outage, waiting for sync',
        source: 'scan_attempt',
        detail: { receiptId: 'a1b2c3d4' },
      },
      {
        kind: 'sync',
        at: '2026-11-02T08:14:02.000Z',
        label: 'Attendance record committed on the server',
        source: 'record',
      },
    ],
    recommendation: {
      verdict: 'accept',
      rationale: 'Cryptographic proof confirms student presence at 08:01:41',
    },
    ...overrides,
  }
}

describe('DisputeTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders nothing and does not fetch while closed', () => {
    render(<DisputeTimeline recordId="rec-1" open={false} />)

    expect(apiMock.getRecordTimeline).not.toHaveBeenCalled()
    expect(screen.queryByTestId('dispute-timeline-root')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('fetches on open and renders every event in server order with evidence chips', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(timelineFixture())
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    expect(apiMock.getRecordTimeline).toHaveBeenCalledWith('rec-1')
    const rows = await screen.findAllByTestId('timeline-event')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('Attendance window opened (QR activated by teacher)')
    expect(within(rows[0]).getByText('08:00:00')).toBeInTheDocument()
    expect(within(rows[1]).getByText('ED25519 signature verified')).toBeInTheDocument()
    expect(within(rows[2]).getByText('21m inside geofence')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Channel: camera')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Device …9F2A')).toBeInTheDocument()
    expect(within(rows[3]).getByText('offline · queued')).toBeInTheDocument()
    expect(within(rows[3]).getByText('Receipt a1b2c3d4')).toBeInTheDocument()
    expect(within(rows[4]).getByText('Attendance record committed on the server')).toBeInTheDocument()
    // Client-sourced rails are honestly labelled with their clock provenance.
    expect(within(rows[1]).getByText('device clock (offset-corrected)')).toBeInTheDocument()
    expect(within(rows[4]).queryByText('device clock (offset-corrected)')).not.toBeInTheDocument()
  })

  it('shows an accessible loading state with a reduced-motion-safe spinner', () => {
    apiMock.getRecordTimeline.mockReturnValue(new Promise(() => {}))
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    expect(screen.getByRole('status')).toHaveTextContent('Building forensic timeline…')
    expect(screen.getByTestId('timeline-spinner')).toHaveClass('motion-reduce:animate-none')
    expect(screen.queryByTestId('timeline-event')).not.toBeInTheDocument()
  })

  it('exposes fetch errors accessibly and retries on demand', async () => {
    apiMock.getRecordTimeline.mockRejectedValueOnce(new Error('Timeline service unavailable'))
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const alertBox = await screen.findByRole('alert')
    expect(alertBox).toHaveTextContent('Timeline service unavailable')

    apiMock.getRecordTimeline.mockResolvedValueOnce(timelineFixture())
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('Scan accepted')).toBeInTheDocument()
    expect(apiMock.getRecordTimeline).toHaveBeenCalledTimes(2)
    expect(apiMock.getRecordTimeline).toHaveBeenLastCalledWith('rec-1')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('flags anomaly-shaped events with red nodes and evidence chips', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(
      timelineFixture({
        events: [
          {
            kind: 'scan',
            at: '2026-11-02T08:01:41.000Z',
            label: 'Scan denied: mocked device location',
            source: 'scan_attempt',
            detail: {
              distanceMeters: 210.6,
              radiusMeters: 50,
              insideGeofence: false,
              mocked: true,
            },
          },
          {
            kind: 'sync',
            at: '2026-11-02T08:14:02.000Z',
            label: 'Attendance record committed on the server',
            source: 'record',
          },
        ],
        recommendation: {
          verdict: 'reject',
          rationale: 'Mocked GPS evidence is recorded against the accepted scan attempt.',
        },
      }),
    )
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const rows = await screen.findAllByTestId('timeline-event')
    expect(within(rows[0]).getByTestId('timeline-node')).toHaveClass('bg-red-500')
    expect(within(rows[0]).getByText('Mocked GPS detected')).toBeInTheDocument()
    expect(within(rows[0]).getByText('211m outside geofence')).toBeInTheDocument()
    expect(within(rows[1]).getByTestId('timeline-node')).toHaveClass('bg-golden')
  })

  it('renders the accept recommendation chip in PUP golden-on-maroon', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(
      timelineFixture({
        recommendation: {
          verdict: 'accept',
          rationale: 'Cryptographic proof confirms student presence at 08:01:41',
        },
      }),
    )
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const chip = await screen.findByTestId('timeline-recommendation')
    expect(chip).toHaveTextContent(/recommendation:\s*accept dispute/i)
    expect(chip).toHaveTextContent('Cryptographic proof confirms student presence at 08:01:41')
    expect(chip).toHaveClass('bg-golden', 'text-maroon-dark')
  })

  it('renders the review recommendation chip in amber', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(
      timelineFixture({
        recommendation: {
          verdict: 'review',
          rationale: 'GPS accuracy of 250m weakens the location proof',
        },
      }),
    )
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const chip = await screen.findByTestId('timeline-recommendation')
    expect(chip).toHaveTextContent(/recommendation:\s*review evidence/i)
    expect(chip).toHaveTextContent('GPS accuracy of 250m weakens the location proof')
    expect(chip).toHaveClass('bg-amber-100')
  })

  it('renders the reject recommendation chip in red', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(
      timelineFixture({
        recommendation: {
          verdict: 'reject',
          rationale: 'Mocked GPS evidence is recorded against the accepted scan attempt.',
        },
      }),
    )
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const chip = await screen.findByTestId('timeline-recommendation')
    expect(chip).toHaveTextContent(/recommendation:\s*reject dispute/i)
    expect(chip).toHaveClass('bg-red-600', 'text-white')
  })

  it('labels every row with the shared event-kind map', async () => {
    apiMock.getRecordTimeline.mockResolvedValue(timelineFixture())
    render(<DisputeTimeline recordId="rec-1" open={true} />)

    const rows = await screen.findAllByTestId('timeline-event')
    expect(within(rows[0]).getByText('Activation')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Signature')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Scan attempt')).toBeInTheDocument()
    expect(within(rows[3]).getByText('Queued on device')).toBeInTheDocument()
    expect(within(rows[4]).getByText('Sync')).toBeInTheDocument()
  })
})
