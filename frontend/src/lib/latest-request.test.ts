import { describe, expect, it, vi } from 'vitest'
import { createLatestRequestGuard, runLatest } from './latest-request'

describe('createLatestRequestGuard', () => {
  it('keeps only the newest request current', () => {
    const guard = createLatestRequestGuard()
    const first = guard.begin()
    const second = guard.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)

    guard.invalidate()
    expect(second()).toBe(false)
  })
})

describe('runLatest', () => {
  it('marks a slow older response stale and keeps the newest result', async () => {
    const guard = createLatestRequestGuard()
    const slow = Promise.withResolvers<string>()
    const fast = Promise.withResolvers<string>()

    const firstRun = runLatest(guard, () => slow.promise)
    const secondRun = runLatest(guard, () => fast.promise)
    fast.resolve('second')
    slow.resolve('first')

    const [first, second] = await Promise.all([firstRun, secondRun])
    expect(second).toEqual({ stale: false, result: 'second', error: null })
    expect(first.stale).toBe(true)
    expect(first.result).toBe('first')
  })

  it('reports errors only while the request is current', async () => {
    const guard = createLatestRequestGuard()
    const failing = Promise.withResolvers<string>()
    const failingRun = runLatest(guard, () => failing.promise)
    // A newer request supersedes the failing one before it rejects.
    runLatest(guard, () => Promise.resolve('newest'))
    failing.reject(new Error('boom'))

    const outcome = await failingRun
    expect(outcome.stale).toBe(true)
    expect(outcome.error).toBeInstanceOf(Error)
  })

  it('forwards a rejection for the current request', async () => {
    const guard = createLatestRequestGuard()
    const task = vi.fn(() => Promise.reject(new Error('backend down')))
    const outcome = await runLatest(guard, task)
    expect(outcome.stale).toBe(false)
    expect((outcome.error as Error).message).toBe('backend down')
  })
})
