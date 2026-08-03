import { Injectable, UnauthorizedException } from '@nestjs/common'
import { BetterAuthService } from './better-auth.service'
import type { RequestUser } from './authenticated-principal'

/**
 * Resolves the authenticated principal from a single Better Auth getSession
 * call. The user/session fields needed for the app's security checks
 * (role, scope, department, isActive, authVersion, generation) are declared
 * as `additionalFields` in better-auth.service.ts so Better Auth returns them
 * with the session — no second DB round-trip per authenticated request.
 */
@Injectable()
export class SessionAuthenticator {
  constructor(private readonly betterAuth: BetterAuthService) {}

  async authenticate(headers: Headers): Promise<RequestUser> {
    const resolved = await this.betterAuth.auth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    })
    if (!resolved) throw new UnauthorizedException('Invalid or expired session')

    const { session, user } = resolved
    if (!user.isActive || session.generation !== user.authVersion) {
      throw new UnauthorizedException('This session was replaced by a newer login')
    }
    return {
      id: user.id,
      role: user.role as RequestUser['role'],
      email: user.email,
      studentId: user.studentId,
      department: user.department,
      scope: user.scope,
      authSessionId: session.id,
    }
  }
}
