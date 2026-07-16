import type { ExecutionContext } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>
  let guard: RolesGuard

  const mockContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    }) as any

  beforeEach(() => {
    reflector = new Reflector() as jest.Mocked<Reflector>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    guard = new RolesGuard(reflector)
  })

  afterEach(() => jest.restoreAllMocks())

  it('allows access when no roles decorator is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    expect(guard.canActivate(mockContext({ id: 'u1', role: 'student' }))).toBe(true)
  })

  it('allows access when required roles array is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([])
    expect(guard.canActivate(mockContext({ id: 'u1', role: 'student' }))).toBe(true)
  })

  it('allows access when user has a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['teacher', 'super_admin'])
    expect(guard.canActivate(mockContext({ id: 'u1', role: 'teacher' }))).toBe(true)
  })

  it('allows access for super_admin when required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['super_admin'])
    expect(guard.canActivate(mockContext({ id: 'u1', role: 'super_admin' }))).toBe(true)
  })

  it('forbids access when user lacks required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['teacher'])
    expect(() => guard.canActivate(mockContext({ id: 'u1', role: 'student' }))).toThrow(ForbiddenException)
  })

  it('forbids access when user is missing (no user in request)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['teacher'])
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException)
  })

  it('forbids access when user role is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['teacher'])
    expect(() => guard.canActivate(mockContext({ id: 'u1' }))).toThrow(ForbiddenException)
  })
})
