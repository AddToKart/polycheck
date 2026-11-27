import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_TERMS_ACCEPT_LABEL,
  AI_TERMS_SECTIONS,
  AI_TERMS_TITLE,
  AI_TERMS_VERSION,
  type User,
} from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  restoreSession: vi.fn(),
  getAiCapabilities: vi.fn(),
  getAiThread: vi.fn(),
  sendAiChatMessage: vi.fn(),
  downloadAssistantFile: vi.fn(),
  listAiThreads: vi.fn(),
  deleteAiThread: vi.fn(),
  acceptAiTerms: vi.fn(),
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
  email: 'student@example.edu.ph',
  role: 'student',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const teacher: User = {
  id: 'teacher-1',
  fullName: 'Prof. Test',
  email: 'teacher@example.edu.ph',
  role: 'teacher',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const admin: User = {
  id: 'admin-1',
  fullName: 'Dr. Test Admin',
  email: 'admin@example.edu.ph',
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

describe('AssistantChat terms and daily messages', () => {
  const ready = (accepted: boolean, remaining = 10) => ({
    enabled: true,
    maxMessageChars: 500,
    provider: 'api.provider.example',
    terms: { version: AI_TERMS_VERSION, accepted },
    usage: { limit: 10, used: 10 - remaining, remaining, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    apiMock.getCurrentUser.mockReturnValue(student)
  })

  afterEach(cleanup)

  it('shows the terms first and offers no way to send a message', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(ready(false))

    render(<AssistantChat />)

    expect(await screen.findByText(AI_TERMS_TITLE)).toBeInTheDocument()
    expect(screen.getByText('api.provider.example')).toBeInTheDocument()
    for (const section of AI_TERMS_SECTIONS) {
      expect(screen.getByText(section.heading)).toBeInTheDocument()
      for (const point of section.points) expect(screen.getByText(point)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Message the assistant')).not.toBeInTheDocument()
    expect(apiMock.acceptAiTerms).not.toHaveBeenCalled()
  })

  it('records the current version when accepted, then opens the chat', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(ready(false))
    apiMock.acceptAiTerms.mockResolvedValue(ready(true))
    render(<AssistantChat />)

    fireEvent.click(await screen.findByRole('button', { name: AI_TERMS_ACCEPT_LABEL }))

    expect(await screen.findByLabelText('Message the assistant')).toBeInTheDocument()
    expect(apiMock.acceptAiTerms).toHaveBeenCalledWith(AI_TERMS_VERSION)
    expect(screen.getByLabelText('Messages left today')).toHaveTextContent('10 of 10 left today')
  })

  it('stays on the terms and says why when accepting fails', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(ready(false))
    apiMock.acceptAiTerms.mockRejectedValue(new Error('The AI terms have changed.'))
    render(<AssistantChat />)

    fireEvent.click(await screen.findByRole('button', { name: AI_TERMS_ACCEPT_LABEL }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI terms have changed.')
    expect(screen.queryByLabelText('Message the assistant')).not.toBeInTheDocument()
  })

  it('cannot send once the messages for today are used up', async () => {
    apiMock.getAiCapabilities.mockResolvedValue(ready(true, 0))
    render(<AssistantChat />)

    const composer = await screen.findByLabelText('Message the assistant')
    fireEvent.change(composer, { target: { value: 'Hello' } })

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByLabelText('Messages left today')).toHaveTextContent('0 of 10 left today')
  })

  it('works with an older server that sends no terms or allowance', async () => {
    apiMock.getAiCapabilities.mockResolvedValue({ enabled: true, maxMessageChars: 500 })
    render(<AssistantChat />)

    expect(await screen.findByLabelText('Message the assistant')).toBeInTheDocument()
    expect(screen.queryByText(AI_TERMS_TITLE)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Messages left today')).not.toBeInTheDocument()
  })
})
