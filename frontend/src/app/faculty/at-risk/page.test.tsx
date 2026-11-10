import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AtRiskReferral, StudentAtRisk, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAtRiskStudents: vi.fn(),
  getAtRiskReferrals: vi.fn(),
  generateAtRiskReferral: vi.fn(),
  updateAtRiskReferral: vi.fn(),
  downloadAssistantFile: vi.fn(),
  logout: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))

import AtRiskStudentsPage from './page'
import { NotificationProvider } from '@/lib/notifications'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 't-001',
    fullName: 'Prof. Elena Garcia',
    role: 'teacher',
    department: 'CCIS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeRow(overrides: Partial<StudentAtRisk> = {}): StudentAtRisk {
  return {
    studentId: 's-001',
    studentName: 'Ana Reyes',
    studentNumber: '2026-01234',
    sectionId: 'sec-001',
    sectionName: 'IT 101 · Section A',
    subjectName: 'Introduction to Computing',
    professorName: 'Prof. Juan Dela Cruz',
    thresholdPercent: 75,
    attendanceRate: 68,
    status: 'below_threshold',
    absencesBeforeBelowThreshold: 0,
    lastAbsenceDate: '2026-07-01',
    ...overrides,
  }
}

function makeReferral(overrides: Partial<AtRiskReferral> = {}): AtRiskReferral {
  return {
    id: 'ref-1',
    studentId: 's-001',
    studentName: 'Ana Reyes',
    studentNumber: '2026-01234',
    sectionId: 'sec-001',
    sectionName: 'IT 101 · Section A',
    subjectName: 'Introduction to Computing',
    professorName: 'Prof. Juan Dela Cruz',
    generatedById: 't-001',
    generatedByName: 'Prof. Elena Garcia',
    status: 'generated',
    createdAt: '2026-07-05T08:00:00.000Z',
    updatedAt: '2026-07-05T08:00:00.000Z',
    ...overrides,
  }
}

const departmentHead = makeUser({ id: 't-001', isDepartmentHead: true })
const oversightAdmin = makeUser({ id: 'sa-1', role: 'super_admin' })
const plainTeacher = makeUser({ id: 't-002' })
const studentUser = makeUser({ id: 's-001', role: 'student' })

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  apiMock.getAtRiskStudents.mockResolvedValue([])
  apiMock.getAtRiskReferrals.mockResolvedValue([])
})

afterEach(cleanup)

