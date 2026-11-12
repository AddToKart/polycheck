import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord, DisputeReason, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSubjects: vi.fn(),
  getSections: vi.fn(),
  getSessions: vi.fn(),
  getDisputedRecords: vi.fn(),
  resolveDispute: vi.fn(),
}))

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock, requestUserLogout: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/faculty/disputes',
}))
vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}))
vi.mock('@/components/disputes/DisputeTimeline', () => ({
  DisputeTimeline: () => <div data-testid="timeline" />,
}))

import DisputesPage from './page'
import { NotificationProvider } from '@/lib/notifications'

const teacher: User = {
  id: 't-001',
  fullName: 'Prof. Test',
  role: 'teacher',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function dispute(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Ada Student',
    timestamp: '2026-11-10T08:00:00.000Z',
    status: 'disputed',
    coordinates: { latitude: null, longitude: null },
    isSynced: true,
    disputeReason: 'missing_scan_evidence',
    disputeResolved: false,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <NotificationProvider>
      <DisputesPage />
    </NotificationProvider>,
  )
}

async function expandGroups() {
  fireEvent.click(await screen.findByRole('button', { name: /Unknown Subject/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Unknown Section/ }))
}

describe('Disputes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getCurrentUser.mockReturnValue(teacher)
    apiMock.getSubjects.mockResolvedValue([])
    apiMock.getSections.mockResolvedValue([])
    apiMock.getSessions.mockResolvedValue([])
    apiMock.getDisputedRecords.mockResolvedValue([
      dispute({ id: 'rec-1', studentName: 'Ada Student', disputeReason: 'missing_scan_evidence' }),
      dispute({
        id: 'rec-2',
        studentName: 'Grace Future',
        disputeReason: 'quantum_anomaly' as DisputeReason,
        timestamp: '2026-11-10T08:05:00.000Z',
      }),
    ])
  })

  afterEach(cleanup)

  it('labels missing_scan_evidence and renders an unknown reason without crashing', async () => {
    renderPage()
    await expandGroups()

    expect(await screen.findByText('Missing Scan Evidence')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('Ada Student')).toBeInTheDocument()
    expect(screen.getByText('Grace Future')).toBeInTheDocument()
  })

  it('renders a retryable error state when the dispute load fails', async () => {
    apiMock.getDisputedRecords.mockRejectedValueOnce(new Error('Backend unavailable'))
    renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(await screen.findByRole('button', { name: /Unknown Subject/ })).toBeInTheDocument()
  })

  it('resolves a dispute once and never double-fires', async () => {
    const gate = Promise.withResolvers<AttendanceRecord>()
    apiMock.resolveDispute.mockReturnValue(gate.promise)
    renderPage()
    await expandGroups()

    fireEvent.click(await screen.findByRole('button', { name: /Review dispute from Ada Student/ }))
    const accept = await screen.findByRole('button', { name: /Accept — Keep as Present/ })
    fireEvent.click(accept)
    fireEvent.click(accept)

    expect(apiMock.resolveDispute).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(accept).toBeDisabled())

    gate.resolve(dispute({ disputeResolved: true, status: 'present' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Accept — Keep as Present/ })).not.toBeInTheDocument())
  })

  it('surfaces a resolve failure and keeps the dispute open', async () => {
    apiMock.resolveDispute.mockRejectedValue(new Error('Dispute already resolved'))
    renderPage()
    await expandGroups()

    fireEvent.click(await screen.findByRole('button', { name: /Review dispute from Ada Student/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Accept — Keep as Present/ }))

    expect(await screen.findByText('Could not resolve dispute')).toBeInTheDocument()
    expect(screen.getByText('Dispute already resolved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accept — Keep as Present/ })).toBeEnabled()
  })
})
