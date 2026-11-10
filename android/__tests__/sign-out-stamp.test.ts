// Coverage for the sign-out in-flight stamp. The helper only touches Alert,
// the router and api.logout, so the stamp lifecycle can be tested without a
// navigator, auth store or native module mocks.

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}))
jest.mock('../services/api-client', () => ({
  api: { logout: jest.fn(() => Promise.resolve()) },
}))

import { Alert } from 'react-native'
import { router } from 'expo-router'
import { api } from '../services/api-client'
import { confirmSignOut, isSignOutInFlight } from '../lib/sign-out'

interface AlertButton {
  text?: string
  style?: string
  onPress?: () => void
}

const alertMock = Alert.alert as unknown as jest.Mock
const logoutMock = api.logout as unknown as jest.Mock
const replaceMock = router.replace as unknown as jest.Mock

let frameCallbacks: FrameRequestCallback[] = []

function flushFrame() {
  const callbacks = frameCallbacks
  frameCallbacks = []
  for (const callback of callbacks) callback(0)
}

function lastAlertButtons(): AlertButton[] {
  const calls = alertMock.mock.calls
  return calls[calls.length - 1][2] as AlertButton[]
}

function pressSignOut() {
  confirmSignOut()
  const button = lastAlertButtons().find((candidate) => candidate.style === 'destructive')
  expect(button?.onPress).toBeDefined()
  button?.onPress?.()
}

beforeEach(() => {
  jest.useFakeTimers()
  frameCallbacks = []
  ;(globalThis as { requestAnimationFrame?: (callback: FrameRequestCallback) => number }).requestAnimationFrame =
    (callback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    }
})

afterEach(() => {
  // Drain any guard a failing assertion may have left armed so the module-level
  // stamp cannot leak into the next test.
  jest.advanceTimersByTime(2000)
  flushFrame()
  jest.useRealTimers()
  jest.clearAllMocks()
  delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame
})

describe('sign-out in-flight stamp', () => {
  it('does nothing until the destructive action is confirmed', () => {
    confirmSignOut()
    expect(isSignOutInFlight()).toBe(false)
    expect(logoutMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()

    const cancel = lastAlertButtons().find((button) => button.style === 'cancel')
    expect(cancel).toBeDefined()
    cancel?.onPress?.()
    expect(isSignOutInFlight()).toBe(false)
    expect(logoutMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('stamps synchronously on confirm and releases the guard after ~2 seconds', () => {
    expect(isSignOutInFlight()).toBe(false)

    pressSignOut()

    expect(isSignOutInFlight()).toBe(true)
    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/')

    // The frame after navigation re-arms the guard instead of clearing it, so
    // a competing gate redirect that lands during the unmount still stands down.
    flushFrame()
    expect(isSignOutInFlight()).toBe(true)

    jest.advanceTimersByTime(1999)
    expect(isSignOutInFlight()).toBe(true)

    jest.advanceTimersByTime(1)
    expect(isSignOutInFlight()).toBe(true)
    flushFrame()
    expect(isSignOutInFlight()).toBe(false)
  })
})
