import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { compare } from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import type { User } from '@prisma/client'
import { BetterAuthService } from './better-auth.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

const DUMMY_HASH = '$2a$10$R9h/lIPzMRgGq1V468UTuOr.164R5.h2.4yXG5Wv4Jz/aGv1Vv8a.'
const LOGIN_RATE_LIMIT = 10
const LOGIN_IP_RATE_LIMIT = 30
const LOGIN_RATE_WINDOW = 60

export interface AuthResult {
  token?: string
  headers: Headers
  user: {
    id: string
    fullName: string
    email?: string | null
    studentId?: string | null
    role: string
    program?: string | null
    yearLevel?: number | null
    department?: string | null
    photoUrl?: string | null
    scope?: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private betterAuth: BetterAuthService,
    private events: EventEmitter2,
  ) {}

  async loginStudent(
    studentId: string,
    password: string,
    clientAddress = 'unknown',
    headers = new Headers(),
  ): Promise<AuthResult> {
    const normalizedStudentId = studentId.trim().toUpperCase()
    await this.assertLoginWithinLimit('student', normalizedStudentId, clientAddress)

    const user = await this.prisma.user.findUnique({ where: { studentId: normalizedStudentId } })
    const isValidPassword = await compare(password, user?.password ?? DUMMY_HASH)

    if (!user || !isValidPassword) {
      throw new UnauthorizedException('Invalid student ID or password')
    }

    if (user.role !== 'student') {
      throw new ForbiddenException('Account is not a student')
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled')
    }

    return this.createSession(user, password, headers)
  }

  async loginFaculty(
    email: string,
    password: string,
    clientAddress = 'unknown',
    headers = new Headers(),
  ): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase()
    await this.assertLoginWithinLimit('faculty', normalizedEmail, clientAddress)

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } })
    const isValidPassword = await compare(password, user?.password ?? DUMMY_HASH)

    if (!user || !isValidPassword) {
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.role === 'student') {
      throw new ForbiddenException('Use student login instead')
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled')
    }

    return this.createSession(user, password, headers)
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return this.sanitizeUser(user)
  }

  async provisionKey(userId: string, publicKey: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.user.update({
      where: { id: userId },
      data: { teacherPublicKey: publicKey },
    })

    return { message: 'Public key provisioned successfully' }
  }

  async logout(headers: Headers) {
    const result = await this.betterAuth.auth.api.signOut({ headers, returnHeaders: true })
    return { message: 'Logged out successfully', headers: result.headers }
  }

  private async createSession(user: User, password: string, headers: Headers): Promise<AuthResult> {
    try {
      const result = await this.betterAuth.auth.api.signInEmail({
        body: { email: user.authEmail, password, rememberMe: true },
        headers,
        returnHeaders: true,
      })
      this.events.emit('auth.session-replaced', { userId: user.id, reason: 'new_login' })
      return {
        token: result.headers.get('set-auth-token') ?? undefined,
        headers: result.headers,
        user: this.sanitizeUser(user),
      }
    } catch {
      throw new UnauthorizedException('Invalid credentials')
    }
  }

  private async assertLoginWithinLimit(kind: 'student' | 'faculty', identifier: string, clientAddress: string) {
    const address = clientAddress || 'unknown'
    const [identityAllowed, addressAllowed] = await Promise.all([
      this.redis.consumeRateLimit(
        `login:${kind}:identity:${identifier}:${address}`,
        LOGIN_RATE_LIMIT,
        LOGIN_RATE_WINDOW,
      ),
      this.redis.consumeRateLimit(`login:${kind}:ip:${address}`, LOGIN_IP_RATE_LIMIT, LOGIN_RATE_WINDOW),
    ])
    if (!identityAllowed || !addressAllowed) {
      throw new HttpException('Too many login attempts. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      studentId: user.studentId,
      role: user.role,
      program: user.program,
      yearLevel: user.yearLevel,
      department: user.department,
      photoUrl: user.photoUrl,
      scope: user.scope,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
