import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from './jwt-auth.guard'

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() }
  const guard = new JwtAuthGuard(reflector as unknown as Reflector)

  it('returns the authenticated user', () => {
    const user = { id: 'user-1', role: 'student' as const }
    expect(guard.handleRequest(null, user)).toBe(user)
  })

  it('preserves authentication errors', () => {
    const error = new Error('passport failed')
    expect(() => guard.handleRequest(error, null)).toThrow(error)
  })

  it('rejects a missing user', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException)
  })

  it('allows routes marked public without invoking Passport', () => {
    reflector.getAllAndOverride.mockReturnValue(true)
    const context = {
      getHandler: jest.fn().mockReturnValue(() => undefined),
      getClass: jest.fn().mockReturnValue(class TestController {}),
    } as unknown as ExecutionContext

    expect(guard.canActivate(context)).toBe(true)
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(expect.any(String), expect.any(Array))
  })
})
