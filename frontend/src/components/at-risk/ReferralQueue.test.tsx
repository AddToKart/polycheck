import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AtRiskReferral, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getAtRiskReferrals: vi.fn(),
  updateAtRiskReferral: vi.fn(),
  downloadAssistantFile: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

import { ReferralQueue, chedNoticeDownloadPath } from './ReferralQueue'
import { NotificationProvider } from '@/lib/notifications'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 't-100',
    fullName: 'Prof. Maria Santos',
    role: 'teacher',
    department: 'CCIS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    generatedById: 't-100',
    generatedByName: 'Prof. Maria Santos',
    status: 'generated',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
    ...overrides,
  }
}

function makeBlob(): Blob {
  return new Blob(['%PDF-fake'])
}

beforeAll(() => {
  // jsdom cannot create blob URLs or navigate; the download helper only needs
  // createObjectURL to have been invoked with the produced blob.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = () => {}
})

function renderQueue(user: User, refreshKey?: number) {
  return render(
    <NotificationProvider>
      <ReferralQueue user={user} refreshKey={refreshKey} />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  apiMock.getAtRiskReferrals.mockResolvedValue([])
})

afterEach(cleanup)

describe('ReferralQueue', () => {
  const departmentHead = makeUser({ id: 't-101', isDepartmentHead: true })
  const superAdmin = makeUser({ id: 'sa-1', role: 'super_admin' })
  const plainTeacher = makeUser({ id: 't-102' })

  it('shows the empty state when there are no referrals', async () => {
    renderQueue(departmentHead)

    expect(await screen.findByText('No CHED referrals yet')).toBeInTheDocument()
  })

  it('groups referrals by status with the shared labels and renders each once', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ id: 'ref-a', studentName: 'Carla Lim', status: 'counseling_scheduled' }),
      makeReferral({ id: 'ref-b', studentName: 'Dan Flores', status: 'resolved' }),
      makeReferral({ id: 'ref-c', studentName: 'Ana Reyes', status: 'generated' }),
      makeReferral({ id: 'ref-d', studentName: 'Ben Ocampo', status: 'acknowledged' }),
    ])

    renderQueue(departmentHead)

    await screen.findByText('Ana Reyes')

    expect(screen.getAllByText('Generated')).toHaveLength(2) // group pill + row pill
    expect(screen.getAllByText('Acknowledged')).toHaveLength(2)
    expect(screen.getAllByText('Counseling scheduled')).toHaveLength(2)
    expect(screen.getAllByText('Resolved')).toHaveLength(2)

    // Each referral is rendered exactly once (grouped, not duplicated).
    expect(screen.getAllByText('Ana Reyes')).toHaveLength(1)
    expect(screen.getAllByText('Ben Ocampo')).toHaveLength(1)
    expect(screen.getAllByText('Carla Lim')).toHaveLength(1)
    expect(screen.getAllByText('Dan Flores')).toHaveLength(1)
  })

  it('lets heads move a referral through transitions and refreshes the row', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ id: 'ref-1', status: 'generated' }),
    ])
    apiMock.updateAtRiskReferral.mockResolvedValue(
      makeReferral({ id: 'ref-1', status: 'acknowledged' }),
    )

    renderQueue(departmentHead)

    fireEvent.click(await screen.findByRole('button', { name: /acknowledge/i }))

    await waitFor(() =>
      expect(apiMock.updateAtRiskReferral).toHaveBeenCalledWith('ref-1', {
        status: 'acknowledged',
      }),
    )
    expect(
      await screen.findByText(/Ana Reyes's referral is now Acknowledged/i),
    ).toBeInTheDocument()
  })

  it('offers triage transitions to super admins', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ status: 'generated' }),
    ])

    renderQueue(superAdmin)

    await screen.findByText('Ana Reyes')
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /schedule counseling/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark resolved/i })).toBeInTheDocument()
  })

  it('keeps plain-teacher viewers read-only', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ status: 'generated' }),
    ])

    renderQueue(plainTeacher)

    await screen.findByText('Ana Reyes')
    expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /schedule counseling/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark resolved/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download CHED notice/i })).toBeInTheDocument()
  })

  it('excludes the current status from the transition options', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ id: 'ref-1', status: 'resolved' }),
    ])

    renderQueue(departmentHead)

    await screen.findByText('Ana Reyes')
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /schedule counseling/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark resolved/i })).not.toBeInTheDocument()
  })

  it('surfaces transition failures as an error toast', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ status: 'generated' }),
    ])
    apiMock.updateAtRiskReferral.mockRejectedValue(new Error('Referral already resolved'))

    renderQueue(departmentHead)

    fireEvent.click(await screen.findByRole('button', { name: /acknowledge/i }))

    expect(await screen.findByText('Referral update failed')).toBeInTheDocument()
    expect(screen.getByText('Referral already resolved')).toBeInTheDocument()
  })

  it('re-downloads the CHED notice through the authenticated docs path', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([makeReferral({ id: 'ref-9' })])
    apiMock.downloadAssistantFile.mockResolvedValue(makeBlob())

    renderQueue(plainTeacher)

    fireEvent.click(await screen.findByRole('button', { name: /download CHED notice/i }))

    await waitFor(() =>
      expect(apiMock.downloadAssistantFile).toHaveBeenCalledWith(
        chedNoticeDownloadPath('ref-9'),
      ),
    )
    expect(chedNoticeDownloadPath('ref-9')).toBe('/docs/at-risk-notice/ref-9?format=pdf')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(await screen.findByText('Notice downloaded')).toBeInTheDocument()
  })

  it('surfaces download failures as an error toast', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([makeReferral({ id: 'ref-9' })])
    apiMock.downloadAssistantFile.mockRejectedValue(new Error('Document unavailable'))

    renderQueue(plainTeacher)

    fireEvent.click(await screen.findByRole('button', { name: /download CHED notice/i }))

    expect(await screen.findByText('Download failed')).toBeInTheDocument()
    expect(screen.getByText('Document unavailable')).toBeInTheDocument()
  })

  it('disables the other row actions while a transition is in flight', async () => {
    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ status: 'generated' }),
    ])
    let resolveUpdate: (value: AtRiskReferral) => void = () => {}
    apiMock.updateAtRiskReferral.mockReturnValue(
      new Promise<AtRiskReferral>((resolve) => {
        resolveUpdate = resolve
      }),
    )

    renderQueue(departmentHead)

    fireEvent.click(await screen.findByRole('button', { name: /acknowledge/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /schedule counseling/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /mark resolved/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /download CHED notice/i })).toBeDisabled()
    })
    resolveUpdate(makeReferral({ status: 'acknowledged' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download CHED notice/i })).toBeEnabled(),
    )
  })

  it('renders an error state with retry that reloads the queue', async () => {
    apiMock.getAtRiskReferrals
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce([makeReferral({ status: 'generated' })])

    renderQueue(departmentHead)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(apiMock.getAtRiskReferrals).toHaveBeenCalledTimes(2),
    )
    expect(await screen.findByText('Ana Reyes')).toBeInTheDocument()
  })

  it('re-fetches when refreshKey changes', async () => {
    const firstRender = renderQueue(departmentHead, 0)
    await screen.findByText('No CHED referrals yet')

    apiMock.getAtRiskReferrals.mockResolvedValue([
      makeReferral({ id: 'ref-refetched' }),
    ])
    firstRender.rerender(
      <NotificationProvider>
        <ReferralQueue user={departmentHead} refreshKey={1} />
      </NotificationProvider>,
    )

    await waitFor(() =>
      expect(apiMock.getAtRiskReferrals).toHaveBeenCalledTimes(2),
    )
    expect(await screen.findByText('Ana Reyes')).toBeInTheDocument()
  })
})
