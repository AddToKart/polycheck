// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HostSessionState } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getHostSession: vi.fn(),
  startHostSession: vi.fn(),
  endHostSession: vi.fn(),
}))
vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/device-id', () => ({ getOrCreateWebInstallationId: () => 'web-test' }))
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,qr') } }))

import { HostSessionPanel } from './HostSessionPanel'

const waiting: HostSessionState = {
  sessionId: 'sess-1',
  isActive: false,
  canStart: true,
  canEnd: false,
  gracePeriodMinutes: 15,
  roster: [],
}
const running: HostSessionState = {
  ...waiting,
  isActive: true,
  canStart: false,
  canEnd: true,
  qrToken: 'signed-token',
  roster: [
    { studentName: 'A Student', status: 'present', scannedAt: '2026-11-27T01:02:00Z' },
    { studentName: 'B Student', status: 'pending' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (position: unknown) => void) =>
        ok({ coords: { latitude: 14.8697, longitude: 120.9991, accuracy: 12 }, timestamp: Date.now() }),
    },
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HostSessionPanel', () => {
  it('starts with the location, shows the QR and a view-only list', async () => {
    apiMock.getHostSession.mockResolvedValue(waiting)
    apiMock.startHostSession.mockResolvedValue({
      ...running,
      markedPresent: true,
      presenceMessage: 'You were marked present.',
    })
    render(<HostSessionPanel sessionId="sess-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }))

    expect(await screen.findByText('You were marked present.')).toBeInTheDocument()
    expect(apiMock.startHostSession).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        validityMinutes: 5,
        gracePeriodMinutes: 15,
        latitude: 14.8697,
        accuracyMeters: 12,
        deviceId: 'web-test',
      }),
    )
    expect(await screen.findByRole('img', { name: 'Attendance QR code for this session' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2 checked in')).toBeInTheDocument()
    expect(screen.getByText('Not yet')).toBeInTheDocument()
    // The list cannot be edited: the only control left ends the session.
    expect(screen.getAllByRole('button').map((item) => item.textContent?.trim())).toEqual(['End session'])
  })

  it('still starts without a location', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, refused: () => void) => refused() },
    })
    apiMock.getHostSession.mockResolvedValue(waiting)
    apiMock.startHostSession.mockResolvedValue({
      ...running,
      markedPresent: false,
      presenceMessage: 'You were not marked present because your location was not shared.',
    })
    render(<HostSessionPanel sessionId="sess-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }))

    await waitFor(() => expect(apiMock.startHostSession).toHaveBeenCalled())
    expect(apiMock.startHostSession.mock.calls[0][1]).not.toHaveProperty('latitude')
    expect(await screen.findByText(/location was not shared/)).toBeInTheDocument()
  })

  it('asks before ending', async () => {
    apiMock.getHostSession.mockResolvedValue(running)
    apiMock.endHostSession.mockResolvedValue({ ...running, isActive: false, canEnd: false, qrToken: undefined })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<HostSessionPanel sessionId="sess-1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'End session' }))
    expect(apiMock.endHostSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'End session' }))

    expect(await screen.findByText('Session ended.')).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'End session' })).not.toBeInTheDocument()
  })

  it('shows why the controls are unavailable', async () => {
    apiMock.getHostSession.mockRejectedValue(new Error('Your professor removed your permission for this session.'))
    render(<HostSessionPanel sessionId="sess-1" />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()
  })
})
