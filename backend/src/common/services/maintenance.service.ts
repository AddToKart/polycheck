import { Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { clampRetentionDays } from '@polycheck/shared'
import { RedisService } from '../../infrastructure/redis.service'
import { Prisma } from '../../prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { SessionPermissionsService } from '../../session-permissions/session-permissions.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { SettingsService } from '../../settings/settings.service'
import { GEOLOCATION_RETENTION_DAYS_KEY, type PrivacyShredRecord } from '../constants/privacy'
import { ledgerDateOf } from '@polycheck/shared/ledger'

const EXPIRE_PERMISSIONS_LOCK_TTL_SECONDS = 2 * 60 * 60
const PRUNE_SCAN_ATTEMPTS_LOCK_TTL_SECONDS = 25 * 60 * 60
const LEDGER_ANCHOR_LOCK_TTL_SECONDS = 25 * 60 * 60
const SHRED_TELEMETRY_LOCK_TTL_SECONDS = 25 * 60 * 60
const SCAN_ATTEMPT_PRUNE_BATCH_SIZE = 1_000
const AUDIT_LOG_PRUNE_BATCH_SIZE = 1_000
const SHRED_TELEMETRY_BATCH_SIZE = 1_000
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function completedUtcDayWindow(now: Date) {
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowStart = new Date(windowEnd.getTime() - MS_PER_DAY)
  return { date: ledgerDateOf(windowStart), windowStart, windowEnd }
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: SessionPermissionsService,
    private readonly redis: RedisService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly notifications?: NotificationsService,
    // Optional only for legacy unit specs that construct the service directly;
    // production always injects it (MaintenanceModule imports SettingsModule).
    @Optional() private readonly settings?: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { waitForCompletion: true })
  async expireStalePermissions() {
    await this.runLockedJob(
      'maintenance:expire-stale-permissions',
      EXPIRE_PERMISSIONS_LOCK_TTL_SECONDS,
      async () => {
        const count = await this.permissions.expireStale()
        if (count > 0) this.logger.log(`Expired ${count} stale session permissions`)
      },
      'expire stale permissions',
    )
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { waitForCompletion: true })
  async pruneScanAttempts() {
    await this.runLockedJob(
      'maintenance:prune-scan-attempts',
      PRUNE_SCAN_ATTEMPTS_LOCK_TTL_SECONDS,
      async () => {
        const retentionDays = this.config?.get<number>('DENIED_SCAN_RETENTION_DAYS') ?? 90
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        let pruned = 0
        while (true) {
          const attempts = await this.prisma.scanAttempt.findMany({
            where: {
              createdAt: { lt: cutoff },
              outcome: 'denied',
              acceptedAttendanceRecord: { is: null },
            },
            select: { id: true },
            orderBy: { id: 'asc' },
            take: SCAN_ATTEMPT_PRUNE_BATCH_SIZE,
          })
          if (attempts.length === 0) break
          const result = await this.prisma.scanAttempt.deleteMany({
            where: {
              id: { in: attempts.map((attempt) => attempt.id) },
              acceptedAttendanceRecord: { is: null },
            },
          })
          pruned += result.count
          if (attempts.length < SCAN_ATTEMPT_PRUNE_BATCH_SIZE) break
        }
        if (pruned > 0)
          this.logger.log(`Pruned ${pruned} unlinked denied scan attempts older than ${retentionDays} days`)
      },
      'prune scan attempts',
    )
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { waitForCompletion: true })
  async pruneAuditLogs() {
    await this.runLockedJob(
      'maintenance:prune-audit-logs',
      PRUNE_SCAN_ATTEMPTS_LOCK_TTL_SECONDS,
      async () => {
        const retentionDays = this.config?.get<number>('AUDIT_LOG_RETENTION_DAYS') ?? 2555
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        let pruned = 0
        while (true) {
          const logs = await this.prisma.auditLog.findMany({
            where: { createdAt: { lt: cutoff } },
            select: { id: true },
            orderBy: { id: 'asc' },
            take: AUDIT_LOG_PRUNE_BATCH_SIZE,
          })
          if (logs.length === 0) break
          const result = await this.prisma.auditLog.deleteMany({ where: { id: { in: logs.map((log) => log.id) } } })
          pruned += result.count
          if (logs.length < AUDIT_LOG_PRUNE_BATCH_SIZE) break
        }
        if (pruned > 0) this.logger.log(`Pruned ${pruned} audit logs older than ${retentionDays} days`)
      },
      'prune audit logs',
    )
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { waitForCompletion: true })
  async pruneNotifications() {
    await this.runLockedJob(
      'maintenance:prune-notifications',
      PRUNE_SCAN_ATTEMPTS_LOCK_TTL_SECONDS,
      async () => {
        const pruned = (await this.notifications?.pruneExpired(30)) ?? 0
        if (pruned > 0) this.logger.log(`Pruned ${pruned} notifications older than 30 days`)
      },
      'prune notifications',
    )
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'UTC', waitForCompletion: true })
  async anchorAttendanceLedger() {
    await this.runLockedJob(
      'maintenance:anchor-attendance-ledger',
      LEDGER_ANCHOR_LOCK_TTL_SECONDS,
      async () => {
        // Anchor the completed UTC day, independent of the host timezone.
        const { date, windowStart, windowEnd } = completedUtcDayWindow(new Date())
        const head = await this.prisma.attendanceRecord.findFirst({
          where: { recordHash: { not: null }, timestamp: { gte: windowStart, lt: windowEnd } },
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
          select: { id: true, sessionId: true, recordHash: true },
        })
        if (!head?.recordHash) {
          this.logger.log(`No chained attendance records to anchor for ${date}`)
          return
        }
        const recordsCounted = await this.prisma.attendanceRecord.count({
          where: { recordHash: { not: null }, timestamp: { gte: windowStart, lt: windowEnd } },
        })
        await this.prisma.auditLog.create({
          data: {
            actorId: 'system',
            actorRole: 'system',
            action: 'ledger.anchored',
            entityType: 'ledger',
            metadata: {
              date,
              lastRecordHash: head.recordHash,
              recordsCounted,
              sessionId: head.sessionId,
              recordId: head.id,
            },
          },
        })
        this.logger.log(`Anchored ${recordsCounted} attendance records for ${date}`)
      },
      'anchor the attendance ledger',
    )
  }

  /**
   * F6 (WF-LD8): nightly RA 10173 telemetry shredder. Nulls the ephemeral
   * geolocation columns of everything older than the retention window while
   * leaving every attendance-decisional field untouched — status, distance,
   * outcome, dispute and excuse metadata keep their values, so a shredded row
   * remains fully decidable in dispute review.
   *
   * Denied-attempt *rows* keep rotating on the existing prune job; this job
   * only blanks their location columns, never deletes them.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { waitForCompletion: true })
  async shredEphemeralTelemetry() {
    await this.runLockedJob(
      'maintenance:shred-ephemeral-telemetry',
      SHRED_TELEMETRY_LOCK_TTL_SECONDS,
      async () => {
        const retentionDays = await this.shredRetentionDays()
        const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY)
        const recordsShredded = await this.shredAttendanceRecordCoordinates(cutoff)
        const attemptsShredded = await this.shredScanAttemptCoordinates(cutoff)
        const summary: PrivacyShredRecord = {
          lastRunAt: new Date().toISOString(),
          recordsShredded,
          attemptsShredded,
        }
        // Best-effort publication order (fail-open inside): static copy first
        // (the DB-free fallback), then the 48 h Redis mirror.
        await this.settings?.recordPrivacyShredRun(summary)
        this.logger.log(
          `Shredded ephemeral geolocation telemetry older than ${retentionDays} days: ` +
            `${recordsShredded} attendance record(s), ${attemptsShredded} scan attempt(s)`,
        )
      },
      'shred ephemeral telemetry',
    )
  }

  /** Retention window from the institution setting, clamped to 7–90 (fallback 30). */
  private async shredRetentionDays(): Promise<number> {
    try {
      const configured = await this.settings?.getInteger(GEOLOCATION_RETENTION_DAYS_KEY, 30)
      return clampRetentionDays(configured ?? 30)
    } catch {
      return 30
    }
  }

  /**
   * Nulls `latitude`/`longitude` on attendance records older than the cutoff,
   * in bounded batches. Rows that were never geotagged (hybrid online scans)
   * are not selected, which keeps batch progress monotonic and the counts
   * honest — the counter reports rows that actually carried coordinates.
   */
  private async shredAttendanceRecordCoordinates(cutoff: Date): Promise<number> {
    let shredded = 0
    while (true) {
      const rows = await this.prisma.attendanceRecord.findMany({
        where: {
          timestamp: { lt: cutoff },
          OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: SHRED_TELEMETRY_BATCH_SIZE,
      })
      if (rows.length === 0) break
      const result = await this.prisma.attendanceRecord.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { latitude: null, longitude: null },
      })
      shredded += result.count
      if (rows.length < SHRED_TELEMETRY_BATCH_SIZE) break
    }
    return shredded
  }

  /**
   * Nulls coordinates, accuracy, and risk signals on scan attempts older than
   * the cutoff. `distanceMeters`/`geofenceRadiusMeters`/outcome/dispute
   * evidence are deliberately kept — they are the decisional metadata dispute
   * reviews rely on. Attempts are only ever blanked here, never deleted.
   */
  private async shredScanAttemptCoordinates(cutoff: Date): Promise<number> {
    let shredded = 0
    while (true) {
      const rows = await this.prisma.scanAttempt.findMany({
        where: {
          timestamp: { lt: cutoff },
          OR: [
            { latitude: { not: null } },
            { longitude: { not: null } },
            { accuracyMeters: { not: null } },
            { riskSignals: { not: Prisma.AnyNull } },
          ],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: SHRED_TELEMETRY_BATCH_SIZE,
      })
      if (rows.length === 0) break
      const result = await this.prisma.scanAttempt.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: {
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          // Nullable JSON columns require the Prisma DbNull sentinel to write a SQL NULL.
          riskSignals: Prisma.DbNull,
        },
      })
      shredded += result.count
      if (rows.length < SHRED_TELEMETRY_BATCH_SIZE) break
    }
    return shredded
  }

  private async runLockedJob(lockKey: string, ttlSeconds: number, job: () => Promise<void>, description: string) {
    let ownershipToken: string | null = null
    try {
      ownershipToken = await this.redis.acquireLock(lockKey, ttlSeconds)
      if (!ownershipToken) return
      await job()
    } catch (error) {
      this.logger.error(`Failed to ${description}: ${error instanceof Error ? error.message : 'unknown'}`)
    } finally {
      if (ownershipToken) {
        try {
          await this.redis.releaseLock(lockKey, ownershipToken)
        } catch (error) {
          this.logger.error(
            `Failed to release ${description} lock: ${error instanceof Error ? error.message : 'unknown'}`,
          )
        }
      }
    }
  }
}
