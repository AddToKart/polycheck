import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// The import dialog's first render is heavy; keep the suite stable on a busy 2-core machine.
vi.setConfig({ testTimeout: 20_000 })

const apiMock = vi.hoisted(() => ({
  importStudents: vi.fn(),
  getActivationStatus: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/notifications', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }))

import { BulkImportDialog } from './BulkImportDialog'

const CSV = [
  'Student Number,Full Name,Email,Program,Year Level',
  '2024-00001-MN-0,Alpha Student,alpha@example.com,BSIT,1',
  '2024-00002-MN-0,Beta Student,,BSIT,1',
].join('\n')

const CHECKSUM = 'abcdef0123456789'

const validateResult = (extra: Record<string, unknown> = {}) => ({
  mode: 'validate',
  conflictMode: 'skip_existing',
  rowChecksum: CHECKSUM,
  summary: { total: 2, valid: 2, new: 2, update: 0, skip: 0, invalid: 0 },
  issues: [],
  hasMoreIssues: false,
  ...extra,
})

function setup() {
  render(<BulkImportDialog open onOpenChange={() => undefined} mode="students" />)
}

async function uploadAndValidate() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([CSV], 'master-list.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Validate rows' }))
  await screen.findByText('Existing students')
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getActivationStatus.mockResolvedValue({ enabled: true, configured: true, driver: 'resend' })
  apiMock.importStudents.mockImplementation(async (request: { mode: string; deliveryMode?: string }) => {
    if (request.mode === 'validate') return validateResult()
    return {
      ...validateResult({ mode: 'execute' }),
      ...(request.deliveryMode === 'activation_email'
        ? { activation: { queued: 1, fallbackTemporary: 1 } }
        : {}),
      credentials: [{ rowNumber: 3, studentId: '2024-00002-MN-0', tempPassword: 'PUP-TEMP0001-xy!' }],
    }
  })
})

afterEach(cleanup)

describe('BulkImportDialog email delivery', () => {
  it('keeps temporary passwords as the default and never sends a delivery mode', async () => {
    setup()
    await uploadAndValidate()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Import now' }))

    await screen.findByText('Import finished')
    for (const [request] of apiMock.importStudents.mock.calls) {
      expect(request).not.toHaveProperty('deliveryMode')
    }
    expect(screen.queryByText(/activation email/i)).not.toBeInTheDocument()
    expect(screen.getByText('PUP-TEMP0001-xy!')).toBeInTheDocument()
  })

  it('offers the email option only when the server says it is enabled and configured', async () => {
    for (const status of [
      { enabled: false, configured: true, driver: 'resend' },
      { enabled: true, configured: false, driver: 'disabled' },
    ]) {
      cleanup()
      apiMock.getActivationStatus.mockResolvedValue(status)
      setup()
      await uploadAndValidate()
      await waitFor(() => expect(apiMock.getActivationStatus).toHaveBeenCalled())
      expect(screen.queryByText('How new students get access')).not.toBeInTheDocument()
    }
    cleanup()
    apiMock.getActivationStatus.mockRejectedValue(new Error('forbidden'))
    setup()
    await uploadAndValidate()
    expect(screen.queryByText('How new students get access')).not.toBeInTheDocument()
  })

  it('requires re-validation after switching to email delivery, then executes with the validated mode', async () => {
    setup()
    await uploadAndValidate()

    fireEvent.click(await screen.findByLabelText(/Email an activation link/))
    expect(screen.getByText(/Re-validate to apply the new delivery method/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Re-validate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    expect(apiMock.importStudents).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'validate', deliveryMode: 'activation_email' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/single-use activation link/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import now' }))

    await screen.findByText('Import finished')
    expect(apiMock.importStudents).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'execute', deliveryMode: 'activation_email', rowChecksum: CHECKSUM }),
    )
    // The report explains queued emails and the temp-password fallback.
    expect(screen.getByRole('status')).toHaveTextContent('1 activation email queued')
    expect(screen.getByRole('status')).toHaveTextContent('1 student without an email got a temporary password')
    expect(screen.getByText('PUP-TEMP0001-xy!')).toBeInTheDocument()
  })
})
