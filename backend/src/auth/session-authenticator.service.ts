import { Injectable, UnauthorizedException } from '@nestjs/common'
import { BetterAuthService } from './better-auth.service'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from './authenticated-principal'

@Injectable()
export class SessionAuthenticator {
  constructor(
    private readonly betterAuth: BetterAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(headers: Headers): Promise<RequestUser> {
    const resolved = await this.betterAuth.auth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    })
    if (!resolved) throw new UnauthorizedException('Invalid or expired session')

    const session = await this.prisma.authSession.findUnique({
      where: { id: resolved.session.id },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            authVersion: true,
            role: true,
            email: true,
            studentId: true,
            department: true,
            scope: true,
          },
        },
      },
    })
    if (!session || !session.user.isActive || session.generation !== session.user.authVersion) {
      throw new UnauthorizedException('This session was replaced by a newer login')
    }
    return {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email,
      studentId: session.user.studentId,
      department: session.user.department,
      scope: session.user.scope,
      authSessionId: session.id,
    }
  }
}
