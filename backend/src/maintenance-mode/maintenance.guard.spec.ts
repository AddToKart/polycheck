import type { ExecutionContext } from '@nestjs/common'
import { ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator'
import { MaintenanceGuard } from './maintenance.guard'
import type { SystemMaintenanceService } from './system-maintenance.service'
import type { RequestUser } from '../auth/authenticated-principal'

describe('MaintenanceGuard', () => {
  let reflector: Reflector
  let maintenance: { current: jest.Mock; bypasses: jest.Mock }
  let guard: MaintenanceGuard
  let isPublic: boolean

  const mockContext = (user?: RequestUser): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    }) as unknown as ExecutionContext

  beforeEach(() => {
    isPublic = false
    reflector = new Reflector()
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) return isPublic as never
      return undefined
    })
    maintenance = { current: jest.fn().mockResolvedValue({ enabled: false }), bypasses: jest.fn() }
    // Use the real exemption helper semantics for bypass decisions.
    maintenance.bypasses.mockImplementation((user: RequestUser | undefined) => {
      if (!user) return false
      return user.role === 'super_admin' || (user.role === 'teacher' && user.isItCoordinator === true)
    })
    guard = new MaintenanceGuard(reflector, maintenance as unknown as SystemMaintenanceService)
  })

  afterEach(() => jest.restoreAllMocks())

  it('skips public routes (health probes, logins, status endpoint)', async () => {
    isPublic = true
    maintenance.current.mockResolvedValue({ enabled: true, message: 'Down' })
    await expect(guard.canActivate(mockContext())).resolves.toBe(true)
    expect(maintenance.current).not.toHaveBeenCalled()
  })

  it('allows any request while maintenance is disabled', async () => {
    await expect(guard.canActivate(mockContext({ id: 's1', role: 'student' }))).resolves.toBe(true)
  })

  it('allows super admins through while maintenance is enabled', async () => {
    maintenance.current.mockResolvedValue({ enabled: true, message: 'Down' })
    await expect(guard.canActivate(mockContext({ id: 'a1', role: 'super_admin' }))).resolves.toBe(true)
  })

  it('allows IT coordinators through while maintenance is enabled', async () => {
    maintenance.current.mockResolvedValue({ enabled: true, message: 'Down' })
    await expect(guard.canActivate(mockContext({ id: 't1', role: 'teacher', isItCoordinator: true }))).resolves.toBe(
      true,
    )
  })

  it('blocks students while maintenance is enabled', async () => {
    maintenance.current.mockResolvedValue({ enabled: true, message: 'Down', estimatedEnd: '2026-11-01T10:00:00Z' })
    await expect(guard.canActivate(mockContext({ id: 's1', role: 'student' }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('blocks non-designated teachers while maintenance is enabled', async () => {
    maintenance.current.mockResolvedValue({ enabled: true, message: 'Down' })
    await expect(guard.canActivate(mockContext({ id: 't1', role: 'teacher' }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('returns the canonical 503 body', async () => {
    maintenance.current.mockResolvedValue({
      enabled: true,
      message: 'Campus maintenance',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
    const error = (await guard.canActivate(mockContext({ id: 't1', role: 'teacher' })).then(
      () => null,
      (caught: unknown) => caught,
    )) as ServiceUnavailableException
    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect(error.getStatus()).toBe(503)
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        code: 'system_maintenance',
        message: 'Campus maintenance',
        estimatedEnd: '2026-11-01T10:00:00.000Z',
      }),
    )
  })

  it('fails open when the state service unexpectedly rejects', async () => {
    maintenance.current.mockRejectedValue(new Error('state unavailable'))
    await expect(guard.canActivate(mockContext({ id: 's1', role: 'student' }))).resolves.toBe(true)
  })
})
