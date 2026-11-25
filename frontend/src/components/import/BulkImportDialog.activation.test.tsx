import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// The import dialog's first render is heavy; keep the suite stable on a busy 2-core machine.
vi.setConfig({ testTimeout: 20_000 })

const apiMock = vi.hoisted(() => ({
  importStudents: vi.fn(),
  getActivationStatus: vi.fn(),
  previewEnrollImport: vi.fn(),
  getImportMappingProfile: vi.fn(),
  saveImportMappingProfile: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('@/lib/notifications', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }))

import { BulkImportDialog } from './BulkImportDialog'
import { buildXlsx, xlsxFile } from '@/lib/import/xlsx-fixture'

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

describe('BulkImportDialog Excel upload', () => {
  const HEADER = ['Student No.', 'Name', 'Email', 'Program', 'Year Level']
  const upload = (file: File) => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('reads an .xlsx workbook, skips the title block and maps the columns automatically', async () => {
    setup()
    upload(
      xlsxFile(
        buildXlsx([
          {
            name: 'BSIT 1-1',
            rows: [
              ['PUP Santa Maria'],
              ['Master List'],
              [],
              HEADER,
              ['2024-00001-MN-0', 'Alpha Student', 'alpha@example.com', 'BSIT', 1],
              ['2024-00002-MN-0', 'Beta Student', null, 'BSIT', 1],
            ],
          },
        ]),
      ),
    )

    expect(await screen.findByLabelText(/Student number/)).toHaveValue('0')
    expect(screen.getByLabelText(/Full name/)).toHaveValue('1')
    expect(screen.queryByLabelText('Sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }))
    await screen.findByText('Existing students')
    expect(apiMock.importStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'validate',
        rows: [
          expect.objectContaining({ studentId: '2024-00001-MN-0', fullName: 'Alpha Student', email: 'alpha@example.com' }),
          expect.objectContaining({ studentId: '2024-00002-MN-0', fullName: 'Beta Student' }),
        ],
      }),
    )
  })

  it('lets the admin choose a sheet when the workbook has several', async () => {
    setup()
    upload(
      xlsxFile(
        buildXlsx([
          { name: 'Cover', rows: [] },
          { name: 'BSIT 1-1', rows: [HEADER, ['2024-00001-MN-0', 'Alpha Student', 'a@example.com', 'BSIT', 1]] },
          {
            name: 'BSHM 1-1',
            rows: [
              HEADER,
              ['2024-00007-MN-0', 'Gamma Student', 'g@example.com', 'BSHM', 2],
              ['2024-00008-MN-0', 'Delta Student', 'd@example.com', 'BSHM', 2],
            ],
          },
        ]),
      ),
    )

    const picker = (await screen.findByLabelText('Sheet')) as HTMLSelectElement
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      'BSIT 1-1 (1 rows)',
      'BSHM 1-1 (2 rows)',
    ])
    fireEvent.change(picker, { target: { value: 'BSHM 1-1' } })
    await waitFor(() => expect((screen.getByLabelText('Sheet') as HTMLSelectElement).value).toBe('BSHM 1-1'))

    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }))
    await screen.findByText('Existing students')
    expect(apiMock.importStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({ studentId: '2024-00007-MN-0' }),
          expect.objectContaining({ studentId: '2024-00008-MN-0' }),
        ],
      }),
    )
  })

  it('explains legacy .xls, fake .xlsx and fake PDF uploads instead of failing silently', async () => {
    setup()
    upload(new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0])], 'old.xls'))
    expect(await screen.findByText(/old \.xls file/i)).toBeInTheDocument()

    upload(new File(['Student No.,Name'], 'renamed.xlsx'))
    expect(await screen.findByText(/not a valid Excel/i)).toBeInTheDocument()

    upload(new File(['Student No.,Name'], 'master.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/not a valid PDF/i)).toBeInTheDocument()
  })

  it('remembers a confirmed layout and maps it automatically next time', async () => {
    setup()
    const reordered = ['Name', 'Student No.', 'Email', 'Program', 'Year Level']
    upload(xlsxFile(buildXlsx([{ name: 'S', rows: [reordered, ['Alpha Student', '2024-00001-MN-0', 'a@example.com', 'BSIT', 1]] }])))
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }))
    await screen.findByText('Existing students')
    cleanup()

    setup()
    upload(xlsxFile(buildXlsx([{ name: 'S', rows: [reordered, ['Beta Student', '2024-00002-MN-0', 'b@example.com', 'BSIT', 1]] }])))
    expect(await screen.findByLabelText(/Student number/)).toHaveValue('1')
    expect(screen.getByLabelText(/Full name/)).toHaveValue('0')
  })
})

