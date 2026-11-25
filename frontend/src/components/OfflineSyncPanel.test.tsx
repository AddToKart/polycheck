import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeMock = vi.hoisted(() => ({
  SYNC_STATE_EVENT: 'polycheck-sync-state',
  SYNC_REQUEST_EVENT: 'polycheck-sync-requested',
  getLastSyncAt: vi.fn(),
  getOfflineQueueIssues: vi.fn(),
  getPendingSyncCount: vi.fn(),
  retryOfflineOperation: vi.fn(),
}))

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  syncOfflineQueue: vi.fn(),
}))

vi.mock('@/lib/offline/store', () => storeMock)
vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import { OfflineSyncPanel } from './OfflineSyncPanel'

describe('OfflineSyncPanel drain scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    storeMock.getLastSyncAt.mockResolvedValue(null)
    storeMock.getOfflineQueueIssues.mockResolvedValue([])
    apiMock.getCurrentUser.mockReturnValue({ id: 'student-1', role: 'student' })
    apiMock.syncOfflineQueue.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('drains on mount and backs off exponentially, capped, while nothing progresses', async () => {
    // The row never leaves the queue, so each attempt counts as no progress.
    storeMock.getPendingSyncCount.mockResolvedValue(1)

    render(<OfflineSyncPanel />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // Cold boot drains immediately instead of waiting for the first tick.
    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(1)

    // First failure backs off to 60 s, so the 30 s tick must not drain again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(2)

    // Backoff doubles (120 s): 30 s ticks inside that window stay idle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(3)
  })

  it('stops retrying once the queue is empty', async () => {
    storeMock.getPendingSyncCount.mockResolvedValue(0)

    render(<OfflineSyncPanel />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(apiMock.syncOfflineQueue).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    expect(apiMock.syncOfflineQueue).not.toHaveBeenCalled()
  })

  // ── WEB-11: a SYNC_REQUEST_EVENT drains on the live count ─────────────────

  it('drains immediately when a request event follows an enqueue on an empty queue', async () => {
    // Cold boot saw an empty queue, so the cached pending ref is 0.
    storeMock.getPendingSyncCount.mockResolvedValueOnce(0)
    render(<OfflineSyncPanel />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(apiMock.syncOfflineQueue).not.toHaveBeenCalled()

    // The enqueue lands, then the store fires the event. The cached ref is
    // still 0 until a SYNC_STATE refresh runs, so the drain must read the live
    // store count (WEB-11) instead of trusting the stale ref.
    storeMock.getPendingSyncCount.mockResolvedValue(1)
    await act(async () => {
      window.dispatchEvent(new Event(storeMock.SYNC_REQUEST_EVENT))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(apiMock.syncOfflineQueue).toHaveBeenCalledTimes(1)
  })

  it('does not spam the endpoint for an event while the queue is genuinely empty', async () => {
    storeMock.getPendingSyncCount.mockResolvedValue(0)
    render(<OfflineSyncPanel />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      window.dispatchEvent(new Event(storeMock.SYNC_REQUEST_EVENT))
      window.dispatchEvent(new Event(storeMock.SYNC_REQUEST_EVENT))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(apiMock.syncOfflineQueue).not.toHaveBeenCalled()
  })
})
