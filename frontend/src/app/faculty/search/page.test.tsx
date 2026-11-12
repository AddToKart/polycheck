import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSubjects: vi.fn(),
  search: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const paramsMock = vi.hoisted(() => ({ value: '' }))

vi.mock('@/lib/api-client', () => ({ api: apiMock, requestUserLogout: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(paramsMock.value),
}))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => null }))

import SearchPage from './page'

const teacher: User = {
  id: 't-001',
  fullName: 'Prof. Test',
  role: 'teacher',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function student(id: string, fullName: string): Student {
  return {
    id,
    fullName,
    studentId: `2026-${id}`,
    program: 'BSIT',
  } as Student
}

const EMPTY_RESULT = { students: [], sections: [], sessions: [] }

type StubResults = { students: Student[]; sections: never[]; sessions: never[] }

async function typeInSearch(value: string) {
  const input = await screen.findByPlaceholderText('Search students, subjects, sections, sessions…')
  fireEvent.change(input, { target: { value } })
  return input
}

describe('Global search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paramsMock.value = ''
    apiMock.getCurrentUser.mockReturnValue(teacher)
    apiMock.getSubjects.mockResolvedValue([])
    apiMock.search.mockResolvedValue(EMPTY_RESULT)
  })

  afterEach(cleanup)

  it('debounces per-keystroke input into one request for the final query', async () => {
    render(<SearchPage />)

    const input = await typeInSearch('a')
    fireEvent.change(input, { target: { value: 'ad' } })
    fireEvent.change(input, { target: { value: 'ada' } })

    await waitFor(() => expect(apiMock.search).toHaveBeenCalledTimes(1))
    expect(apiMock.search).toHaveBeenCalledWith('ada')

    // Still only one request after the debounce window passes.
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(apiMock.search).toHaveBeenCalledTimes(1)
  })

  it('never renders a stale response for a superseded query', async () => {
    const slow = Promise.withResolvers<StubResults>()
    const fast = Promise.withResolvers<StubResults>()
    apiMock.search.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)

    render(<SearchPage />)
    const input = await typeInSearch('ada')
    await waitFor(() => expect(apiMock.search).toHaveBeenCalledWith('ada'))
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'grace' } })
    await waitFor(() => expect(apiMock.search).toHaveBeenCalledWith('grace'))

    fast.resolve({ students: [student('2', 'Grace Hopper')], sections: [], sessions: [] })
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()

    slow.resolve({ students: [student('1', 'Ada Lovelace')], sections: [], sessions: [] })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('runs a deep-linked query immediately', async () => {
    paramsMock.value = 'q=hopper'
    apiMock.search.mockResolvedValue({
      students: [student('2', 'Grace Hopper')],
      sections: [],
      sessions: [],
    })

    render(<SearchPage />)

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
    expect(apiMock.search).toHaveBeenCalledWith('hopper')
  })

  it('surfaces a failed search with a retry', async () => {
    apiMock.search.mockRejectedValueOnce(new Error('Search is down'))

    render(<SearchPage />)
    await typeInSearch('ada')

    expect(await screen.findByText('Search is down')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