describe('BulkImportDialog roster enrollment hand-off', () => {
  it('tells a teacher how many students still need accounts and who creates them', async () => {
    const issue = (rowNumber: number) => ({
      rowNumber,
      column: 'studentId',
      code: 'STUDENT_NOT_FOUND',
      message: 'No Polycheck account exists for this student number yet.',
    })
    apiMock.previewEnrollImport.mockResolvedValue({
      mode: 'validate',
      rowChecksum: CHECKSUM,
      summary: { total: 2, valid: 0, enrollable: 0, alreadyEnrolled: 0, notFound: 2, invalid: 2 },
      issues: [issue(2), issue(3)],
      hasMoreIssues: false,
    })
    render(<BulkImportDialog open onOpenChange={() => undefined} mode="enrollments" sectionId="sec-1" />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([CSV], 'roster.csv', { type: 'text/csv' })] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Validate rows' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('2 students have no Polycheck account yet')
    expect(notice).toHaveTextContent(/registrar/i)
    expect(notice).toHaveTextContent(/already enrolled are skipped/i)
  })

  it('shows nothing extra when every student already has an account', async () => {
    apiMock.previewEnrollImport.mockResolvedValue({
      mode: 'validate',
      rowChecksum: CHECKSUM,
      summary: { total: 2, valid: 2, enrollable: 2, alreadyEnrolled: 0, notFound: 0, invalid: 0 },
      issues: [],
      hasMoreIssues: false,
    })
    render(<BulkImportDialog open onOpenChange={() => undefined} mode="enrollments" sectionId="sec-1" />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([CSV], 'roster.csv', { type: 'text/csv' })] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Validate rows' }))
    await waitFor(() => expect(apiMock.previewEnrollImport).toHaveBeenCalled())
    expect(screen.queryByText(/have no Polycheck account yet/)).not.toBeInTheDocument()
  })
})

describe('BulkImportDialog shared mapping profiles', () => {
  const REORDERED = ['Name', 'Student No.', 'Email', 'Program', 'Year Level']
  const upload = () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: {
        files: [
          xlsxFile(buildXlsx([{ name: 'S', rows: [REORDERED, ['Alpha Student', '2024-00001-MN-0', 'a@example.com', 'BSIT', 1]] }])),
        ],
      },
    })
  }

  beforeEach(() => {
    window.localStorage.clear()
    apiMock.getImportMappingProfile.mockResolvedValue({ mapping: null })
    apiMock.saveImportMappingProfile.mockResolvedValue({ saved: true })
  })

  it('uses a mapping another administrator confirmed when this browser has none', async () => {
    apiMock.getImportMappingProfile.mockResolvedValue({ mapping: { studentId: 3, fullName: 0 } })
    setup()
    upload()

    // The shared profile wins over the heuristic suggestion (which would pick column 1 for the student number).
    expect(await screen.findByLabelText(/Student number/)).toHaveValue('3')
    expect(screen.getByLabelText(/Full name/)).toHaveValue('0')
    expect(apiMock.getImportMappingProfile).toHaveBeenCalledWith('students', expect.stringContaining('student no'))
  })

  it('prefers this browser’s own memory and never asks the server in that case', async () => {
    setup()
    upload()
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }))
    await screen.findByText('Existing students')
    cleanup()
    apiMock.getImportMappingProfile.mockClear()

    setup()
    upload()
    expect(await screen.findByLabelText(/Student number/)).toHaveValue('1')
    expect(apiMock.getImportMappingProfile).not.toHaveBeenCalled()
  })

  it('falls back to the suggestion when the shared lookup fails', async () => {
    apiMock.getImportMappingProfile.mockRejectedValue(new Error('offline'))
    setup()
    upload()
    expect(await screen.findByLabelText(/Student number/)).toHaveValue('1')
  })

  it('shares a confirmed mapping after validation, and an unavailable server never blocks the import', async () => {
    apiMock.saveImportMappingProfile.mockRejectedValue(new Error('403'))
    setup()
    upload()
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }))

    await screen.findByText('Existing students')
    await waitFor(() => expect(apiMock.saveImportMappingProfile).toHaveBeenCalledTimes(1))
    expect(apiMock.saveImportMappingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'students',
        headers: REORDERED,
        mapping: expect.objectContaining({ studentId: 1, fullName: 0 }),
      }),
    )
    // Headers and positions only: no student data in what is shared.
    expect(JSON.stringify(apiMock.saveImportMappingProfile.mock.calls[0][0])).not.toContain('2024-00001')
  })
})
