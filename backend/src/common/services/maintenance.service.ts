import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { SessionPermissionsService } from '../../session-permissions/session-permissions.service'

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: SessionPermissionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireStalePermissions() {
    try {
      const count = await this.permissions.expireStale()
      if (count > 0) this.logger.log(`Expired ${count} stale session permissions`)
    } catch (error) {
      this.logger.error(`Failed to expire stale permissions: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneScanAttempts() {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const result = await this.prisma.scanAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
      if (result.count > 0) this.logger.log(`Pruned ${result.count} scan attempts older than 90 days`)
    } catch (error) {
      this.logger.error(`Failed to prune scan attempts: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }
}
