import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import type { UserRole } from '@prisma/client'

export interface RequestUser {
  id: string
  role: UserRole
  email?: string | null
  studentId?: string | null
  department?: string | null
  scope?: string | null
}

interface JwtPayload {
  sub: string
  role: string
  email?: string
  studentId?: string
  sessionVersion: number
  iat: number
  exp: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { headers?: { cookie?: string } }) => {
          const cookie = request?.headers?.cookie
          if (!cookie) return null
          const value = cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('polycheck_access='))
            ?.slice('polycheck_access='.length)
          if (!value) return null
          try {
            return decodeURIComponent(value)
          } catch {
            return null
          }
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
    })
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        isActive: true,
        authVersion: true,
        role: true,
        email: true,
        studentId: true,
        department: true,
        scope: true,
      },
    })
    if (!account?.isActive || account.authVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('This session was replaced by a newer login')
    }
    return {
      id: payload.sub,
      role: account.role,
      email: account.email,
      studentId: account.studentId,
      department: account.department,
      scope: account.scope,
    }
  }
}
