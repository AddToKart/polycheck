import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DeviceBindingService } from './device-binding.service'

function gateErrorOf(error: unknown) {
  expect(error).toBeInstanceOf(ForbiddenException)
  return (error as ForbiddenException).getResponse() as {
    code?: string
    remainingMinutes?: number
    remainingSeconds?: number
    activeDeviceKind?: string | null
    activeSessionLastActiveAt?: string
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

  const makePrisma = (overrides: { user?: Record<string, unknown>; authSession?: Record<string, unknown> } = {}) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        ...(overrides.user ?? {}),
      },
      authSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        ...(overrides.authSession ?? {}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    }
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prisma))
    return prisma
  }

  const studentGatePrisma = (options: {
    authVersion?: number
    deviceCooldownUntil?: Date | null
    cooldownDeviceId?: string | null
    activeSessions?: Array<{ deviceId: string | null; updatedAt: Date }>
  }) =>
    makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'student',
          authVersion: options.authVersion ?? 3,
          deviceCooldownUntil: options.deviceCooldownUntil ?? null,
          cooldownDeviceId: options.cooldownDeviceId ?? null,
        }),
      },
      authSession: {
        findMany: jest.fn().mockResolvedValue(options.activeSessions ?? []),
      },
    })

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

  describe('assertLoginAllowed', () => {
    it('blocks a login while another device holds an active session', async () => {
      const prisma = studentGatePrisma({
        activeSessions: [{ deviceId: 'mobile-other', updatedAt: new Date('2026-11-10T09:15:00.000Z') }],
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      let caught: unknown
      try {
        await service.assertLoginAllowed('student-1', 'web-abc')
      } catch (error) {
        caught = error
      }
      const body = gateErrorOf(caught)
      expect(body.code).toBe('active_session_elsewhere')
      expect(body.activeDeviceKind).toBe('mobile')
      expect(body.activeSessionLastActiveAt).toBe('2026-11-10T09:15:00.000Z')
      expect(body.message).toContain('signed in on another device')
      expect(prisma.authSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'student-1', expiresAt: { gt: expect.any(Date) }, generation: 3 },
        select: { deviceId: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      })
    })

    it('allows a login from the same device that holds the active session', async () => {
      const prisma = studentGatePrisma({
        activeSessions: [{ deviceId: 'web-abc', updatedAt: new Date('2026-11-10T09:15:00.000Z') }],
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'web-abc')).resolves.toBeUndefined()
    })

    it('allows a login when no session is active', async () => {
      const prisma = studentGatePrisma({})
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'mobile-abc')).resolves.toBeUndefined()
      await expect(service.assertLoginAllowed('student-1', null)).resolves.toBeUndefined()
    })

    it('never lets a legacy null-device session block a device-bearing attempt', async () => {
      const prisma = studentGatePrisma({
        activeSessions: [{ deviceId: null, updatedAt: new Date('2026-11-10T09:15:00.000Z') }],
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'web-new')).resolves.toBeUndefined()
    })

    it('fails closed for an unidentified attempt while any session is active', async () => {
      const prisma = studentGatePrisma({
        activeSessions: [{ deviceId: 'mobile-other', updatedAt: new Date('2026-11-10T09:15:00.000Z') }],
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      let caught: unknown
      try {
        await service.assertLoginAllowed('student-1', null)
      } catch (error) {
        caught = error
      }
      const body = gateErrorOf(caught)
      expect(body.code).toBe('active_session_elsewhere')
      expect(body.activeDeviceKind).toBe('mobile')
      expect(body.message).toContain('could not be identified')
    })

    it('also fails closed for an unidentified attempt against a legacy session', async () => {
      const prisma = studentGatePrisma({
        activeSessions: [{ deviceId: null, updatedAt: new Date('2026-11-10T09:15:00.000Z') }],
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      let caught: unknown
      try {
        await service.assertLoginAllowed('student-1', '   ')
      } catch (error) {
        caught = error
      }
      const body = gateErrorOf(caught)
      expect(body.code).toBe('active_session_elsewhere')
      expect(body.activeDeviceKind).toBeNull()
    })

    it('blocks a cooled-down login from another device with exact remaining seconds', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = studentGatePrisma({
        deviceCooldownUntil: new Date('2026-10-30T10:42:00.000Z'),
        cooldownDeviceId: 'mobile-old',
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      let caught: unknown
      try {
        await service.assertLoginAllowed('student-1', 'web-abc')
      } catch (error) {
        caught = error
      }
      const body = gateErrorOf(caught)
      expect(body.code).toBe('device_cooldown_active')
      expect(body.remainingMinutes).toBe(42)
      expect(body.remainingSeconds).toBe(42 * 60)
      expect(prisma.authSession.findMany).not.toHaveBeenCalled()
    })

    it('exempts the device that logged out from the armed cooldown', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = studentGatePrisma({
        deviceCooldownUntil: new Date('2026-10-30T10:42:00.000Z'),
        cooldownDeviceId: 'web-abc',
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'web-abc')).resolves.toBeUndefined()
      await expect(service.assertLoginAllowed('student-1', null)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('blocks every device when the cooldown has no exempt device', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = studentGatePrisma({
        deviceCooldownUntil: new Date('2026-10-30T10:42:00.000Z'),
        cooldownDeviceId: null,
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'web-abc')).rejects.toBeInstanceOf(ForbiddenException)
      await expect(service.assertLoginAllowed('student-1', null)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('proceeds past an expired cooldown to the active-session check', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = studentGatePrisma({
        deviceCooldownUntil: new Date('2026-10-30T09:59:00.000Z'),
        cooldownDeviceId: 'mobile-old',
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('student-1', 'web-abc')).resolves.toBeUndefined()
      expect(prisma.authSession.findMany).toHaveBeenCalled()
    })

    it('never device-locks staff accounts', async () => {
      const prisma = makePrisma({
        user: {
          findUnique: jest.fn().mockResolvedValue({
            role: 'teacher',
            authVersion: 0,
            deviceCooldownUntil: new Date(Date.now() + 60_000),
            cooldownDeviceId: 'mobile-old',
          }),
        },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('teacher-1', 'web-any')).resolves.toBeUndefined()
      expect(prisma.authSession.findMany).not.toHaveBeenCalled()
    })

    it('allows logins for unknown accounts (credentials fail first)', async () => {
      const prisma = makePrisma()
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.assertLoginAllowed('missing', 'web-abc')).resolves.toBeUndefined()
    })
  })

  describe('stampLoginSession', () => {
    it('stamps the new session and purges older rows from the same device', async () => {
      const prisma = makePrisma()
      const service = new DeviceBindingService(prisma as never, settings as never)

      await service.stampLoginSession('student-1', 'mobile-abc', 'sess-new')

      expect(prisma.authSession.update).toHaveBeenCalledWith({
        where: { id: 'sess-new' },
        data: { deviceId: 'mobile-abc' },
      })
      expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'student-1', deviceId: 'mobile-abc', id: { not: 'sess-new' } },
      })
      expect(prisma.authSession.findFirst).not.toHaveBeenCalled()
    })

    it('falls back to the newest session when the hook does not supply an id', async () => {
      const prisma = makePrisma({
        authSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-newest' }) },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await service.stampLoginSession('student-1', 'web-abc')

      expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
        where: { userId: 'student-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      })
      expect(prisma.authSession.update).toHaveBeenCalledWith({
        where: { id: 'sess-newest' },
        data: { deviceId: 'web-abc' },
      })
      expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'student-1', deviceId: 'web-abc', id: { not: 'sess-newest' } },
      })
    })

    it('does nothing for a blank device id or a missing session', async () => {
      const prisma = makePrisma()
      const service = new DeviceBindingService(prisma as never, settings as never)

      await service.stampLoginSession('student-1', '   ', 'sess-new')
      await service.stampLoginSession('student-1', 'web-abc')

      expect(prisma.authSession.findFirst).toHaveBeenCalled()
      expect(prisma.authSession.update).not.toHaveBeenCalled()
      expect(prisma.authSession.deleteMany).not.toHaveBeenCalled()
    })

    it('logs and swallows stamping failures so a created login is not reported as failed', async () => {
      const prisma = makePrisma({
        authSession: { update: jest.fn().mockRejectedValue(new Error('db down')) },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.stampLoginSession('student-1', 'web-abc', 'sess-new')).resolves.toBeUndefined()
    })
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
      data: {
        boundDeviceId: null,
        deviceBoundAt: null,
        deviceCooldownUntil: new Date('2026-10-30T12:00:00.000Z'),
        cooldownDeviceId: 'mobile-abcd1234',
      },
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
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cooldownDeviceId: null }),
      }),
    )
  })

  describe('armLogoutCooldown', () => {
    it('arms a student logout cooldown and exempts the logging-out device', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = makePrisma({
        user: { findUnique: jest.fn().mockResolvedValue({ deviceCooldownUntil: null }) },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      const result = await service.armLogoutCooldown('student-1', 'student', 'web-abc', '203.0.113.9')

      expect(result?.cooldownUntil.toISOString()).toBe('2026-10-30T12:00:00.000Z')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: { deviceCooldownUntil: new Date('2026-10-30T12:00:00.000Z'), cooldownDeviceId: 'web-abc' },
      })
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'student.device_cooldown_armed',
          actorId: 'student-1',
          entityId: 'student-1',
          metadata: expect.objectContaining({
            deviceId: 'web-abc',
            cooldownHours: 2,
            cooldownUntil: '2026-10-30T12:00:00.000Z',
            reason: 'logout',
            ipAddress: '203.0.113.9',
          }),
        }),
      })
    })

    it('never arms a device-agnostic cooldown when the logout carries no device id', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = makePrisma({
        user: { findUnique: jest.fn().mockResolvedValue({ deviceCooldownUntil: null }) },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.armLogoutCooldown('student-1', 'student', undefined)).resolves.toBeNull()
      await expect(service.armLogoutCooldown('student-1', 'student', '   ')).resolves.toBeNull()

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('never arms a cooldown for staff logouts', async () => {
      const prisma = makePrisma()
      const service = new DeviceBindingService(prisma as never, settings as never)

      await expect(service.armLogoutCooldown('teacher-1', 'teacher', 'web-abc')).resolves.toBeNull()
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('extends an existing cooldown without shortening it', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:00:00.000Z'))
      const prisma = makePrisma({
        user: {
          findUnique: jest.fn().mockResolvedValue({ deviceCooldownUntil: new Date('2026-10-30T15:00:00.000Z') }),
        },
      })
      const service = new DeviceBindingService(prisma as never, settings as never)

      const result = await service.armLogoutCooldown('student-1', 'student', 'web-abc')
      expect(result?.cooldownUntil.toISOString()).toBe('2026-10-30T15:00:00.000Z')
    })
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
