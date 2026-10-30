import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiCapabilities, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAiCapabilities: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ usePathname: () => '/faculty' }))
vi.mock('./AssistantChat', () => ({
  AssistantChat: () => <div data-testid="assistant-chat" />,
}))

import { AssistantLauncher } from './AssistantLauncher'

const teacher: User = {
  id: 'teacher-1',
  fullName: 'Prof. Test',
  email: 'teacher@pup.edu.ph',
  role: 'teacher',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const admin: User = {
  id: 'admin-1',
  fullName: 'Dr. Test Admin',
  email: 'admin@pup.edu.ph',
  role: 'super_admin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const enabled: AiCapabilities = { enabled: true, model: 'deepseek-v4.1-flash' }
const policyBlocked: AiCapabilities = {
  enabled: false,
  policyBlocked: true,
  reason: 'The AI assistant has been disabled by your administrator.',
}
const unconfigured: AiCapabilities = { enabled: false, missing: ['api_key'] }

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('AssistantLauncher entry-point gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getCurrentUser.mockReturnValue(teacher)
    apiMock.getAiCapabilities.mockResolvedValue(enabled)
  })

  afterEach(cleanup)

  it('renders the role-aware bubble when capabilities are ready', async () => {
    render(<AssistantLauncher />)

    const bubble = await screen.findByRole('button', { name: 'Open faculty assistant' })
    expect(bubble).toHaveAttribute('title', 'Faculty assistant')
    expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(1)
  })

  it('hides the bubble when capabilities are policy-blocked', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(policyBlocked)

    render(<AssistantLauncher />)

    await waitFor(() => expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(1))
    await flush()
    expect(screen.queryByRole('button', { name: /assistant/i })).not.toBeInTheDocument()
  })

  it('hides an unconfigured assistant from teachers', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(unconfigured)

    render(<AssistantLauncher />)

    await waitFor(() => expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(1))
    await flush()
    expect(screen.queryByRole('button', { name: /assistant/i })).not.toBeInTheDocument()
  })

  it('keeps the setup affordance for an unconfigured super admin', async () => {
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getAiCapabilities.mockResolvedValue(unconfigured)

    render(<AssistantLauncher />)

    expect(
      await screen.findByRole('button', { name: 'Open administrative assistant' }),
    ).toBeInTheDocument()
  })

  it('hides the bubble when the capabilities check fails', async () => {
    apiMock.getAiCapabilities.mockRejectedValue(new Error('offline'))

    render(<AssistantLauncher />)

    await waitFor(() => expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(1))
    await flush()
    expect(screen.queryByRole('button', { name: /assistant/i })).not.toBeInTheDocument()
  })

  it('keeps an open panel mounted across a same-user session revalidation', async () => {
    render(<AssistantLauncher />)

    fireEvent.click(await screen.findByRole('button', { name: 'Open faculty assistant' }))
    expect(screen.getByTestId('assistant-chat')).toBeInTheDocument()

    // SessionGuard revalidates every minute and dispatches this event even when
    // the session is unchanged; the panel must not unmount or reset.
    fireEvent(window, new Event('polycheck-auth-changed'))
    expect(screen.getByTestId('assistant-chat')).toBeInTheDocument()

    await waitFor(() => expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('assistant-chat')).toBeInTheDocument()
  })

  it('closes an open panel when a later check becomes policy-blocked', async () => {
    render(<AssistantLauncher />)

    fireEvent.click(await screen.findByRole('button', { name: 'Open faculty assistant' }))
    expect(screen.getByTestId('assistant-chat')).toBeInTheDocument()

    apiMock.getAiCapabilities.mockResolvedValue(policyBlocked)
    fireEvent(window, new Event('polycheck-auth-changed'))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /assistant/i })).not.toBeInTheDocument(),
    )
    expect(screen.queryByTestId('assistant-chat')).not.toBeInTheDocument()
  })
})
