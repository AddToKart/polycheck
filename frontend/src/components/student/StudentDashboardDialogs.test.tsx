import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord } from '@polycheck/shared'
import { StudentDisputeDialog } from './StudentDashboardDialogs'

const record: AttendanceRecord = {
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 's-001',
  studentName: 'Ana Reyes',
  timestamp: '2026-07-01T08:05:00.000Z',
  status: 'absent',
  coordinates: { latitude: 14.8697, longitude: 120.9991 },
  isSynced: true,
}

type DialogProps = React.ComponentProps<typeof StudentDisputeDialog>

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    record,
    reason: '',
    description: '',
    feedback: null,
    subjectName: 'Introduction to Computing',
    submitting: false,
    onClose: vi.fn(),
    onReasonChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  }
  const view = render(<StudentDisputeDialog {...props} />)
  return { ...view, props }
}

function ControlledDialog({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  return (
    <StudentDisputeDialog
      record={record}
      reason={reason}
      description={description}
      feedback={null}
      subjectName="Introduction to Computing"
      submitting={false}
      onClose={vi.fn()}
      onReasonChange={setReason}
      onDescriptionChange={setDescription}
      onSubmit={onSubmit}
    />
  )
}

afterEach(cleanup)

describe('StudentDisputeDialog', () => {
  it('enforces the 10-character description minimum: submit stays disabled until it is met', () => {
    const onSubmit = vi.fn()
    render(<ControlledDialog onSubmit={onSubmit} />)

    const submit = screen.getByRole('button', { name: /submit dispute/i })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'outside_geofence' } })
    expect(submit).toBeDisabled()

    const description = screen.getByLabelText('Description')
    expect(description).toHaveAttribute('maxLength', '1000')

    const shortDescription = 'too short'
    const longDescription = 'I was actually inside the room.'

    fireEvent.change(description, { target: { value: shortDescription } })
    expect(submit).toBeDisabled()
    expect(screen.getByText(`${shortDescription.length}/1000`)).toBeInTheDocument()
    expect(screen.getByText('At least 10 characters required')).toBeInTheDocument()

    fireEvent.change(description, { target: { value: longDescription } })
    expect(screen.getByText(`${longDescription.length}/1000`)).toBeInTheDocument()
    expect(submit).toBeEnabled()

    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('offers "Other" as its own reason instead of reusing device_mismatch', () => {
    renderDialog()

    const select = screen.getByLabelText('Reason')
    const other = Array.from(select.querySelectorAll('option')).find(
      (option) => option.textContent === 'Other',
    )
    expect(other).toHaveValue('other')
    expect(
      Array.from(select.querySelectorAll('option')).some(
        (option) => option.value === 'device_mismatch' && option.textContent === 'Other',
      ),
    ).toBe(false)
  })

  it('renders server error feedback inside the dialog as an alert', () => {
    renderDialog({
      reason: 'other',
      description: 'The QR scanner rejected my valid token.',
      feedback: { type: 'error', message: 'Description must be at least 10 characters' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Description must be at least 10 characters',
    )
    expect(screen.getByRole('button', { name: /submit dispute/i })).toBeEnabled()
  })

  it('disables the submit button and shows a pending label while submitting', () => {
    renderDialog({
      reason: 'other',
      description: 'The QR scanner rejected my valid token.',
      submitting: true,
    })

    const submit = screen.getByRole('button', { name: /submitting/i })
    expect(submit).toBeDisabled()
    expect(submit).toHaveTextContent('Submitting...')
  })
})