describe('At-risk oversight page (F5 integration)', () => {
  it('bounces non-faculty users (teachers are allowed — backend scopes them to their own sections)', async () => {
    apiMock.getCurrentUser.mockReturnValue(studentUser)

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/faculty'))
    expect(apiMock.getAtRiskStudents).not.toHaveBeenCalled()
  })

  it('lets plain teachers in (backend scopes the data to their own sections)', async () => {
    apiMock.getCurrentUser.mockReturnValue(plainTeacher)

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    await waitFor(() => expect(apiMock.getAtRiskStudents).toHaveBeenCalled())
    expect(routerMock.replace).not.toHaveBeenCalledWith('/faculty')
  })

  it('renders the oversight list with status pills and the referral tab shell for heads', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents.mockResolvedValue([
      makeRow(),
      makeRow({
        studentId: 's-002',
        studentName: 'Ben Ocampo',
        status: 'below_threshold',
        absencesBeforeBelowThreshold: 1,
      }),
      makeRow({ studentId: 's-003', studentName: 'Carla Lim', status: 'on_track', attendanceRate: 89 }),
    ])

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    // Mobile stack + desktop table each render the roster.
    expect((await screen.findAllByText('Ana Reyes')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ben Ocampo')).toHaveLength(2)
    expect(screen.getAllByText('Carla Lim')).toHaveLength(2)

    const referralsTab = screen.getByRole('tab', { name: 'Referrals' })
    const listTab = screen.getByRole('tab', { name: 'Oversight list' })
    expect(listTab).toHaveAttribute('aria-selected', 'true')

    apiMock.getAtRiskReferrals.mockResolvedValue([makeReferral()])
    fireEvent.click(referralsTab)

    expect(await screen.findByText('Loading referrals…')).toBeInTheDocument()
    await waitFor(() => expect(apiMock.getAtRiskReferrals).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('tab', { name: 'Referrals' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(listTab)
    await waitFor(() => expect(screen.getAllByText('Ben Ocampo')).toHaveLength(2))
  })

  it('offers the CHED notice action only on eligible rows and flags the threshold trigger', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents.mockResolvedValue([
      makeRow(), // below_threshold, threshold reached
      makeRow({
        studentId: 's-002',
        studentName: 'Ben Ocampo',
        status: 'on_track',
        attendanceRate: 89,
        absencesBeforeBelowThreshold: null,
        lastAbsenceDate: undefined,
      }),
    ])

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    await screen.findAllByText('Ana Reyes')

    // Mobile + desktop layouts each render one action for the eligible row.
    expect(screen.getAllByRole('button', { name: /Issue CHED notice/i })).toHaveLength(2)
    expect(screen.getAllByTestId('impending-drop')).toHaveLength(2)
    // The on-track row has no CHED action anywhere.
    expect(
      screen.queryByRole('button', { name: 'Issue CHED notice for Ben Ocampo' }),
    ).not.toBeInTheDocument()
  })

  it('issues a CHED notice with the optional note and downloads the generated slip', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents.mockResolvedValue([makeRow()])
    apiMock.generateAtRiskReferral.mockResolvedValue(makeReferral({ id: 'ref-42' }))
    apiMock.downloadAssistantFile.mockResolvedValue(new Blob(['%PDF-fake']))

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Issue CHED notice/i }))[0],
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    await screen.findByLabelText(/Note/)

    const noteField = screen.getByLabelText(/Note/)
    expect(noteField).toHaveAttribute('maxLength', '500')
    fireEvent.change(noteField, {
      target: { value: 'Fourth consecutive absence verified against the class record.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Generate notice/i }))

    await waitFor(() =>
      expect(apiMock.generateAtRiskReferral).toHaveBeenCalledWith({
        studentId: 's-001',
        sectionId: 'sec-001',
        note: 'Fourth consecutive absence verified against the class record.',
      }),
    )
    expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
      '/docs/at-risk-notice/ref-42?format=pdf',
    )
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(
      await screen.findByText('The notice of impending drop for Ana Reyes was generated and downloaded.'),
    ).toBeInTheDocument()

    // The oversight list is refreshed after the referral is created.
    await waitFor(() => expect(apiMock.getAtRiskStudents).toHaveBeenCalledTimes(2))
  })

  it('surfaces typed referral errors inline in the confirm dialog', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents.mockResolvedValue([makeRow()])
    apiMock.generateAtRiskReferral.mockRejectedValue(
      Object.assign(new Error('Conflict'), { code: 'referral_active' }),
    )

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Issue CHED notice/i }))[0],
    )
    fireEvent.click(await screen.findByRole('button', { name: /Generate notice/i }))

    expect(
      await screen.findByText('An active CHED referral already exists for this student in this section.'),
    ).toBeInTheDocument()
    // The dialog stays open so the oversight actor can correct the note.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Generate notice/i })).toBeEnabled(),
    )
    expect(apiMock.downloadAssistantFile).not.toHaveBeenCalled()
  })

  it('surfaces the student_not_at_risk typed error inline', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents.mockResolvedValue([makeRow()])
    apiMock.generateAtRiskReferral.mockRejectedValue(
      Object.assign(new Error('Unprocessable'), { code: 'student_not_at_risk' }),
    )

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Issue CHED notice/i }))[0],
    )
    fireEvent.click(await screen.findByRole('button', { name: /Generate notice/i }))

    expect(
      await screen.findByText(
        'This student is no longer flagged as at risk — refresh the list before issuing another notice.',
      ),
    ).toBeInTheDocument()
  })

  it('supports super admins issuing notices too', async () => {
    apiMock.getCurrentUser.mockReturnValue(oversightAdmin)
    apiMock.getAtRiskStudents.mockResolvedValue([makeRow()])
    apiMock.generateAtRiskReferral.mockResolvedValue(makeReferral({ id: 'ref-77' }))

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Issue CHED notice/i }))[0],
    )
    fireEvent.click(await screen.findByRole('button', { name: /Generate notice/i }))

    await waitFor(() => expect(apiMock.generateAtRiskReferral).toHaveBeenCalled())
    expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
      '/docs/at-risk-notice/ref-77?format=pdf',
    )
  })

  it('renders the error banner for the oversight list and refreshes manually', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentHead)
    apiMock.getAtRiskStudents
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce([makeRow()])

    render(
      <NotificationProvider>
        <AtRiskStudentsPage />
      </NotificationProvider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => expect(apiMock.getAtRiskStudents).toHaveBeenCalledTimes(2))
    expect((await screen.findAllByText('Ana Reyes')).length).toBe(2)
  })
})
