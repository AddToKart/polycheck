import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

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
  iat: number
  exp: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
      studentId: payload.studentId,
    }
  }
}
