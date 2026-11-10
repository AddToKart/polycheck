import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { effectivePermission, type ActiveDeviceKind, type DelegatedTeacherPermissions } from '@polycheck/shared'
import type { Prisma } from '../prisma/client'
import { ErrorCode } from '../common/constants/error-codes'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'

const COOLDOWN_MINUTE_MS = 60_000
const COOLDOWN_HOUR_MS = 3_600_000

/**
 * Owns the student device-integrity lifecycle:
 *  - reject logins while a logout-armed cooldown applies to another device;
 *  - reject logins while the account is already signed in on another device;
 *  - stamp the created auth session with the device that holds it and purge
 *    stale duplicate sessions for that same device;
 *  - lazily bind an installation id on successful mobile login/scan;
 *  - arm the cooldown on self-service unregister and on student logout;
 *  - resolve a teacher's effective delegated capabilities.
 *
 * Staff accounts are never device-locked: teachers and super admins may hold
 * concurrent sessions (dashboard beside the mobile scanner).
 */
@Injectable()
export class DeviceBindingService {
  private readonly logger = new Logger(DeviceBindingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Effective per-teacher capabilities after merging overrides + policy. */
  async getEffectiveTeacherPermissions(teacherId: string): Promise<DelegatedTeacherPermissions> {
    const [teacher, policies] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: teacherId },
        select: { canResetStudentPasswords: true, canEmergencyUnbindDevices: true },
      }),
      this.settings.getTeacherDelegationPolicies(),
    ])
    return {
      canResetStudentPasswords: effectivePermission(teacher?.canResetStudentPasswords, policies.teacherPasswordReset),
      canEmergencyUnbindDevices: effectivePermission(
        teacher?.canEmergencyUnbindDevices,
        policies.teacherEmergencyUnbind,
      ),
    }
  }

  /**
   * Authoritative login gate for every channel. Staff accounts always pass.
   * Students must clear the cooldown exemption first and then prove that no
   * other device currently holds the account. A null/unknown attempt device is
   * only accepted when no active session exists (fail closed otherwise).
   */
  async assertLoginAllowed(userId: string, deviceId: string | null | undefined): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, authVersion: true, deviceCooldownUntil: true, cooldownDeviceId: true },
    })
    if (!user || user.role !== 'student') return

    const attemptedDeviceId = normalizeDeviceId(deviceId)
    this.assertCooldownAllows(user.deviceCooldownUntil, user.cooldownDeviceId, attemptedDeviceId)
    await this.assertNoActiveSessionElsewhere(userId, user.authVersion, attemptedDeviceId)
  }

  /**
   * Defensive scan gate. Unregister clears the binding and revokes sessions, so
   * a cooled student normally cannot reach this path; this protects against
   * sessions created before the unregister committed or manual DB edits.
   */
  async assertScanAllowed(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, boundDeviceId: true, deviceCooldownUntil: true },
    })
    if (!user || user.role !== 'student' || user.boundDeviceId) return
    this.assertCooldownInactive(user.deviceCooldownUntil)
  }

  /**
   * Stamps the freshly created auth session with the device that holds it and
   * purges stale sessions from that same device so re-logins do not accumulate
   * rows. The purge never targets the stamped row. Called from the Better Auth
   * session-create hook; failures are logged because the login already
   * succeeded and a transient stamping fault must not surface as a failed
   * request (the session simply keeps the legacy null-device behavior).
   */
  async stampLoginSession(userId: string, deviceId: string, sessionId?: string): Promise<void> {
    const normalized = normalizeDeviceId(deviceId)
    if (!normalized) return
    try {
      await this.prisma.$transaction(async (tx) => {
        const targetId =
          sessionId ??
          (
            await tx.authSession.findFirst({
              where: { userId },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              select: { id: true },
            })
          )?.id
        if (!targetId) return
        await tx.authSession.update({ where: { id: targetId }, data: { deviceId: normalized } })
        await tx.authSession.deleteMany({
          where: { userId, deviceId: normalized, id: { not: targetId } },
        })
      })
    } catch (error) {
      this.logger.warn(
        `Could not stamp device ${normalized} on a session for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * Binds the caller's installation id to a student account. Called on mobile
   * login success and on accepted scans; write-on-change keeps scans cheap and
   * idempotent. Never binds while a cooldown is active (login is already
   * rejected there; scans simply skip binding).
   */
  async registerBinding(userId: string, deviceId: string | null | undefined, role: string): Promise<void> {
    if (role !== 'student' || !deviceId) return
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { boundDeviceId: true, deviceCooldownUntil: true },
    })
    if (!user) return
    if (user.boundDeviceId === deviceId) return
    if (this.isCooldownActive(user.deviceCooldownUntil)) return
    await this.prisma.user.update({
      where: { id: userId },
      data: { boundDeviceId: deviceId, deviceBoundAt: new Date() },
    })
  }

  /**
   * Arms the logout cooldown for a student. A device id is required to arm:
   * the device that logged out stays exempt (same-device re-login is instant),
   * while absent/blank ids never arm — a device-agnostic cooldown would block
   * every device with no exempt device. Callers opt out entirely for
   * programmatic/forced logouts via `armDeviceCooldown: false`.
   */
  async armLogoutCooldown(
    userId: string,
    role: string,
    deviceId: string | null | undefined,
    ipAddress?: string,
  ): Promise<{ cooldownHours: number; cooldownUntil: Date } | null> {
    if (role !== 'student') return null
    const exemptDeviceId = normalizeDeviceId(deviceId)
    if (!exemptDeviceId) return null
    const policies = await this.settings.getTeacherDelegationPolicies()
    const proposed = new Date(Date.now() + policies.deviceCooldownHours * COOLDOWN_HOUR_MS)
    const cooldownUntil = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { deviceCooldownUntil: true },
      })
      if (!user) return null
      const until =
        user.deviceCooldownUntil && user.deviceCooldownUntil.getTime() > proposed.getTime()
          ? user.deviceCooldownUntil
          : proposed
      await tx.user.update({
        where: { id: userId },
        data: { deviceCooldownUntil: until, cooldownDeviceId: exemptDeviceId },
      })
      return until
    })
    if (!cooldownUntil) return null

    await this.recordAudit(userId, 'student', 'student.device_cooldown_armed', userId, {
      deviceId: exemptDeviceId,
      cooldownHours: policies.deviceCooldownHours,
      cooldownUntil: cooldownUntil.toISOString(),
      reason: 'logout',
      ipAddress: ipAddress ?? null,
    })
    return { cooldownHours: policies.deviceCooldownHours, cooldownUntil }
  }

  /**
   * Self-service unregister. Clears the binding, revokes every session
   * (including the calling device), and arms the cooldown. The unregistering
   * device is exempt so it can immediately register again. A repeated call
   * extends — never shortens — an existing cooldown.
   */
  async unregisterStudentDevice(
    userId: string,
    deviceId: string | undefined,
    ipAddress?: string,
  ): Promise<{ cooldownHours: number; cooldownUntil: Date }> {
    const policies = await this.settings.getTeacherDelegationPolicies()
    const cooldown = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, deviceCooldownUntil: true },
      })
      if (!user) throw new NotFoundException('User not found')
      if (user.role !== 'student') {
        throw new BadRequestException('Only student accounts bind mobile devices')
      }
      const proposed = new Date(Date.now() + policies.deviceCooldownHours * COOLDOWN_HOUR_MS)
      const cooldownUntil =
        user.deviceCooldownUntil && user.deviceCooldownUntil.getTime() > proposed.getTime()
          ? user.deviceCooldownUntil
          : proposed
      await tx.user.update({
        where: { id: userId },
        data: {
          boundDeviceId: null,
          deviceBoundAt: null,
          deviceCooldownUntil: cooldownUntil,
          cooldownDeviceId: normalizeDeviceId(deviceId),
        },
      })
      await tx.authSession.deleteMany({ where: { userId } })
      return { cooldownUntil, cooldownHours: policies.deviceCooldownHours }
    })

    await this.recordAudit(userId, 'student', 'student.device_unregister', userId, {
      deviceId: deviceId ?? null,
      cooldownHours: cooldown.cooldownHours,
      cooldownUntil: cooldown.cooldownUntil.toISOString(),
      ipAddress: ipAddress ?? null,
    })
    return cooldown
  }

  /** Best-effort audit write; governance mutations must not 500 on audit faults. */
  private async recordAudit(
    actorId: string,
    actorRole: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, actorRole, action, entityType: 'user', entityId, metadata },
      })
    } catch (error) {
      this.logger.error(
        `Could not write ${action} audit row for actor ${actorId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private assertCooldownAllows(
    until: Date | null,
    exemptDeviceId: string | null,
    attemptedDeviceId: string | null,
  ): void {
    if (!this.isCooldownActive(until)) return
    if (attemptedDeviceId && exemptDeviceId && attemptedDeviceId === exemptDeviceId) return
    const remainingMs = Math.max(0, until!.getTime() - Date.now())
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ErrorCode.DEVICE_COOLDOWN_ACTIVE,
      message: 'This account is locked while a device change cools down. Ask your instructor for an emergency release.',
      remainingMinutes: Math.max(1, Math.ceil(remainingMs / COOLDOWN_MINUTE_MS)),
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    })
  }

  private async assertNoActiveSessionElsewhere(
    userId: string,
    authVersion: number,
    attemptedDeviceId: string | null,
  ): Promise<void> {
    const activeSessions = await this.prisma.authSession.findMany({
      where: { userId, expiresAt: { gt: new Date() }, generation: authVersion },
      select: { deviceId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (activeSessions.length === 0) return

    // A device-bearing attempt only loses to a different, known device; legacy
    // null-device sessions are grandfathered so they never lock anyone out.
    // An unidentified attempt cannot prove it is the holder, so it fails closed.
    const blocking = attemptedDeviceId
      ? activeSessions.find((session) => session.deviceId !== null && session.deviceId !== attemptedDeviceId)
      : activeSessions[0]
    if (!blocking) return

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ErrorCode.ACTIVE_SESSION_ELSEWHERE,
      message: attemptedDeviceId
        ? 'This account is currently signed in on another device. Log out from that device first, or ask your instructor for an emergency device release.'
        : 'This device could not be identified. Update the app or clear the site data, then try again. Your account is currently signed in.',
      activeDeviceKind: activeDeviceKindOf(blocking.deviceId),
      activeSessionLastActiveAt: blocking.updatedAt.toISOString(),
    })
  }

  private isCooldownActive(until: Date | null): boolean {
    return until !== null && until.getTime() > Date.now()
  }

  private assertCooldownInactive(until: Date | null): void {
    if (!this.isCooldownActive(until)) return
    this.assertCooldownAllows(until, null, null)
  }
}

function normalizeDeviceId(deviceId: string | null | undefined): string | null {
  const trimmed = deviceId?.trim()
  return trimmed ? trimmed : null
}

function activeDeviceKindOf(deviceId: string | null): ActiveDeviceKind | null {
  if (!deviceId) return null
  if (deviceId.startsWith('mobile-')) return 'mobile'
  if (deviceId.startsWith('web-')) return 'web'
  return null
}
