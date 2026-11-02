import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DeviceBindingService } from './device-binding.service'

function cooldownErrorOf(error: unknown) {
  expect(error).toBeInstanceOf(ForbiddenException)
  return (error as ForbiddenException).getResponse() as {
    code?: string
    remainingMinutes?: number
    message?: string
  }
}

describe('DeviceBindingService', () => {
  const settings = {
    getTeacherDelegationPolicies: jest.fn(),
  }

  beforeEach(() => {
    settings.getTeacherDelegationPolicies.mockReset()
    settings.getTeacherDelegationPolicies.mockResolvedValue({
      teacherPasswordReset: true,
      teacherEmergencyUnbind: true,
      deviceCooldownHours: 2,
    })
  })

  afterEach(() => jest.useRealTimers())

  const makePrisma = (overrides: { user?: Record<string, unknown> } = {}) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        ...(overrides.user ?? {}),
      },
      authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    }
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma))
    return prisma
  }

  it('merges per-teacher overrides with the institution master switches', async () => {
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ canResetStudentPasswords: false, canEmergencyUnbindDevices: null }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await expect(service.getEffectiveTeacherPermissions('teacher-1')).resolves.toEqual({
      canResetStudentPasswords: false,
      canEmergencyUnbindDevices: true,
    })
  })

  it('never enables a capability the institution disabled', async () => {
    settings.getTeacherDelegationPolicies.mockResolvedValue({
      teacherPasswordReset: false,
      teacherEmergencyUnbind: false,
      deviceCooldownHours: 2,
    })
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ canResetStudentPasswords: true, canEmergencyUnbindDevices: true }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await expect(service.getEffectiveTeacherPermissions('teacher-1')).resolves.toEqual({
      canResetStudentPasswords: false,
      canEmergencyUnbindDevices: false,
    })
  })

  it('rejects mobile logins while a cooldown is active and reports remaining minutes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'student',
          boundDeviceId: null,
          deviceCooldownUntil: new Date('2026-10-30T10:42:00.000Z'),
        }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    let caught: unknown
    try {
      await service.assertMobileLoginAllowed('student-1')
    } catch (error) {
      caught = error
    }
    const body = cooldownErrorOf(caught)
    expect(body.code).toBe('device_cooldown_active')
    expect(body.remainingMinutes).toBe(42)
  })

  it('allows mobile logins once the cooldown has expired and for staff accounts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            role: 'student',
            boundDeviceId: null,
            deviceCooldownUntil: new Date('2026-10-30T09:59:00.000Z'),
          })
          .mockResolvedValueOnce({
            role: 'teacher',
            boundDeviceId: null,
            deviceCooldownUntil: new Date('2026-10-30T12:00:00.000Z'),
          }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await expect(service.assertMobileLoginAllowed('student-1')).resolves.toBeUndefined()
    await expect(service.assertMobileLoginAllowed('teacher-1')).resolves.toBeUndefined()
  })

  it('binds on change only and skips binding during an active cooldown', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ boundDeviceId: 'mobile-same', deviceCooldownUntil: null })
          .mockResolvedValueOnce({ boundDeviceId: 'mobile-other', deviceCooldownUntil: null })
          .mockResolvedValueOnce({ boundDeviceId: 'mobile-new', deviceCooldownUntil: null }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await service.registerBinding('student-1', 'mobile-same', 'student')
    expect(prisma.user.update).not.toHaveBeenCalled()

    await service.registerBinding('student-1', 'mobile-new', 'student')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { boundDeviceId: 'mobile-new', deviceBoundAt: expect.any(Date) },
    })

    prisma.user.update.mockClear()
    await service.registerBinding('student-1', 'mobile-new', 'student')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('skips binding while a cooldown is active', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          boundDeviceId: 'mobile-old',
          deviceCooldownUntil: new Date('2026-10-30T11:00:00.000Z'),
        }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await service.registerBinding('student-1', 'mobile-new', 'student')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('does not bind non-student roles', async () => {
    const prisma = makePrisma()
    const service = new DeviceBindingService(prisma as never, settings as never)

    await service.registerBinding('teacher-1', 'mobile-abc', 'teacher')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('arms the cooldown, clears the binding, and revokes sessions on unregister', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          role: 'student',
          deviceCooldownUntil: null,
        }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    const result = await service.unregisterStudentDevice('student-1', 'mobile-abcd1234', '203.0.113.9')

    expect(result.cooldownHours).toBe(2)
    expect(result.cooldownUntil.toISOString()).toBe('2026-10-30T12:00:00.000Z')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { boundDeviceId: null, deviceBoundAt: null, deviceCooldownUntil: new Date('2026-10-30T12:00:00.000Z') },
    })
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'student-1' } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'student-1',
        action: 'student.device_unregister',
        entityId: 'student-1',
        metadata: expect.objectContaining({ deviceId: 'mobile-abcd1234', cooldownHours: 2, ipAddress: '203.0.113.9' }),
      }),
    })
  })

  it('extends but never shortens an existing cooldown', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          role: 'student',
          deviceCooldownUntil: new Date('2026-10-30T15:00:00.000Z'),
        }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    const result = await service.unregisterStudentDevice('student-1', undefined)
    expect(result.cooldownUntil.toISOString()).toBe('2026-10-30T15:00:00.000Z')
  })

  it('rejects unregister for non-student accounts', async () => {
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', deviceCooldownUntil: null }),
      },
    })
    const service = new DeviceBindingService(prisma as never, settings as never)

    await expect(service.unregisterStudentDevice('teacher-1', undefined)).rejects.toMatchObject({
      message: 'Only student accounts bind mobile devices',
    })
  })

  it('throws NotFound when the account is missing', async () => {
    const prisma = makePrisma()
    const service = new DeviceBindingService(prisma as never, settings as never)

    await expect(service.unregisterStudentDevice('missing', undefined)).rejects.toBeInstanceOf(NotFoundException)
  })
})
