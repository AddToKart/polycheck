import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from '@polycheck/shared'
import { NotificationProvider } from '@/lib/notifications'
import { DevicePanel } from './ProfileSecurity'

const apiMock = vi.hoisted(() => ({
  unregisterDevice: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

afterEach(cleanup)

function student(overrides: Partial<User> = {}): User {
  return {
    id: 's-1',
    fullName: 'Juan Dela Cruz',
    role: 'student',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    boundDeviceId: 'mobile-abcd12345678',
    deviceBoundAt: '2026-10-01T08:00:00.000Z',
    deviceCooldownUntil: null,
    ...overrides,
  }
}

function renderPanel(user: User, onUpdated = vi.fn(), onLoggedOut = vi.fn()) {
  render(
    <NotificationProvider>
      <DevicePanel user={user} onUpdated={onUpdated} onLoggedOut={onLoggedOut} />
    </NotificationProvider>,
  )
  return { onUpdated, onLoggedOut }
}

describe('DevicePanel', () => {
  beforeEach(() => {
    apiMock.unregisterDevice.mockReset()
    apiMock.logout.mockReset().mockResolvedValue(undefined)
  })

  it('shows the bound device id suffix and binding date', () => {
    renderPanel(student())
    expect(screen.getByText(/Android device · …345678/)).toBeInTheDocument()
    expect(screen.getAllByText(/Bound /).length).toBeGreaterThan(0)
  })

  it('shows the remaining cooldown window', () => {
    const until = new Date(Date.now() + 83 * 60_000).toISOString()
    renderPanel(student({ deviceCooldownUntil: until }))
    expect(screen.getByText(/Mobile sign-ins locked · 1 h 23 min left/)).toBeInTheDocument()
  })

  it('confirms the policy copy before unregistering and signs out', async () => {
    apiMock.unregisterDevice.mockResolvedValue({
      user: student({ boundDeviceId: null, deviceCooldownUntil: new Date(Date.now() + 2 * 3_600_000).toISOString() }),
      cooldownHours: 2,
      cooldownUntil: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      message: 'Device unregistered.',
    })
    const { onUpdated, onLoggedOut } = renderPanel(student())

    fireEvent.click(screen.getByRole('button', { name: /unregister this device/i }))

    expect(
      await screen.findByText(/Unregistering will lock your account from logging into another device/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Unregister$/ }))

    await waitFor(() =>
      expect(apiMock.unregisterDevice).toHaveBeenCalledWith('mobile-abcd12345678'),
    )
    await waitFor(() => expect(apiMock.logout).toHaveBeenCalledTimes(1))
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onLoggedOut).toHaveBeenCalledTimes(1)
  })
})
