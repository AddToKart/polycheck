import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  restoreSession: vi.fn(),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const assistantChatMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside data-testid="sidebar" /> }))
vi.mock('@/components/Assistant/AssistantChat', () => ({
  AssistantChat: (props: { suggestions?: string[] }) => {
    assistantChatMock(props)
    return <div data-testid="assistant-chat" />
  },
}))

import StudentAssistantPage from './page'

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

describe('Student assistant page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.restoreSession.mockResolvedValue(null)
    apiMock.getCurrentUser.mockReturnValue(student)
  })

  afterEach(cleanup)

  it('renders the assistant in focus geometry with student suggestion chips', async () => {
    render(<StudentAssistantPage />)

    expect(await screen.findByTestId('assistant-chat')).toBeInTheDocument()
    expect(assistantChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        geometry: 'focus',
        suggestions: [
          'Why was I marked absent recently?',
          'What is my attendance standing in each subject?',
          'Draft a message to my professor.',
          'How do I enroll in a subject?',
        ],
      }),
    )
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it('restores the session before rendering the assistant', async () => {
    apiMock.getCurrentUser.mockReturnValue(null)
    apiMock.restoreSession.mockResolvedValue(student)

    render(<StudentAssistantPage />)

    expect(await screen.findByTestId('assistant-chat')).toBeInTheDocument()
    expect(apiMock.restoreSession).toHaveBeenCalledTimes(1)
  })

  it('redirects non-students to the student dashboard', async () => {
    apiMock.getCurrentUser.mockReturnValue(teacher)

    render(<StudentAssistantPage />)

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/student/dashboard'))
    expect(screen.queryByTestId('assistant-chat')).not.toBeInTheDocument()
  })
})
