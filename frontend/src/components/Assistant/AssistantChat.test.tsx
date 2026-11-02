import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  restoreSession: vi.fn(),
  getAiCapabilities: vi.fn(),
  getAiThread: vi.fn(),
  sendAiChatMessage: vi.fn(),
  downloadAssistantFile: vi.fn(),
  listAiThreads: vi.fn(),
  deleteAiThread: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/realtime', () => ({
  subscribeToAiThread: vi.fn(() => () => undefined),
}))

import { AssistantChat } from './AssistantChat'

const student: User = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  email: 'student@pup.edu.ph',
  role: 'student',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

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

describe('AssistantChat suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    apiMock.getCurrentUser.mockReturnValue(student)
    apiMock.getAiCapabilities.mockResolvedValue({
      enabled: true,
      policyBlocked: false,
      maxMessageChars: 500,
    })
  })

  afterEach(cleanup)

  it('fills the composer from a tapped suggestion without sending', async () => {
    render(<AssistantChat suggestions={['Draft a message to my professor.']} />)

    expect(await screen.findByText('Ask about your attendance')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Draft a message to my professor.' }))

    expect(screen.getByLabelText('Message the assistant')).toHaveValue(
      'Draft a message to my professor.',
    )
    expect(apiMock.sendAiChatMessage).not.toHaveBeenCalled()
  })

  it('falls back to student guidance when no suggestions are provided', async () => {
    render(<AssistantChat />)

    expect(
      await screen.findByRole('button', { name: 'Why was I marked absent recently?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How do I enroll in a subject?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'List my sections' })).not.toBeInTheDocument()
  })

  it('uses teacher prompts for teachers', async () => {
    apiMock.getCurrentUser.mockReturnValue(teacher)

    render(<AssistantChat />)

    expect(await screen.findByRole('button', { name: 'List my sections' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Why was I marked absent recently?' }),
    ).not.toBeInTheDocument()
  })

  it('uses institution-scoped prompts and copy for super admins', async () => {
    apiMock.getCurrentUser.mockReturnValue(admin)

    render(<AssistantChat />)

    expect(await screen.findByRole('button', { name: 'Give me an institution overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Who are the disabled accounts?' })).toBeInTheDocument()
    expect(screen.getByText('Administrative assistant')).toBeInTheDocument()
    expect(screen.getByText('Ask about the institution')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'List my sections' })).not.toBeInTheDocument()
  })

  it('renders markdown replies and collapses tool activity for a restored thread', async () => {
    apiMock.getAiThread.mockResolvedValue({
      id: 'thread-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
      messages: [
        {
          id: 'message-1',
          threadId: 'thread-1',
          role: 'user',
          content: 'Summarize my attendance',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'message-2',
          threadId: 'thread-1',
          role: 'assistant',
          content: 'You are at **92%** attendance.',
          createdAt: '2026-01-01T00:00:10.000Z',
          toolInvocations: [
            { tool: 'get_my_standing', outcome: 'succeeded', detail: 'Read your standing' },
          ],
        },
      ],
    })
    window.localStorage.setItem('polycheck-assistant-thread:student-1', 'thread-1')

    render(<AssistantChat />)

    const bold = await screen.findByText('92%')
    expect(bold.tagName).toBe('STRONG')
    const disclosure = screen.getByRole('button', { name: /Used 1 tool/i })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/get my standing · succeeded/i)).not.toBeInTheDocument()

    fireEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/get my standing · succeeded/i)).toBeInTheDocument()
  })

  it("shows the administrator's policy reason and hides settings from students", async () => {
    apiMock.getAiCapabilities.mockResolvedValue({
      enabled: false,
      policyBlocked: true,
      reason: 'The AI assistant is disabled for students by your administrator.',
      maxMessageChars: 500,
    })

    render(<AssistantChat />)

    expect(
      await screen.findByText('The AI assistant is disabled for students by your administrator.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Message the assistant')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open Institution Settings' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the Institution Settings affordance for a policy-blocked super admin', async () => {
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getAiCapabilities.mockResolvedValue({
      enabled: false,
      policyBlocked: true,
      reason: 'The AI assistant has been disabled by your administrator.',
      maxMessageChars: 500,
    })

    render(<AssistantChat />)

    expect(
      await screen.findByText('The AI assistant has been disabled by your administrator.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Institution Settings' })).toHaveAttribute(
      'href',
      '/faculty/settings',
    )
  })

  it('keeps the setup link for an unconfigured super admin', async () => {
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getAiCapabilities.mockResolvedValue({
      enabled: false,
      policyBlocked: false,
      missing: ['api_key'],
      reason: 'Assistant is not configured (missing api_key)',
      maxMessageChars: 500,
    })

    render(<AssistantChat />)

    expect(await screen.findByText('Assistant is not configured (missing api_key)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Institution Settings' })).toBeInTheDocument()
  })
})
