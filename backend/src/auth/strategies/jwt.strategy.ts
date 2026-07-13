import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

export interface RequestUser {
  id: string
  role: string
  email?: string
  studentId?: string
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
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const account = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isActive: true, authVersion: true } })
    if (!account?.isActive || account.authVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('This session was replaced by a newer login')
    }
    return {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
      studentId: payload.studentId,
    }
  }
}
