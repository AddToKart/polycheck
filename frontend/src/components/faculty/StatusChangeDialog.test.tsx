import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatusChangeDialog } from './StatusChangeDialog'
import { NumberField, numberRangeIssue } from '@/components/NumberField'

afterEach(cleanup)

describe('StatusChangeDialog', () => {
  const setup = (initial?: 'late') => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <StatusChangeDialog
        studentName="Sample Student"
        context="this class meeting"
        current="present"
        initial={initial}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )
    return { onConfirm, onClose }
  }

  it('will not confirm until a different status is chosen', () => {
    const { onConfirm } = setup()
    const confirm = screen.getByRole('button', { name: 'Confirm change' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Present (now)' })).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: 'Absent' }))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('absent')
  })

  it('says what will change and cancels without changing it', () => {
    const { onConfirm, onClose } = setup('late')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Present will change to Late')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('NumberField', () => {
  it.each([
    ['55235e', 'Use digits only.'],
    ['55', 'Enter a number from 1 to 15.'],
    ['0', 'Enter a number from 1 to 15.'],
    ['', 'Enter a number from 1 to 15.'],
    ['15', null],
  ])('explains %j', (value, issue) => {
    expect(numberRangeIssue(value, 1, 15)).toBe(issue)
  })

  it('shows the problem under the field and keeps letters out', () => {
    const onChange = vi.fn()
    render(<NumberField id="n" label="QR Validity" unit="minutes" value="99" onChange={onChange} min={1} max={15} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number from 1 to 15.')
    const input = screen.getByLabelText('QR Validity')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('maxlength', '2')
    fireEvent.change(input, { target: { value: '5e' } })
    expect(onChange).toHaveBeenCalledWith('5')
  })
})
