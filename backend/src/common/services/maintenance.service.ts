import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { RedisService } from '../../infrastructure/redis.service'
import { PrismaService } from '../../prisma/prisma.service'
import { SessionPermissionsService } from '../../session-permissions/session-permissions.service'

const EXPIRE_PERMISSIONS_LOCK_TTL_SECONDS = 2 * 60 * 60
const PRUNE_SCAN_ATTEMPTS_LOCK_TTL_SECONDS = 25 * 60 * 60
const SCAN_ATTEMPT_PRUNE_BATCH_SIZE = 1_000

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: SessionPermissionsService,
    private readonly redis: RedisService,
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
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
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
        if (pruned > 0) this.logger.log(`Pruned ${pruned} unlinked denied scan attempts older than 90 days`)
      },
      'prune scan attempts',
    )
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
