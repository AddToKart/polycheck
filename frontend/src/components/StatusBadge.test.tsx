import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AttendanceStatus, ExcuseStatus } from '@polycheck/shared'
import StatusBadge from './StatusBadge'
import ExcuseStatusBadge from './ExcuseStatusBadge'

afterEach(cleanup)

const statuses: AttendanceStatus[] = ['present', 'late', 'absent', 'pending', 'disputed', 'excused']

describe('attendance status badges', () => {
  it.each(statuses)('renders a labelled %s badge', (status) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument()
  })

  it('gives excused the golden-border maroon treatment', () => {
    render(<StatusBadge status="excused" />)
    const badge = screen.getByText('Excused')
    expect(badge).toHaveClass('bg-maroon')
    expect(badge).toHaveClass('border-golden')
  })
})

const excuseStatuses: ExcuseStatus[] = ['requested', 'approved', 'rejected']

describe('excuse status badges', () => {
  it.each(excuseStatuses)('renders the %s excuse chip', (status) => {
    render(<ExcuseStatusBadge status={status} />)
    expect(screen.getByText(new RegExp(`excuse ${status}`, 'i'))).toBeInTheDocument()
  })
})
