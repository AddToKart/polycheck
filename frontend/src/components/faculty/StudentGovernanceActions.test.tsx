import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NotificationProvider } from '@/lib/notifications'
import { StudentGovernanceActions } from './StudentGovernanceActions'

const apiMock = vi.hoisted(() => ({
  teacherResetStudentPassword: vi.fn(),
  emergencyReleaseDevice: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const student = {
  id: 's-1',
  fullName: 'Juan Dela Cruz',
  studentId: '2024-00001-MN-0',
  deviceCooldownUntil: null,
  deviceBoundAt: '2026-10-01T08:00:00.000Z',
}

function renderActions(permissions: { canResetStudentPasswords: boolean; canEmergencyUnbindDevices: boolean } | null) {
  render(
    <NotificationProvider>
      <StudentGovernanceActions student={student} sectionId="sec-1" permissions={permissions} />
    </NotificationProvider>,
  )
}

describe('StudentGovernanceActions', () => {
  it('hides both actions when the teacher has no delegated capabilities', () => {
    renderActions({ canResetStudentPasswords: false, canEmergencyUnbindDevices: false })
    expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /emergency device release/i })).not.toBeInTheDocument()
  })

  it('hides actions without a section context', () => {
    render(
      <NotificationProvider>
        <StudentGovernanceActions student={student} sectionId={null} />
      </NotificationProvider>,
    )
    expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument()
  })

  it('generates a temporary password and shows it once', async () => {
    apiMock.teacherResetStudentPassword.mockResolvedValue({
      userId: 's-1',
      temporaryPassword: 'PUP-K7W2M4Q8-tx!',
      message: 'generated',
    })
    renderActions({ canResetStudentPasswords: true, canEmergencyUnbindDevices: false })

    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /generate temporary password/i }))

    await waitFor(() =>
      expect(apiMock.teacherResetStudentPassword).toHaveBeenCalledWith('s-1', 'sec-1'),
    )
    expect(await screen.findByText('PUP-K7W2M4Q8-tx!')).toBeInTheDocument()
  })

  it('submits an emergency release with reason and note', async () => {
    apiMock.emergencyReleaseDevice.mockResolvedValue({
      user: { ...student, deviceBoundAt: null, boundDeviceId: null },
      clearedCooldown: true,
      message: 'released',
    })
    renderActions({ canResetStudentPasswords: false, canEmergencyUnbindDevices: true })

    fireEvent.click(screen.getByRole('button', { name: /emergency device release/i }))
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'lost_or_damaged' } })
    fireEvent.change(screen.getByLabelText(/note \(optional\)/i), { target: { value: 'Lost phone' } })
    fireEvent.click(screen.getByRole('button', { name: /release device/i }))

    await waitFor(() =>
      expect(apiMock.emergencyReleaseDevice).toHaveBeenCalledWith('s-1', {
        sectionId: 'sec-1',
        reason: 'lost_or_damaged',
        note: 'Lost phone',
      }),
    )
  })

  it('shows the cooldown countdown and the exempt device before release', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T00:00:00.000Z'))
    const view = render(
      <NotificationProvider>
        <StudentGovernanceActions
          student={{
            ...student,
            deviceCooldownUntil: '2026-11-10T00:02:00.000Z',
            cooldownDeviceId: 'web-abcd1234',
            deviceBoundAt: null,
            boundDeviceId: null,
          }}
          sectionId="sec-1"
          permissions={{ canResetStudentPasswords: true, canEmergencyUnbindDevices: true }}
        />
      </NotificationProvider>,
    )

    expect(screen.getByText(/device locked · 2:00 left/i)).toBeInTheDocument()
    expect(screen.getByText(/exempt device · web browser •·•·1234/i)).toBeInTheDocument()
    expect(screen.queryByText(/no device bound/i)).not.toBeInTheDocument()

    view.unmount()
    vi.useRealTimers()
  })

  it('shows bound and cooldown chips together when both are active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T00:00:00.000Z'))
    render(
      <NotificationProvider>
        <StudentGovernanceActions
          student={{
            ...student,
            deviceCooldownUntil: '2026-11-10T01:30:00.000Z',
            cooldownDeviceId: 'mobile-xyz9988',
            deviceBoundAt: '2026-10-01T08:00:00.000Z',
            boundDeviceId: 'web-abcd1234',
          }}
          sectionId="sec-1"
          permissions={{ canResetStudentPasswords: true, canEmergencyUnbindDevices: true }}
        />
      </NotificationProvider>,
    )

    expect(screen.getByText(/device locked · 1:30:00 left/i)).toBeInTheDocument()
    expect(screen.getByText(/exempt device · mobile app •·•·9988/i)).toBeInTheDocument()
    expect(screen.getByText(/device bound · web browser •·•·1234/i)).toBeInTheDocument()
  })

  it('reports what the release cleared in the success notification', async () => {
    apiMock.emergencyReleaseDevice.mockResolvedValue({
      user: {
        ...student,
        deviceCooldownUntil: null,
        cooldownDeviceId: null,
        deviceBoundAt: null,
        boundDeviceId: null,
      },
      clearedCooldown: true,
      hadCooldown: true,
      hadBinding: true,
      message: 'released',
    })
    renderActions({ canResetStudentPasswords: false, canEmergencyUnbindDevices: true })

    fireEvent.click(screen.getByRole('button', { name: /emergency device release/i }))
    fireEvent.click(screen.getByRole('button', { name: /release device/i }))

    expect(
      await screen.findByText(/cooldown cleared and device binding removed/i),
    ).toBeInTheDocument()
  })
})
