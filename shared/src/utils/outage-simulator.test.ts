import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SIMULATED_NETWORK_OUTAGE_MESSAGE,
  armOutage,
  createSimulatedNetworkOutage,
  disarmOutage,
  formatOutageReceipt,
  isOutageArmed,
  subscribeToOutage,
} from './outage-simulator'

afterEach(() => {
  disarmOutage()
})

describe('outage-simulator flag store', () => {
  it('starts disarmed on a fresh module evaluation', () => {
    expect(isOutageArmed()).toBe(false)
  })

  it('arm/disarm toggles the flag and notifies subscribers with the boolean payload', () => {
    const transitions: boolean[] = []
    const unsubscribe = subscribeToOutage((armed) => transitions.push(armed))

    armOutage()
    expect(isOutageArmed()).toBe(true)

    disarmOutage()
    expect(isOutageArmed()).toBe(false)

    expect(transitions).toEqual([true, false])
    unsubscribe()
  })

  it('duplicate arm/disarm calls stay idempotent and never re-notify', () => {
    const listener = vi.fn()
    subscribeToOutage(listener)

    armOutage()
    armOutage()
    disarmOutage()
    disarmOutage()

    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenNthCalledWith(1, true)
    expect(listener).toHaveBeenNthCalledWith(2, false)
  })

  it('unsubscribe stops notifications and the cleanup is callable more than once', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToOutage(listener)

    unsubscribe()
    unsubscribe()
    armOutage()
    disarmOutage()

    expect(listener).not.toHaveBeenCalled()
  })

  it('isolates listeners: a throwing subscriber cannot break the others', () => {
    const good = vi.fn()
    const bad = vi.fn(() => {
      throw new Error('listener blew up')
    })
    subscribeToOutage(bad)
    subscribeToOutage(good)

    armOutage()

    expect(good).toHaveBeenCalledWith(true)
    expect(bad).toHaveBeenCalledWith(true)
  })

  it('the simulated failure is a TypeError with the contractual message', () => {
    const failure = createSimulatedNetworkOutage()
    expect(failure).toBeInstanceOf(TypeError)
    expect(failure.message).toBe(SIMULATED_NETWORK_OUTAGE_MESSAGE)
    expect(SIMULATED_NETWORK_OUTAGE_MESSAGE).toContain('Simulated network outage')
  })

  it('imports without window/RN/timer side effects (plain module state)', async () => {
    vi.resetModules()
    const isolated = await import('./outage-simulator')
    expect(isolated.isOutageArmed()).toBe(false)
    isolated.armOutage()
    expect(isolated.isOutageArmed()).toBe(true)
    isolated.disarmOutage()
  })

  describe('formatOutageReceipt', () => {
    it('renders the queue position plus the first 8 characters of the operation id', () => {
      expect(formatOutageReceipt(104, 'a1b2c3d4-19f7-4a0e')).toBe('Receipt #104 · a1b2c3d4')
    })

    it('truncates ids to 8 characters for the chip preview', () => {
      expect(formatOutageReceipt(3, 'a1b2c3d4e5f6')).toBe('Receipt #3 · a1b2c3d4')
    })

    it('falls back to Receipt #0 with no prefix when the queue is empty', () => {
      expect(formatOutageReceipt(0, null)).toBe('Receipt #0')
      expect(formatOutageReceipt(0, '')).toBe('Receipt #0')
      expect(formatOutageReceipt(-5, undefined)).toBe('Receipt #0')
      expect(formatOutageReceipt(Number.NaN, null)).toBe('Receipt #0')
    })
  })
})
