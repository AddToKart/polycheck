import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NotificationProvider } from '@/lib/notifications'
import { ReportIssueDialog } from './ReportIssueDialog'

const apiMock = vi.hoisted(() => ({
  createSystemReport: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

afterEach(cleanup)

beforeEach(() => {
  apiMock.createSystemReport.mockReset().mockResolvedValue({ id: 'report-1' })
})

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <NotificationProvider>
      <ReportIssueDialog open onOpenChange={onOpenChange} />
    </NotificationProvider>,
  )
  return onOpenChange
}

describe('ReportIssueDialog', () => {
  it('submits the chosen intake payload with auto-captured telemetry', async () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Scanner shows black screen' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Opening the Scan tab keeps the camera black on my laptop.' },
    })
    fireEvent.click(screen.getByTestId('severity-high'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(apiMock.createSystemReport).toHaveBeenCalledTimes(1))
    const input = apiMock.createSystemReport.mock.calls[0][0]
    expect(input).toMatchObject({
      category: 'scanner_camera',
      severity: 'high',
      title: 'Scanner shows black screen',
      description: 'Opening the Scan tab keeps the camera black on my laptop.',
    })
    expect(input.deviceInfo).toEqual(expect.any(String))
    expect(input.route).toEqual(expect.any(String))
    expect(input.screenshotData).toBeUndefined()
  })

  it('surfaces server-side size/format errors without closing', async () => {
    apiMock.createSystemReport.mockRejectedValueOnce(new Error('Screenshot must be 5 MB or smaller'))
    renderDialog()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Attachment too large' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Trying to attach a huge image.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Screenshot must be 5 MB or smaller')
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument()
  })

  it('rejects titles that are too short before submitting', async () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'tiny' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Enough description length here.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(apiMock.createSystemReport).not.toHaveBeenCalled()
  })
})
