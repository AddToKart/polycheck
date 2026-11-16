import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  getAttendanceRecords: vi.fn(),
  getProofsOfClass: vi.fn(),
  getSection: vi.fn(),
  getSectionStudents: vi.fn(),
  generateQrCode: vi.fn(),
  endSession: vi.fn(),
  updateAttendanceStatus: vi.fn(),
  addAttendanceRecord: vi.fn(),
  getStudent: vi.fn(),
  logout: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }))
const qrMock = vi.hoisted(() => vi.fn())
const subscribeMock = vi.hoisted(() => vi.fn(() => vi.fn()))
const addNotificationMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', () => ({
  api: apiMock,
  // Match the real class shape used by the cockpit's override branch.
  ApiHttpError: class HttpApiError extends Error {
    constructor(
      message: string,
      readonly status = 0,
      readonly code?: string,
      readonly remainingMinutes?: number,
      readonly distanceMeters?: number,
      readonly allowedDistanceMeters?: number,
      readonly canRequestOverride?: boolean,
    ) {
      super(message)
    }
  },
}))
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'session-1' }),
  useRouter: () => routerMock,
}))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside aria-label="Sidebar" /> }))
vi.mock('@/components/CampusMap', () => ({ default: () => <div>Campus map</div> }))
vi.mock('@/lib/notifications', () => ({ useNotifications: () => ({ addNotification: addNotificationMock }) }))
vi.mock('@/lib/realtime', () => ({ subscribeToSession: subscribeMock }))
vi.mock('qrcode', () => ({ default: { toDataURL: qrMock } }))

import SessionDetailPage from './page'

