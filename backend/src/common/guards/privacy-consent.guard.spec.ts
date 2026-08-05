import type { ConfigService } from '@nestjs/config'
import { ForbiddenException } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { PrivacyConsentGuard } from './privacy-consent.guard'

const context = (user: Record<string, unknown>) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as never

describe('PrivacyConsentGuard', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('2026-08-04') }

  it('requires the current notice version for protected student actions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) }
    const guard = new PrivacyConsentGuard(reflector as unknown as Reflector, config as unknown as ConfigService)

    expect(() => guard.canActivate(context({ role: 'student' }))).toThrow(ForbiddenException)
    expect(
      guard.canActivate(
        context({ role: 'student', privacyConsentVersion: '2026-08-04', privacyConsentedAt: new Date() }),
      ),
    ).toBe(true)
  })

  it('does not affect unmarked routes or non-student roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) }
    const guard = new PrivacyConsentGuard(reflector as unknown as Reflector, config as unknown as ConfigService)
    expect(guard.canActivate(context({ role: 'student' }))).toBe(true)

    reflector.getAllAndOverride.mockReturnValue(true)
    expect(guard.canActivate(context({ role: 'teacher' }))).toBe(true)
  })
})
