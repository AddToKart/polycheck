import type { ExecutionContext } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DesignationsGuard } from './designations.guard'
import { REQUIRED_DESIGNATIONS_KEY } from '../decorators/require-designation.decorator'
import type { RequestUser } from '../../auth/authenticated-principal'

describe('DesignationsGuard', () => {
  let reflector: Reflector
  let guard: DesignationsGuard

  const mockContext = (user?: RequestUser): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    }) as unknown as ExecutionContext

  const metadata = (value: unknown) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === REQUIRED_DESIGNATIONS_KEY) return value as never
      return undefined
    })
  }

  beforeEach(() => {
    reflector = new Reflector()
    guard = new DesignationsGuard(reflector)
  })

  afterEach(() => jest.restoreAllMocks())

  it('passes when no designation is required', () => {
    metadata(undefined)
    expect(guard.canActivate(mockContext({ id: 'u1', role: 'teacher' }))).toBe(true)
  })

  it('passes for super admins without any flag', () => {
    metadata(['user_admin'])
    expect(guard.canActivate(mockContext({ id: 'a1', role: 'super_admin' }))).toBe(true)
  })

  it('passes a teacher holding the required designation', () => {
    metadata(['it_operations'])
    expect(guard.canActivate(mockContext({ id: 't1', role: 'teacher', isItCoordinator: true }))).toBe(true)
  })

  it('rejects a teacher without the designation with a typed 403', () => {
    metadata(['user_admin'])
    const run = () => guard.canActivate(mockContext({ id: 't1', role: 'teacher' }))
    expect(run).toThrow(ForbiddenException)
    try {
      run()
    } catch (error) {
      const body = (error as ForbiddenException).getResponse()
      expect(body).toEqual(expect.objectContaining({ code: 'designation_required', designation: 'user_admin' }))
    }
  })

  it('rejects when any of multiple required designations is missing', () => {
    metadata(['it_operations', 'user_admin'])
    expect(() => guard.canActivate(mockContext({ id: 't1', role: 'teacher', isItCoordinator: true }))).toThrow(
      ForbiddenException,
    )
  })

  it('passes when the actor holds every required designation', () => {
    metadata(['it_operations', 'user_admin'])
    expect(
      guard.canActivate(mockContext({ id: 't1', role: 'teacher', isItCoordinator: true, isUserRegistrar: true })),
    ).toBe(true)
  })

  it('rejects students even if a flag leaked through', () => {
    metadata(['it_operations'])
    expect(() => guard.canActivate(mockContext({ id: 's1', role: 'student', isItCoordinator: true }))).toThrow(
      ForbiddenException,
    )
  })

  it('rejects when no principal is present', () => {
    metadata(['user_admin'])
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException)
  })
})
