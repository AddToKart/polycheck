import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { armOutage, disarmOutage, isOutageArmed } from '@polycheck/shared'

const storeMock = vi.hoisted(() => ({
  SYNC_STATE_EVENT: 'polycheck-sync-state',
  queueSequence: vi.fn(),
  getPendingSyncCount: vi.fn(),
}))
const apiMock = vi.hoisted(() => ({
  preSyncOfflineData: vi.fn(),
}))
const notificationsMock = vi.hoisted(() => ({ addNotification: vi.fn() }))

vi.mock('@/lib/offline/store', () => storeMock)
vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/notifications', () => ({
  useNotifications: () => ({ addNotification: notificationsMock.addNotification }),
  NotificationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { OutageSimulator } from './OutageSimulator'

beforeEach(() => {
  // restoreMocks:true resurrects the native stub after every test, so the
  // confirm spy is (re)created per test.
  vi.spyOn(window, 'confirm').mockReset()
  vi.clearAllMocks()
  disarmOutage()
  storeMock.getPendingSyncCount.mockResolvedValue(0)
})

afterEach(() => {
  cleanup()
  disarmOutage()
})

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('OutageSimulator', () => {
  it('renders the LIVE pill with the bolt icon while disarmed, and nothing auto-arms', () => {
    render(<OutageSimulator />)

    const pill = screen.getByTestId('outage-pill')
    expect(pill).toHaveTextContent('Simulate Outage')
    expect(pill).toHaveTextContent('LIVE')
    expect(screen.queryByTestId('outage-banner')).not.toBeInTheDocument()
    expect(isOutageArmed()).toBe(false)
  })

  it('arm requires confirm; declining keeps the state LIVE and the store disarmed', () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    render(<OutageSimulator />)

    fireEvent.click(screen.getByTestId('outage-pill'))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('Simulate a campus network outage?')
    expect(isOutageArmed()).toBe(false)
    expect(screen.getByTestId('outage-pill')).toBeInTheDocument()
  })

  it('arm flips store + UI to the OFFLINE panel with the amber banner and the receipt chip', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    storeMock.queueSequence.mockResolvedValue({ count: 3, lastId: 'a1b2c3d4-19f7' })
    render(<OutageSimulator />)

    fireEvent.click(screen.getByTestId('outage-pill'))

    expect(await screen.findByTestId('outage-banner')).toHaveTextContent('Offline mode — local encrypted queue')
    expect(isOutageArmed()).toBe(true)
    expect(await screen.findByTestId('outage-receipt')).toHaveTextContent('Receipt #3 · a1b2c3d4')
    expect(await screen.findByRole('button', { name: /Restore & Replay/i })).toBeInTheDocument()
  })

  it('while armed, SYNC_STATE_EVENT refreshes the receipt chip from the queue', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    storeMock.queueSequence.mockResolvedValue({ count: 1, lastId: '11111111-2222' })
    render(<OutageSimulator />)
    fireEvent.click(screen.getByTestId('outage-pill'))
    expect(await screen.findByTestId('outage-receipt')).toHaveTextContent('Receipt #1 · 11111111')

    storeMock.queueSequence.mockResolvedValue({ count: 2, lastId: '33334444-5555' })
    await act(async () => {
      window.dispatchEvent(new Event(storeMock.SYNC_STATE_EVENT))
      await Promise.resolve()
    })
    expect(await screen.findByTestId('outage-receipt')).toHaveTextContent('Receipt #2 · 33334444')
  })

  it('resume disarms, runs the existing preSync drain + clock flow, and raises the reconcile toast', async () => {
    vi.mocked(window.confirm).mockReturnValue(true)
    storeMock.queueSequence.mockResolvedValue({ count: 3, lastId: 'a1b2c3d4-19f7' })
    storeMock.getPendingSyncCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0)
    apiMock.preSyncOfflineData.mockResolvedValue(undefined)
    render(<OutageSimulator />)

    fireEvent.click(screen.getByTestId('outage-pill'))
    fireEvent.click(await screen.findByRole('button', { name: /^Restore & Replay$/i }))

    await waitFor(() => expect(apiMock.preSyncOfflineData).toHaveBeenCalledTimes(1))
    expect(isOutageArmed()).toBe(false)
    expect(notificationsMock.addNotification).toHaveBeenCalledWith(
      'success',
      'Offline Queue Reconciled',
      '3 offline check-ins reconciled',
    )
  })

  it('a failed drain reports an error toast instead of fake success', async () => {
    apiMock.preSyncOfflineData.mockRejectedValue(new Error('Receipt poll failed'))
    render(<OutageSimulator />)

    armOutage()
    await flush()
    fireEvent.click(await screen.findByRole('button', { name: /^Restore & Replay$/i }))

    await waitFor(() =>
      expect(notificationsMock.addNotification).toHaveBeenCalledWith(
        'error',
        'Restore Failed',
        'Receipt poll failed',
      ),
    )
  })
})
