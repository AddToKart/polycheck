import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ addNotification: vi.fn() }))

vi.mock('@/lib/notifications', () => ({
  useNotifications: () => ({ addNotification: mocks.addNotification }),
}))

import { describeMutationError, useRunMutation } from './run-mutation'

describe('useRunMutation', () => {
  beforeEach(() => {
    mocks.addNotification.mockReset()
  })

  it('runs a pending action once and refuses a duplicate in flight', async () => {
    const { result } = renderHook(() => useRunMutation())
    const gate = Promise.withResolvers<string>()
    const task = vi.fn(() => gate.promise)

    let first: Promise<string | null> | undefined
    let second: Promise<string | null> | undefined
    act(() => {
      first = result.current.run('resolve', task)
      second = result.current.run('resolve', task)
    })
    expect(result.current.isPending('resolve')).toBe(true)

    await act(async () => {
      gate.resolve('ok')
      await first
    })
    await expect(second).resolves.toBeNull()
    expect(task).toHaveBeenCalledTimes(1)
    expect(result.current.isPending('resolve')).toBe(false)
    expect(mocks.addNotification).not.toHaveBeenCalled()
  })

  it('surfaces a rejection as an error notification instead of throwing', async () => {
    const { result } = renderHook(() => useRunMutation())
    const onError = vi.fn()
    let outcome: unknown = 'unset'

    await act(async () => {
      outcome = await result.current.run(
        'reject',
        () => Promise.reject(new Error('Dispute already resolved')),
        { errorTitle: 'Could not resolve', onError },
      )
    })

    expect(outcome).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(mocks.addNotification).toHaveBeenCalledWith(
      'error',
      'Could not resolve',
      'Dispute already resolved',
    )
    expect(result.current.isPending('reject')).toBe(false)
  })

  it('allows independent actions to run concurrently', async () => {
    const { result } = renderHook(() => useRunMutation())
    const gateA = Promise.withResolvers<void>()
    const gateB = Promise.withResolvers<void>()
    const taskA = vi.fn(() => gateA.promise)
    const taskB = vi.fn(() => gateB.promise)
    let pendingA: Promise<void | null> | undefined
    let pendingB: Promise<void | null> | undefined

    act(() => {
      pendingA = result.current.run('enroll', taskA)
      pendingB = result.current.run('reset-code', taskB)
    })
    expect(result.current.isPending('enroll')).toBe(true)
    expect(result.current.isPending('reset-code')).toBe(true)

    await act(async () => {
      gateA.resolve()
      gateB.resolve()
      await Promise.all([pendingA, pendingB])
    })
    expect(taskA).toHaveBeenCalledTimes(1)
    expect(taskB).toHaveBeenCalledTimes(1)
  })

  it('emits the configured success notification and forwards the result', async () => {
    const { result } = renderHook(() => useRunMutation())
    const onSuccess = vi.fn()

    await act(async () => {
      await result.current.run('grant', () => Promise.resolve('granted'), {
        success: { title: 'Permission granted', message: 'Valid for 24 hours.' },
        onSuccess,
      })
    })

    expect(mocks.addNotification).toHaveBeenCalledWith(
      'success',
      'Permission granted',
      'Valid for 24 hours.',
    )
    expect(onSuccess).toHaveBeenCalledWith('granted')
  })
})

describe('describeMutationError', () => {
  it('prefers the thrown message and falls back for unknown values', () => {
    expect(describeMutationError(new Error('boom'))).toBe('boom')
    expect(describeMutationError({})).toBe('Something went wrong. Please try again.')
    expect(describeMutationError('', 'context-specific')).toBe('context-specific')
  })
})
