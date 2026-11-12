import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerVerifyResult, User } from '@polycheck/shared'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAuditLogs: vi.fn(),
  verifyLedger: vi.fn(),
}))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <div data-testid="sidebar" /> }))

import AuditLogsPage from './page'

const admin: User = {
  id: 'admin-1',
  fullName: 'Super Admin',
  email: 'admin@pup.edu.ph',
  role: 'super_admin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }

const verifiedResult: LedgerVerifyResult = {
  status: 'verified',
  verified: true,
  recordsChecked: 1204,
  sessionsChecked: 42,
  unhashedRecords: 0,
  lastAnchorDate: '2026-11-01',
}

const brokenResult: LedgerVerifyResult = {
  status: 'broken',
  verified: false,
  recordsChecked: 300,
  sessionsChecked: 9,
  unhashedRecords: 0,
  brokenAt: { sessionId: 'sess-9', recordId: 'rec-77', reason: 'hash_mismatch' },
}

const unanchoredResult: LedgerVerifyResult = {
  status: 'insufficient_data',
  verified: false,
  recordsChecked: 0,
  sessionsChecked: 0,
  unhashedRecords: 16,
}

describe('Ledger integrity verify (audit logs)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getAuditLogs.mockResolvedValue(emptyPage)
  })

  afterEach(cleanup)

  it('renders the Verify Ledger Integrity button next to Refresh without touching the audit table', async () => {
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    expect(screen.getByRole('button', { name: /verify ledger integrity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^refresh/i })).toBeInTheDocument()
    expect(screen.queryByTestId('ledger-verify-result')).not.toBeInTheDocument()
    expect(apiMock.verifyLedger).not.toHaveBeenCalled()
    expect(apiMock.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
    )
  })

  it('shows a scanning state while verifying, then an emerald verified banner with counts and last anchor', async () => {
    let resolveVerify!: (result: LedgerVerifyResult) => void
    apiMock.verifyLedger.mockImplementation(
      () => new Promise<LedgerVerifyResult>((resolve) => { resolveVerify = resolve }),
    )
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    fireEvent.click(screen.getByRole('button', { name: /verify ledger integrity/i }))

    const scanning = await screen.findByRole('button', { name: /scanning/i })
    expect(scanning).toBeDisabled()

    resolveVerify(verifiedResult)
    const banner = await screen.findByTestId('ledger-verify-result')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveTextContent('✓ Ledger intact — 1,204 records across 42 sessions verified')
    expect(banner).toHaveTextContent('Last anchor: 2026-11-01')
    expect(banner.className).toContain('emerald')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /verify ledger integrity/i })).toBeEnabled(),
    )
  })

  it('reports a broken chain with the record, session, and shared reason copy', async () => {
    apiMock.verifyLedger.mockResolvedValue(brokenResult)
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    fireEvent.click(screen.getByRole('button', { name: /verify ledger integrity/i }))

    const banner = await screen.findByTestId('ledger-verify-result')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveTextContent('✗ Chain broken at rec-77 — investigate session sess-9')
    expect(banner).toHaveTextContent('stored hash no longer recomputes (row altered or removed)')
    expect(banner.className).toContain('red')
    expect(banner.className).not.toContain('emerald')
  })

  it('warns instead of claiming integrity when every row is off-chain', async () => {
    apiMock.verifyLedger.mockResolvedValue(unanchoredResult)
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    fireEvent.click(screen.getByRole('button', { name: /verify ledger integrity/i }))

    const banner = await screen.findByTestId('ledger-verify-result')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveTextContent('⚠ Ledger not anchored — 16 records have no chain entry')
    expect(banner).toHaveTextContent(/run the ledger backfill/i)
    expect(banner).not.toHaveTextContent('✓ Ledger intact')
    expect(banner.className).toContain('amber')
    expect(banner.className).not.toContain('emerald')
    expect(banner.className).not.toContain('red')
  })

  it('shows a retryable alert when verification fails', async () => {
    apiMock.verifyLedger.mockRejectedValueOnce(new Error('ledger verify timed out'))
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    fireEvent.click(screen.getByRole('button', { name: /verify ledger integrity/i }))

    const alertBox = await screen.findByRole('alert')
    expect(alertBox).toHaveTextContent('ledger verify timed out')
    expect(screen.queryByTestId('ledger-verify-result')).not.toBeInTheDocument()

    apiMock.verifyLedger.mockResolvedValueOnce(verifiedResult)
    fireEvent.click(screen.getByRole('button', { name: /retry verification/i }))

    const banner = await screen.findByTestId('ledger-verify-result')
    expect(banner).toHaveTextContent('✓ Ledger intact')
    expect(apiMock.verifyLedger).toHaveBeenCalledTimes(2)
  })

  it('does not refetch the audit log while verifying — the table stays untouched', async () => {
    let resolveVerify!: (result: LedgerVerifyResult) => void
    apiMock.verifyLedger.mockImplementation(
      () => new Promise<LedgerVerifyResult>((resolve) => { resolveVerify = resolve }),
    )
    render(<AuditLogsPage />)

    await screen.findByText('No audited changes match these filters.')
    const logCallsBefore = apiMock.getAuditLogs.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: /verify ledger integrity/i }))
    resolveVerify(verifiedResult)
    await screen.findByTestId('ledger-verify-result')

    expect(apiMock.getAuditLogs).toHaveBeenCalledTimes(logCallsBefore)
    expect(screen.getByText('No audited changes match these filters.')).toBeInTheDocument()
  })
})
