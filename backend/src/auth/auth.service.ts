import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import { createHash } from 'crypto'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import type { User } from '../prisma/client'
import { BetterAuthService } from './better-auth.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DUMMY_PASSWORD_HASH, PASSWORD_HASH_COST } from './password-policy'
import { ConfigService } from '@nestjs/config'
import type { ChangePasswordDto } from './dto/change-password.dto'
import { NotificationsService } from '../notifications/notifications.service'
import { DeviceBindingService } from '../users/device-binding.service'
import type { DelegatedTeacherPermissions } from '@polycheck/shared'

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
// Password changes are rate limited per account (default 5/15 minutes) to
// prevent online guessing even from an already-authenticated session.
const PASSWORD_CHANGE_RATE_LIMIT = positiveInt(process.env.PASSWORD_CHANGE_RATE_LIMIT, 5)
const PASSWORD_CHANGE_RATE_WINDOW_SECONDS = positiveInt(process.env.PASSWORD_CHANGE_RATE_WINDOW_SECONDS, 900)
// Cache-hygiene lease only. Scan validation always reads the PostgreSQL key,
// so lease expiry cannot make a stale Redis key authoritative.
const KEY_ROTATION_LOCK_TTL_SECONDS = 10

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
    mustChangePassword: boolean
    createdAt: Date
    updatedAt: Date
    privacyConsentVersion?: string | null
    privacyConsentedAt?: Date | null
    boundDeviceId?: string | null
    deviceBoundAt?: Date | null
    deviceCooldownUntil?: Date | null
    contactEmail?: string | null
    contactPhone?: string | null
    canResetStudentPasswords?: boolean | null
    canEmergencyUnbindDevices?: boolean | null
    delegatedPermissions?: DelegatedTeacherPermissions
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
    private config: ConfigService,
    @Optional() private notifications?: NotificationsService,
    @Optional() private deviceBinding?: DeviceBindingService,
  ) {}

  privacyNotice() {
    return {
      version: this.config.getOrThrow<string>('PRIVACY_NOTICE_VERSION'),
      url: this.config.getOrThrow<string>('PRIVACY_NOTICE_URL'),
      summary:
        'Polycheck stores attendance time, classroom location evidence, device installation identity, client-reported device-integrity evidence, and scan risk signals to verify attendance and investigate disputes. Access is role-scoped, and retention is limited by institutional policy.',
    }
  }

  async acceptPrivacyConsent(userId: string, version: string) {
    const notice = this.privacyNotice()
    if (version !== notice.version) {
      throw new ForbiddenException('The current privacy notice must be accepted')
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { privacyConsentVersion: notice.version, privacyConsentedAt: new Date() },
    })
    return this.sanitizeUser(user)
  }

  async loginStudent(
    studentId: string,
    password: string,
    clientAddress = 'unknown',
    headers = new Headers(),
    mobile?: { channel: 'mobile'; deviceId?: string },
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

    // Reject before creating a session: Better Auth would replace the active
    // session on login, and a cooldown rejection must not sign the student out
    // of a still-valid device.
    if (mobile?.channel === 'mobile') {
      await this.deviceBinding?.assertMobileLoginAllowed(user.id)
    }

    const result = await this.createSession(user, password, headers)
    if (mobile?.channel === 'mobile') {
      try {
        await this.deviceBinding?.registerBinding(user.id, mobile.deviceId, user.role)
      } catch (error) {
        // Binding is a security hardening layer; a transient failure must not
        // turn a successful credential check into a failed login.
        this.logger.warn(
          `Could not bind device for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    return result
  }

  async loginFaculty(
    email: string,
    password: string,
    clientAddress = 'unknown',
    headers = new Headers(),
    mobile?: { channel: 'mobile' },
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

    // Staff accounts are never device-locked; the mobile flag only documents
    // the caller for future policy hooks.
    void mobile
    const result = await this.createSession(user, password, headers)
    return this.withDelegatedPermissions(result, user)
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    const sanitized = this.sanitizeUser(user)
    if (user.role !== 'teacher' || !this.deviceBinding) return sanitized
    try {
      const delegatedPermissions = await this.deviceBinding.getEffectiveTeacherPermissions(user.id)
      return { ...sanitized, delegatedPermissions }
    } catch (error) {
      this.logger.warn(
        `Could not resolve delegated permissions for ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return sanitized
    }
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

    const lockKey = `key-rotation:${userId}`
    const lockToken = await this.redis.acquireLock(lockKey, KEY_ROTATION_LOCK_TTL_SECONDS)
    if (!lockToken) {
      throw new HttpException('Signing key rotation is already in progress. Try again shortly.', HttpStatus.CONFLICT)
    }
    let previousKey: string | null
    try {
      // Read only after acquiring the lease. In particular, first provisioning
      // must observe and clean up a key concurrently installed by another node.
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new NotFoundException('User not found')
      previousKey = user.teacherPublicKey
      await this.prisma.user.update({
        where: { id: userId },
        data: { teacherPublicKey: publicKey },
      })
      await this.invalidateActiveSessionCaches(userId)
    } finally {
      await this.releaseRotationLock(lockKey, lockToken)
    }

    this.logger.log(
      `Signing key provisioned for user ${userId} (previous key: ${previousKey ? 'replaced' : 'first provision'})`,
    )
    this.events.emit('auth.key-provisioned', { userId, hadPreviousKey: !!previousKey })
    await this.notifications?.notify(userId, {
      type: 'key_provisioned',
      title: 'Signing key provisioned',
      body: 'A new QR signing key is now active on your teacher account.',
      link: '/faculty',
    })

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

    const lockKey = `key-rotation:${userId}`
    const lockToken = await this.redis.acquireLock(lockKey, KEY_ROTATION_LOCK_TTL_SECONDS)
    if (!lockToken) {
      throw new HttpException('Signing key rotation is already in progress. Try again shortly.', HttpStatus.CONFLICT)
    }
    let fingerprint: string | null = null
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, teacherPublicKey: true },
      })
      if (!user) throw new NotFoundException('User not found')
      if (!user.teacherPublicKey) {
        return { revoked: false, message: 'No signing key is currently provisioned' }
      }
      fingerprint = createHash('sha256').update(user.teacherPublicKey).digest('hex')
      await this.prisma.user.update({
        where: { id: userId },
        data: { teacherPublicKey: null },
      })
      await this.invalidateActiveSessionCaches(userId)
    } finally {
      await this.releaseRotationLock(lockKey, lockToken)
    }

    this.events.emit('auth.key-revoked', { userId, fingerprint })
    this.logger.warn(`Signing key revoked for user ${userId} (fingerprint ${fingerprint!.slice(0, 12)})`)
    return { revoked: true, message: 'Signing key revoked. Provision a new key before generating QR tokens.' }
  }

  async logout(headers: Headers) {
    const result = await this.betterAuth.auth.api.signOut({ headers, returnHeaders: true })
    return { message: 'Logged out successfully', headers: result.headers }
  }

  /**
   * Rotates the credential password and clears the forced-change flag. The
   * `authVersion` is bumped and the invoking session's generation is advanced
   * in the same transaction: stale sessions (any other device) fail the
   * generation check immediately while the current session survives.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, authSessionId?: string) {
    const withinLimit = await this.redis.consumeRateLimit(
      `auth:change-password:${userId}`,
      PASSWORD_CHANGE_RATE_LIMIT,
      PASSWORD_CHANGE_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many password change attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, mustChangePassword: true },
    })
    if (!user) throw new NotFoundException('User not found')

    if (dto.currentPassword) {
      const valid = await compare(dto.currentPassword, user.password)
      if (!valid) throw new UnauthorizedException('Current password is incorrect')
    } else if (!user.mustChangePassword) {
      throw new BadRequestException('Current password is required to change your password')
    }

    const passwordHash = await hash(dto.newPassword, PASSWORD_HASH_COST)
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { password: passwordHash, mustChangePassword: false, authVersion: { increment: 1 } },
        select: { authVersion: true },
      })
      await tx.authAccount.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: userId } },
        update: { password: passwordHash, updatedAt: now },
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      })
      if (authSessionId) {
        await tx.authSession.updateMany({
          where: { id: authSessionId, userId },
          data: { generation: updated.authVersion },
        })
      }
      // Keep the session that performed the rotation, revoke every other one.
      await tx.authSession.deleteMany({
        where: { userId, ...(authSessionId ? { id: { not: authSessionId } } : {}) },
      })
    })

    return this.getProfile(userId)
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

  private async invalidateActiveSessionCaches(userId: string) {
    try {
      const activeSessions = await this.prisma.session.findMany({
        where: { teacherId: userId, isActive: true },
        select: { id: true },
      })
      const results = await Promise.allSettled(
        activeSessions.map((session) => this.redis.delete(`active-session:${session.id}`)),
      )
      const failed = results.filter((result) => result.status === 'rejected' || !result.value).length
      if (failed > 0) {
        // Key validity is DB-authoritative; failed deletes only reduce cache
        // freshness and must not roll back or misreport a committed key change.
        this.logger.warn(`Could not distribute ${failed} active-session cache invalidation(s) for user ${userId}`)
      }
    } catch (error) {
      this.logger.warn(
        `Could not enumerate active-session caches for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async releaseRotationLock(lockKey: string, lockToken: string) {
    try {
      const released = await this.redis.releaseLock(lockKey, lockToken)
      if (!released) this.logger.warn(`Signing key rotation lock ${lockKey} was no longer owned at cleanup`)
    } catch (error) {
      // The lock has a short TTL. Cleanup failure must never turn a committed
      // key mutation into an apparent API failure that encourages retries.
      this.logger.error(
        `Failed to release signing key rotation lock ${lockKey}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async withDelegatedPermissions(result: AuthResult, user: User): Promise<AuthResult> {
    if (user.role !== 'teacher' || !this.deviceBinding) return result
    try {
      const delegatedPermissions = await this.deviceBinding.getEffectiveTeacherPermissions(user.id)
      return { ...result, user: { ...result.user, delegatedPermissions } }
    } catch (error) {
      this.logger.warn(
        `Could not resolve delegated permissions for ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return result
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
      mustChangePassword: user.mustChangePassword,
      privacyConsentVersion: user.privacyConsentVersion,
      privacyConsentedAt: user.privacyConsentedAt,
      boundDeviceId: user.boundDeviceId,
      deviceBoundAt: user.deviceBoundAt,
      deviceCooldownUntil: user.deviceCooldownUntil,
      contactEmail: user.contactEmail,
      contactPhone: user.contactPhone,
      canResetStudentPasswords: user.canResetStudentPasswords,
      canEmergencyUnbindDevices: user.canEmergencyUnbindDevices,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
