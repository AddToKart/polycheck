import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSubjects: vi.fn(),
  getSections: vi.fn(),
  getSettings: vi.fn(),
  getSessions: vi.fn(),
  createSession: vi.fn(),
  createBulkSessions: vi.fn(),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside aria-label="Sidebar" /> }))
vi.mock('@/components/MapPicker', () => ({ default: () => <div>Map</div> }))

import { formatCampusDate, sectionCourseLabel } from '@polycheck/shared'
import CreateSessionPage from './page'
import {
  CUSTOM_SLOT_VALUE,
  defaultSlotSelection,
  nextOccurrenceDate,
} from '@/lib/session-slots'

const teacher = {
  id: 'teacher-1',
  fullName: 'Prof. Test',
  role: 'teacher' as const,
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const subject = {
  id: 'subj-1',
  name: 'Software Engineering',
  code: 'CCIS 3104',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const schedule = [
  { day: 'Mon' as const, startTime: '08:00', endTime: '10:30' },
  { day: 'Wed' as const, startTime: '09:00', endTime: '12:30' },
]

const section = {
  id: 'sec-1',
  subjectId: subject.id,
  section: '4-1',
  course: 'BSIT',
  room: 'CCIS Lab 3',
  schedule,
  semester: '1st Semester',
  teacherId: teacher.id,
  teacherName: teacher.fullName,
  studentCount: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const selectSection = async () => {
  render(<CreateSessionPage />)
  const subjectSelect = await screen.findByLabelText('Subject')
  fireEvent.change(subjectSelect, { target: { value: subject.id } })
  fireEvent.change(screen.getByLabelText('Section'), { target: { value: section.id } })
  await screen.findByLabelText('Class meeting')
}

const getDateInput = () => screen.getByLabelText('Date') as HTMLInputElement
const getStartInput = () => screen.getByLabelText('Start Time') as HTMLInputElement
const getEndInput = () => screen.getByLabelText('End Time') as HTMLInputElement
const getClassMeeting = () => screen.getByLabelText('Class meeting') as HTMLSelectElement

describe('faculty create-session slot selector', () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset())
    vi.clearAllMocks()
    apiMock.getCurrentUser.mockReturnValue(teacher)
    apiMock.getSubjects.mockResolvedValue([subject])
    apiMock.getSections.mockResolvedValue([section])
    apiMock.getSettings.mockResolvedValue([])
    apiMock.getSessions.mockResolvedValue([])
    apiMock.createSession.mockResolvedValue({ id: 'session-new' })
    apiMock.createBulkSessions.mockResolvedValue([])
    routerMock.push.mockReset()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('lists the section course, every schedule slot, and the custom option', async () => {
    await selectSection()

    expect(
      screen.getByRole('option', {
        name: `Section ${section.section} — ${section.room} — Mon, Wed · ${sectionCourseLabel(section.course)}`,
      }),
    ).toBeInTheDocument()

    const options = Array.from(getClassMeeting().options).map((option) => option.textContent)
    expect(options).toEqual([
      'Mon 08:00–10:30 (CCIS Lab 3)',
      'Wed 09:00–12:30 (CCIS Lab 3)',
      'Not a scheduled day (custom)',
    ])
    // Default = the date's weekday when it matches, else the first slot.
    expect(getClassMeeting().value).toBe(defaultSlotSelection(schedule, formatCampusDate()))
  })

  it('picking a slot refills time/room and moves the date to its next occurrence', async () => {
    await selectSection()

    fireEvent.change(getClassMeeting(), { target: { value: '1' } })

    expect(getStartInput().value).toBe('09:00')
    expect(getEndInput().value).toBe('12:30')
    expect(getDateInput().value).toBe(nextOccurrenceDate('Wed'))
    expect((screen.getByLabelText('Room') as HTMLInputElement).value).toBe('CCIS Lab 3')
  })

  it('keeps the custom option neutral and couples date changes to matching slots', async () => {
    await selectSection()

    fireEvent.change(getClassMeeting(), { target: { value: '0' } })
    expect(getStartInput().value).toBe('08:00')
    const mondayDate = getDateInput().value

    fireEvent.change(getClassMeeting(), { target: { value: CUSTOM_SLOT_VALUE } })
    expect(getDateInput().value).toBe(mondayDate)
    expect(getStartInput().value).toBe('08:00')

    // Monday auto-selects the first slot…
    fireEvent.change(getDateInput(), { target: { value: '2026-11-09' } })
    expect(getClassMeeting().value).toBe('0')
    expect(getStartInput().value).toBe('08:00')
    expect(getEndInput().value).toBe('10:30')

    // …while an unscheduled weekday switches to the neutral option and leaves
    // times untouched.
    fireEvent.change(getDateInput(), { target: { value: '2026-11-10' } })
    expect(getClassMeeting().value).toBe(CUSTOM_SLOT_VALUE)
    expect(getStartInput().value).toBe('08:00')
    expect(getEndInput().value).toBe('10:30')
  })

  it('submits exactly one session for the selected slot', async () => {
    await selectSection()

    fireEvent.change(getClassMeeting(), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }))

    await waitFor(() => expect(apiMock.createSession).toHaveBeenCalledTimes(1))
    expect(apiMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: section.id,
        subjectName: subject.name,
        date: nextOccurrenceDate('Wed'),
        startTime: '09:00',
        endTime: '12:30',
        room: section.room,
      }),
    )
    expect(apiMock.createBulkSessions).not.toHaveBeenCalled()
    expect(routerMock.push).toHaveBeenCalledWith('/faculty/sessions')
  })

  it('bulk-creates one series per slot with each row’s own edited times', async () => {
    await selectSection()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Create recurring sessions for the semester' }))
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-11-30' } })

    // November 2026 has five Mondays and four Wednesdays.
    expect(screen.getByText('9 sessions will be created')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Wed end time'), { target: { value: '13:00' } })
    expect(screen.getByText('9 sessions will be created')).toBeInTheDocument()
    expect(screen.queryByLabelText('Start Time')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create 9 Sessions' }))
    await waitFor(() => expect(apiMock.createBulkSessions).toHaveBeenCalledTimes(1))

    const payload = apiMock.createBulkSessions.mock.calls[0][0]
    expect(payload.slots).toEqual([
      { day: 'Mon', startTime: '08:00', endTime: '10:30' },
      { day: 'Wed', startTime: '09:00', endTime: '13:00' },
    ])
    expect(payload).not.toHaveProperty('daysOfWeek')
    expect(payload).not.toHaveProperty('startTime')
    expect(payload).not.toHaveProperty('endTime')
    expect(payload.startDate).toBe('2026-11-01')
    expect(payload.endDate).toBe('2026-11-30')
    expect(payload.room).toBe(section.room)
    expect(routerMock.push).toHaveBeenCalledWith('/faculty/sessions')
  })

  it('only sends checked bulk rows and recounts per selected slot', async () => {
    await selectSection()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Create recurring sessions for the semester' }))
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-11-30' } })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }))
    expect(screen.getByText('4 sessions will be created')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create 4 Sessions' }))
    await waitFor(() => expect(apiMock.createBulkSessions).toHaveBeenCalledTimes(1))

    expect(apiMock.createBulkSessions.mock.calls[0][0].slots).toEqual([
      { day: 'Wed', startTime: '09:00', endTime: '12:30' },
    ])
  })

  it('ignores a stale duplicate-check response so submit is never blocked by it', async () => {
    const staleCheck = Promise.withResolvers<never[]>()
    const freshCheck = Promise.withResolvers<never[]>()
    apiMock.getSessions
      .mockReturnValueOnce(staleCheck.promise as Promise<never[]>)
      .mockReturnValue(freshCheck.promise as Promise<never[]>)

    render(<CreateSessionPage />)
    const subjectSelect = await screen.findByLabelText('Subject')
    fireEvent.change(subjectSelect, { target: { value: subject.id } })
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: section.id } })
    await screen.findByLabelText('Class meeting')

    // Switch the date, superseding the in-flight check for the previous date.
    fireEvent.change(getDateInput(), { target: { value: '2026-12-01' } })

    freshCheck.resolve([])
    await waitFor(() => expect(apiMock.getSessions).toHaveBeenCalledTimes(2))
    // The stale answer names the CURRENT date — without a sequence guard it
    // would both render a phantom conflict and disable submit forever.
    staleCheck.resolve([
      {
        id: 'existing-session',
        sectionId: section.id,
        subjectId: subject.id,
        subjectName: subject.name,
        date: '2026-12-01',
      } as never,
    ])

    await waitFor(() =>
      expect(screen.queryByText('Session Conflict Detected')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Create Session' })).toBeEnabled()
  })
})