const teacher = {
  id: 'teacher-1',
  fullName: 'Prof. Test',
  role: 'teacher' as const,
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const session: Session = {
  id: 'session-1',
  sectionId: 'section-1',
  subjectName: 'Software Engineering',
  mode: 'in_person',
  date: '2026-08-06',
  startTime: '08:00',
  endTime: '10:00',
  qrValidityMinutes: 10,
  gracePeriodMinutes: 15,
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
  isActive: false,
  qrToken: 'stable-token',
  teacherId: teacher.id,
  createdAt: '2026-08-01T00:00:00.000Z',
}

describe('faculty session cockpit', () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset())
    vi.clearAllMocks()
    apiMock.getCurrentUser.mockReturnValue(teacher)
    apiMock.getSession.mockResolvedValue(session)
    apiMock.getAttendanceRecords.mockResolvedValue([])
    apiMock.getProofsOfClass.mockResolvedValue([])
    apiMock.getSection.mockResolvedValue({ id: 'section-1', teacherId: teacher.id })
    apiMock.getSectionStudents.mockResolvedValue([])
    apiMock.generateQrCode.mockResolvedValue({ ...session, isActive: true })
    apiMock.endSession.mockResolvedValue({ ...session, isActive: false, endedAt: '2026-08-06T10:00:00.000Z' })
    apiMock.updateAttendanceStatus.mockResolvedValue({ id: 'rec-1', status: 'present' })
    apiMock.addAttendanceRecord.mockResolvedValue({ id: 'rec-1', status: 'present' })
    apiMock.getStudent.mockResolvedValue(null)
    qrMock.mockResolvedValue('data:image/png;base64,qr')
    routerMock.push.mockReset()
    subscribeMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('loads independent cockpit data in parallel without a duplicate session request', async () => {
    render(<SessionDetailPage />)

    expect(apiMock.getSession).toHaveBeenCalledTimes(1)
    expect(apiMock.getAttendanceRecords).toHaveBeenCalledTimes(1)
    expect(apiMock.getProofsOfClass).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()
    expect(apiMock.getSection).toHaveBeenCalledWith('section-1')
    expect(apiMock.getSectionStudents).toHaveBeenCalledWith('section-1')
  })

  it('shows initialization failure and successfully retries', async () => {
    apiMock.getSession.mockRejectedValueOnce(new Error('Backend unavailable'))

    render(<SessionDetailPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The session cockpit couldn’t load')
    expect(alert).toHaveTextContent('Backend unavailable')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()
    expect(apiMock.getSession).toHaveBeenCalledTimes(2)
  })

  it('keeps stale data visible, reports refresh failure, and does not regenerate an unchanged QR', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T08:00:00.000Z'))
    render(<SessionDetailPage />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()
    expect(qrMock).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(5_000) })
    expect(screen.getAllByText('Updated 5s ago').length).toBeGreaterThan(0)

    apiMock.getSession.mockRejectedValueOnce(new Error('Refresh timed out'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh session data' }))
    await act(async () => { await Promise.resolve() })

    expect(screen.getByRole('alert')).toHaveTextContent('Refresh timed out')
    expect(screen.getByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()
    expect(qrMock).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(5_000) })
    expect(screen.getAllByText('Updated 10s ago').length).toBeGreaterThan(0)
  })

  it('does not start another poll while a refresh is still in flight', async () => {
    vi.useFakeTimers()
    apiMock.getSession.mockResolvedValue({ ...session, isActive: true })
    render(<SessionDetailPage />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()

    let resolveRefresh: (value: Session) => void = () => undefined
    apiMock.getSession.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve }))
    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(apiMock.getSession).toHaveBeenCalledTimes(2)

    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(apiMock.getSession).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveRefresh({ ...session, isActive: true })
      await Promise.resolve()
    })
    expect(screen.queryByText('Session data could not be refreshed.')).not.toBeInTheDocument()
  })

  it('does not let a pre-generation refresh overwrite the authoritative activation response', async () => {
    const inactiveSession = { ...session, qrToken: undefined }
    apiMock.getSession.mockResolvedValueOnce(inactiveSession)
    apiMock.generateQrCode.mockResolvedValue({ ...inactiveSession, isActive: true, qrToken: 'authoritative-token' })
    render(<SessionDetailPage />)
    expect(await screen.findByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()

    let resolveStaleRead: (value: Session) => void = () => undefined
    let resolveTrailingRead: (value: Session) => void = () => undefined
    apiMock.getSession
      .mockReturnValueOnce(new Promise((resolve) => { resolveStaleRead = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveTrailingRead = resolve }))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh session data' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate QR Code/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Generate$/ }))

    expect(await screen.findByText('Active')).toBeInTheDocument()
    await act(async () => {
      resolveStaleRead(inactiveSession)
      await Promise.resolve()
    })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(apiMock.getSession).toHaveBeenCalledTimes(3)

    await act(async () => {
      resolveTrailingRead({ ...inactiveSession, isActive: true, qrToken: 'authoritative-token' })
      await Promise.resolve()
    })
  })

  it('does not let a pre-end refresh reactivate an authoritatively ended session', async () => {
    apiMock.getSession.mockResolvedValueOnce({ ...session, isActive: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SessionDetailPage />)
    expect(await screen.findByText('Active')).toBeInTheDocument()

    let resolveStaleRead: (value: Session) => void = () => undefined
    let resolveTrailingRead: (value: Session) => void = () => undefined
    apiMock.getSession
      .mockReturnValueOnce(new Promise((resolve) => { resolveStaleRead = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveTrailingRead = resolve }))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh session data' }))
    fireEvent.click(screen.getByRole('button', { name: /End Session/i }))
    expect(await screen.findByText('Inactive')).toBeInTheDocument()

    await act(async () => {
      resolveStaleRead({ ...session, isActive: true })
      await Promise.resolve()
    })

    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /End Session/i })).not.toBeInTheDocument()

    await act(async () => {
      resolveTrailingRead({ ...session, isActive: false, endedAt: '2026-08-06T10:00:00.000Z' })
      await Promise.resolve()
    })
  })

  it('reconciles an activation applied by the server when its response is lost', async () => {
    const inactiveSession = { ...session, isActive: false, qrToken: undefined }
    const serverActivated = { ...inactiveSession, isActive: true, qrToken: 'server-token' }
    apiMock.getSession.mockResolvedValueOnce(inactiveSession)
    apiMock.generateQrCode.mockRejectedValueOnce(new Error('Request timed out'))

    render(<SessionDetailPage />)
    expect(await screen.findByRole('heading', { name: 'Software Engineering' })).toBeInTheDocument()
    apiMock.getSession.mockResolvedValue(serverActivated)

    fireEvent.click(screen.getByRole('button', { name: /Generate QR Code/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Generate$/ }))

    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(apiMock.getSession).toHaveBeenCalledTimes(2)
    expect(addNotificationMock).toHaveBeenCalledWith('error', 'QR Generation Failed', 'Request timed out')
  })

  it('reconciles a server-ended session when the end response is lost', async () => {
    const activeSession = { ...session, isActive: true }
    const serverEnded = { ...activeSession, isActive: false, endedAt: '2026-08-06T10:00:00.000Z' }
    apiMock.getSession.mockResolvedValueOnce(activeSession)
    apiMock.endSession.mockRejectedValueOnce(new Error('Network unavailable'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SessionDetailPage />)
    expect(await screen.findByText('Active')).toBeInTheDocument()
    apiMock.getSession.mockResolvedValue(serverEnded)

    fireEvent.click(screen.getByRole('button', { name: /End Session/i }))

    expect(await screen.findByText('Inactive')).toBeInTheDocument()
    expect(apiMock.getSession).toHaveBeenCalledTimes(2)
    expect(addNotificationMock).toHaveBeenCalledWith('error', 'Could Not End Session', 'Network unavailable')
  })

  it('opens student detail modal on roster row click without instantly overwriting status and allows setting status', async () => {
    const student = {
      id: 'student-1',
      fullName: 'Alexandra Marie Reyes',
      studentId: '2024-00001-MN-0',
      role: 'student' as const,
      isActive: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      program: 'BSIT',
      yearLevel: 3,
    }
    apiMock.getSectionStudents.mockResolvedValue([student])
    apiMock.getAttendanceRecords.mockResolvedValue([])

    render(<SessionDetailPage />)

    // Wait for student roster to render
    expect(await screen.findByText('Alexandra Marie Reyes')).toBeInTheDocument()
    expect(screen.getByText('2024-00001-MN-0')).toBeInTheDocument()

    // Clicking the student row should NOT call updateAttendanceStatus or addAttendanceRecord
    fireEvent.click(screen.getByText('Alexandra Marie Reyes'))

    expect(apiMock.updateAttendanceStatus).not.toHaveBeenCalled()
    expect(apiMock.addAttendanceRecord).not.toHaveBeenCalled()

    // It should open the profile & attendance control modal
    expect(await screen.findByText('Student Profile & Session Attendance Control')).toBeInTheDocument()
    expect(screen.getByText('Current Session Status')).toBeInTheDocument()
    expect(screen.getByText('Administrative Controls')).toBeInTheDocument()
    expect(screen.getByText('Click card to flip')).toBeInTheDocument()

    // Selecting a status inside the modal explicitly updates attendance
    const presentButton = screen.getByRole('button', { name: /^present$/i })
    fireEvent.click(presentButton)

    expect(apiMock.addAttendanceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        sessionId: 'session-1',
        status: 'present',
        manuallySet: true,
      }),
    )
  })
})
