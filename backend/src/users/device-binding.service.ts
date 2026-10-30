import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { effectivePermission, type DelegatedTeacherPermissions } from '@polycheck/shared'
import type { Prisma } from '../prisma/client'
import { ErrorCode } from '../common/constants/error-codes'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'

const COOLDOWN_MINUTE_MS = 60_000
const COOLDOWN_HOUR_MS = 3_600_000

/**
 * Owns the student mobile device-binding lifecycle:
 *  - reject mobile logins/scans while a self-service cooldown is active;
 *  - lazily bind an installation id on successful login/scan (write-on-change);
 *  - arm the cooldown and revoke sessions on self-service unregister;
 *  - resolve a teacher's effective delegated capabilities.
 *
 * Web cookie sessions are intentionally exempt: students may always access the
 * dashboard from a laptop, and device locking only gates the mobile app.
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

  /** Authoritative mobile-login gate. Staff accounts are never device-locked. */
  async assertMobileLoginAllowed(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, boundDeviceId: true, deviceCooldownUntil: true },
    })
    if (!user || user.role !== 'student') return
    this.assertCooldownInactive(user.deviceCooldownUntil)
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
   * Self-service unregister. Clears the binding, revokes every session
   * (including the calling device), and arms the cooldown. A repeated call
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

  private isCooldownActive(until: Date | null): boolean {
    return until !== null && until.getTime() > Date.now()
  }

  private assertCooldownInactive(until: Date | null): void {
    if (!this.isCooldownActive(until)) return
    const remainingMinutes = Math.max(1, Math.ceil((until!.getTime() - Date.now()) / COOLDOWN_MINUTE_MS))
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ErrorCode.DEVICE_COOLDOWN_ACTIVE,
      message: 'This account is locked while a device change cools down. Ask your instructor for an emergency release.',
      remainingMinutes,
    })
  }
}
