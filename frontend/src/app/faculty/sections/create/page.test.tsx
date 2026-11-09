import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Subject, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSubject: vi.fn(),
  createSection: vi.fn(),
  logout: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams('subjectId=subj-1'),
}))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))

import CreateSectionPage from './page'

const teacherUser: User = {
  id: 't-001',
  fullName: 'Prof. Juan Dela Cruz',
  role: 'teacher',
  department: 'CCIS',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const subject: Subject = {
  id: 'subj-1',
  name: 'Introduction to Computing',
  code: 'CS 101',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderPage() {
  return render(<CreateSectionPage />)
}

async function fillRequiredFields() {
  fireEvent.change(await screen.findByLabelText('Section'), { target: { value: 'A' } })
  fireEvent.change(screen.getByLabelText('Room'), { target: { value: 'CS Lab 1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await waitFor(() => expect(screen.getByText('09:00 - 10:30')).toBeInTheDocument())
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getCurrentUser.mockReturnValue(teacherUser)
  apiMock.getSubject.mockResolvedValue(subject)
  apiMock.createSection.mockResolvedValue({
    id: 'sec-1',
    subjectId: 'subj-1',
    section: 'A',
    course: 'BSIT',
    room: 'CS Lab 1',
    schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:30' }],
    semester: '1st Semester AY 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Dela Cruz',
    studentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
})

afterEach(cleanup)

describe('Create Section page course selector', () => {
  it('keeps Create Section disabled until a course is chosen', async () => {
    renderPage()
    await fillRequiredFields()

    expect(screen.getByRole('button', { name: 'Create Section' })).toBeDisabled()
    expect(apiMock.createSection).not.toHaveBeenCalled()
  })

  it('groups catalog options by department and submits the selected course code', async () => {
    renderPage()
    await fillRequiredFields()

    const courseSelect = screen.getByLabelText('Course')
    const optgroups = Array.from(courseSelect.querySelectorAll('optgroup')).map((group) => group.label)
    expect(optgroups).toContain('CCIS')
    expect(
      Array.from(courseSelect.querySelectorAll('option')).some(
        (option) => option.value === 'BSIT' && option.textContent === 'BSIT — BS Information Technology',
      ),
    ).toBe(true)

    fireEvent.change(courseSelect, { target: { value: 'BSIT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Section' }))

    await waitFor(() => expect(apiMock.createSection).toHaveBeenCalledTimes(1))
    expect(apiMock.createSection.mock.calls[0][0]).toMatchObject({
      subjectId: 'subj-1',
      section: 'A',
      course: 'BSIT',
      room: 'CS Lab 1',
    })
    expect(routerMock.push).toHaveBeenCalledWith('/faculty/subjects/subj-1')
  })

  it('submits the trimmed value typed into the "Other" course field', async () => {
    renderPage()
    await fillRequiredFields()

    fireEvent.change(screen.getByLabelText('Course'), { target: { value: '__custom__' } })
    const customInput = await screen.findByLabelText('Custom course code')
    expect(customInput).toHaveAttribute('maxLength', '30')

    fireEvent.change(customInput, { target: { value: '  BSIT-SM  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Section' }))

    await waitFor(() => expect(apiMock.createSection).toHaveBeenCalledTimes(1))
    expect(apiMock.createSection.mock.calls[0][0]).toMatchObject({ course: 'BSIT-SM' })
  })

  it('stays disabled when the "Other" course field is blank', async () => {
    renderPage()
    await fillRequiredFields()

    fireEvent.change(screen.getByLabelText('Course'), { target: { value: '__custom__' } })
    fireEvent.change(await screen.findByLabelText('Custom course code'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Create Section' })).toBeDisabled()
  })
})
