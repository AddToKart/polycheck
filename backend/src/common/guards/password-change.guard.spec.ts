import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { PasswordChangeGuard } from './password-change.guard'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator'
import { AuthController } from '../../auth/auth.controller'
import { UsersController } from '../../users/users.controller'

const context = (user: Record<string, unknown> | undefined) =>
  ({
    getHandler: () => jest.fn(),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext

function guardFor(metadata: { public?: boolean; allow?: boolean }) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return Boolean(metadata.public)
      if (key === ALLOW_PENDING_PASSWORD_CHANGE_KEY) return Boolean(metadata.allow)
      return undefined
    }),
  }
  return new PasswordChangeGuard(reflector as unknown as Reflector)
}

describe('PasswordChangeGuard', () => {
  it('blocks every protected route until the temporary password is rotated', () => {
    const guard = guardFor({ public: false, allow: false })

    try {
      guard.canActivate(context({ id: 'u1', role: 'student', mustChangePassword: true }))
      throw new Error('expected the guard to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException)
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        code: 'password_change_required',
        message: 'Change your temporary password before continuing.',
      })
    }
  })

  it.each([
    ['public route', { public: true, allow: false }, { id: 'u1', mustChangePassword: true }],
    ['explicitly allowlisted route', { public: false, allow: true }, { id: 'u1', mustChangePassword: true }],
    ['account without the flag', { public: false, allow: false }, { id: 'u1', mustChangePassword: false }],
    ['missing flag', { public: false, allow: false }, { id: 'u1' }],
  ])('allows %s', (_label, metadata, user) => {
    expect(guardFor(metadata).canActivate(context(user))).toBe(true)
  })

  it('allowlists exactly the forced-change routes and no classroom mutations', () => {
    const allowed = [
      AuthController.prototype.getProfile,
      AuthController.prototype.logout,
      AuthController.prototype.privacyNotice,
      AuthController.prototype.acceptPrivacyConsent,
      AuthController.prototype.changePassword,
    ]
    for (const handler of allowed) {
      expect(Reflect.getMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, handler)).toBe(true)
    }

    expect(Reflect.getMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, UsersController.prototype.findAll)).toBeUndefined()
    expect(
      Reflect.getMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, AuthController.prototype.provisionKey),
    ).toBeUndefined()
  })
})
