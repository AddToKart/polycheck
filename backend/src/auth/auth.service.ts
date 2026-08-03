import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { compare } from 'bcryptjs'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import type { User } from '../prisma/client'
import { BetterAuthService } from './better-auth.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DUMMY_PASSWORD_HASH } from './password-policy'

// Login rate limits are env-tunable so strict production values can be relaxed for
// local development and E2E automation. Defaults: 10 attempts/identity/min, 30/IP/min.
const LOGIN_RATE_LIMIT = positiveInt(process.env.LOGIN_RATE_LIMIT, 10)
const LOGIN_IP_RATE_LIMIT = positiveInt(process.env.LOGIN_IP_RATE_LIMIT, 30)
const LOGIN_RATE_WINDOW = positiveInt(process.env.LOGIN_RATE_WINDOW_SECONDS, 60)
// Key provisioning is rate limited per teacher (default 3/hour) to deter key-rotation
// abuse. Also env-tunable for local development and E2E automation.
const KEY_PROVISION_RATE_LIMIT = positiveInt(process.env.KEY_PROVISION_RATE_LIMIT, 3)
const KEY_PROVISION_RATE_WINDOW = positiveInt(process.env.KEY_PROVISION_RATE_WINDOW_SECONDS, 3600)
// Key revocation is rate limited like provisioning (default 3/hour) to deter
// repeated revoke/flood abuse while still allowing a compromised key to be
// invalidated immediately.
const KEY_REVOKE_RATE_LIMIT = positiveInt(process.env.KEY_REVOKE_RATE_LIMIT, 3)

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

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
  private readonly logger = new Logger(AuthService.name)

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
    const isValidPassword = await compare(password, user?.password ?? DUMMY_PASSWORD_HASH)

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
    const isValidPassword = await compare(password, user?.password ?? DUMMY_PASSWORD_HASH)

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
    const withinLimit = await this.redis.consumeRateLimit(
      `auth:key-provision:${userId}`,
      KEY_PROVISION_RATE_LIMIT,
      KEY_PROVISION_RATE_WINDOW,
    )
    if (!withinLimit) {
      this.logger.warn(`Rate limited key provision attempt for user ${userId}`)
      throw new HttpException('Too many key provisioning attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    const previousKey = user.teacherPublicKey
    await this.prisma.user.update({
      where: { id: userId },
      data: { teacherPublicKey: publicKey },
    })

    this.logger.log(
      `Signing key provisioned for user ${userId} (previous key: ${previousKey ? 'replaced' : 'first provision'})`,
    )
    this.events.emit('auth.key-provisioned', { userId, hadPreviousKey: !!previousKey })

    return { message: 'Public key provisioned successfully' }
  }

  /**
   * Immediately invalidates the teacher's current signing key. All outstanding
   * QR tokens fail server-side signature verification until a new key is
   * provisioned. The revoked key's fingerprint is emitted for audit.
   */
  async revokeKey(userId: string) {
    const withinLimit = await this.redis.consumeRateLimit(
      `auth:key-revoke:${userId}`,
      KEY_REVOKE_RATE_LIMIT,
      KEY_PROVISION_RATE_WINDOW,
    )
    if (!withinLimit) {
      this.logger.warn(`Rate limited key revocation attempt for user ${userId}`)
      throw new HttpException('Too many key revocation attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teacherPublicKey: true },
    })
    if (!user) throw new NotFoundException('User not found')
    if (!user.teacherPublicKey) {
      return { revoked: false, message: 'No signing key is currently provisioned' }
    }

    const fingerprint = createHash('sha256').update(user.teacherPublicKey).digest('hex')
    await this.prisma.user.update({
      where: { id: userId },
      data: { teacherPublicKey: null },
    })

    // Invalidate cached active-session records for this teacher: scan
    // validation prefers the Redis-cached signing key, so without this the
    // revoked key would keep verifying QR tokens until the cache TTL expires.
    const activeSessions = await this.prisma.session.findMany({
      where: { teacherId: userId, isActive: true },
      select: { id: true },
    })
    await Promise.all(activeSessions.map((session) => this.redis.delete(`active-session:${session.id}`)))

    this.events.emit('auth.key-revoked', { userId, fingerprint })
    this.logger.warn(`Signing key revoked for user ${userId} (fingerprint ${fingerprint.slice(0, 12)})`)
    return { revoked: true, message: 'Signing key revoked. Provision a new key before generating QR tokens.' }
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
      this.redis.consumeRateLimit(`login:${kind}:identity:${identifier}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW),
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
