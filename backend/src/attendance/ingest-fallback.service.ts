import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ScanAttendanceDto } from './dto/attendance.dto'
import { AttendanceService } from './attendance.service'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { UserRole } from '../prisma/client'

/**
 * Control-plane fallback drainer for the ingestion gateway.
 *
 * Purpose: when `polycheck-ingest` is down, entries it already accepted into
 * the Redis stream would otherwise sit unprocessed until it came back. This
 * consumer replays them through the **normal** NestJS scan path
 * (`AttendanceService.scan`/`syncScan`), so validation, ledger chaining,
 * disputes, realtime fan-out and notifications all behave exactly as if the
 * request had arrived here — no duplicated write logic.
 *
 * Off by default (`INGEST_FALLBACK_DRAIN=true` to enable). It reads a shared
 * consumer group and auto-claims entries left pending by a dead consumer, so a
 * crash mid-batch is recoverable rather than stranded.
 */
@Injectable()
export class IngestFallbackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestFallbackService.name)
  private timer: NodeJS.Timeout | null = null
  private running = false
  private readonly consumer = `control-plane-${process.pid}`

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('INGEST_FALLBACK_DRAIN') !== 'true') return

    const streamKey = this.config.get<string>('INGEST_STREAM_KEY') ?? 'polycheck:ingest:scans'
    const group = this.config.get<string>('INGEST_CONSUMER_GROUP') ?? 'ingest-workers'
    const ready = await this.redis.streamEnsureGroup(streamKey, group)
    if (!ready) {
      this.logger.warn(`Fallback drainer could not reach Redis for ${streamKey}; not starting`)
      return
    }

    this.logger.log(`Ingestion fallback drainer active on ${streamKey} (group ${group})`)
    this.timer = setInterval(() => void this.tick(), 1_000)
    // Never hold the process open on shutdown.
    this.timer.unref()
  }

  onModuleDestroy() {
    clearInterval(this.timer ?? undefined)
    this.timer = null
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const streamKey = this.config.get<string>('INGEST_STREAM_KEY') ?? 'polycheck:ingest:scans'
      const group = this.config.get<string>('INGEST_CONSUMER_GROUP') ?? 'ingest-workers'
      const batch = Math.min(200, Number(this.config.get<string>('INGEST_BATCH_MAX') ?? 200))

      const fresh = await this.redis.streamReadGroup(streamKey, group, this.consumer, batch)
      // Recover entries a crashed gateway consumer never acked.
      const stale = await this.redis.streamAutoClaim(streamKey, group, this.consumer, 30_000, batch)
      const seen = new Set<string>()
      const entries = [...fresh, ...stale].filter((entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      })
      if (entries.length === 0) return

      const acked: string[] = []
      for (const entry of entries) {
        const shouldAck = await this.replay(entry.payload)
        if (shouldAck) acked.push(entry.id)
      }
      await this.redis.streamAck(streamKey, group, acked)
    } catch (error) {
      this.logger.error(
        `Fallback drain failed: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    } finally {
      this.running = false
    }
  }

  /**
   * Replays one buffered scan. Returns whether the entry may be acknowledged:
   * a retryable rejection stays pending so it is attempted again.
   */
  private async replay(payload: string): Promise<boolean> {
    let scan: Record<string, unknown>
    try {
      scan = JSON.parse(payload) as Record<string, unknown>
    } catch {
      // Malformed entry: acknowledge and drop rather than poison the batch.
      return true
    }

    const userId = typeof scan.userId === 'string' ? scan.userId : null
    const sessionId = typeof scan.sessionId === 'string' ? scan.sessionId : null
    const qrToken = typeof scan.qrToken === 'string' ? scan.qrToken : null
    if (!userId || !sessionId || !qrToken) return true

    const user = await this.loadPrincipal(userId)
    if (!user) {
      // The account was deleted between acceptance and drain; nothing to write.
      this.logger.warn(`Fallback replay skipped: principal ${userId} no longer exists`)
      return true
    }

    const dto: ScanAttendanceDto = {
      sessionId,
      qrToken,
      clientAttemptId: typeof scan.clientAttemptId === 'string' ? scan.clientAttemptId : undefined,
      accuracyMeters: typeof scan.accuracyMeters === 'number' ? scan.accuracyMeters : undefined,
      locationCapturedAt: typeof scan.locationCapturedAt === 'string' ? scan.locationCapturedAt : undefined,
      mocked: typeof scan.mocked === 'boolean' ? scan.mocked : undefined,
      inputChannel: this.inputChannel(scan.inputChannel),
      scannedAt: typeof scan.scannedAt === 'string' ? scan.scannedAt : undefined,
      lat: typeof scan.latitude === 'number' ? scan.latitude : undefined,
      lon: typeof scan.longitude === 'number' ? scan.longitude : undefined,
      deviceId: typeof scan.deviceId === 'string' ? scan.deviceId : undefined,
    }

    try {
      const result =
        scan.offline === true ? await this.attendance.syncScan(user, dto) : await this.attendance.scan(user, dto)
      // A retryable rejection is a transient condition (window not yet open,
      // session write in flight); anything else is a terminal decision.
      if (result && typeof result === 'object' && 'retryable' in result && result.retryable === true) {
        return false
      }
      return true
    } catch (error) {
      this.logger.warn(
        `Fallback replay failed for session ${sessionId}: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return false
    }
  }

  private inputChannel(value: unknown): 'camera' | 'image' | 'manual' | undefined {
    return value === 'camera' || value === 'image' || value === 'manual' ? value : undefined
  }

  private async loadPrincipal(userId: string): Promise<RequestUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        studentId: true,
        department: true,
        privacyConsentVersion: true,
        privacyConsentedAt: true,
      },
    })
    if (!row) return null
    return {
      id: row.id,
      role: row.role as UserRole,
      email: row.email,
      studentId: row.studentId,
      department: row.department,
      privacyConsentVersion: row.privacyConsentVersion,
      privacyConsentedAt: row.privacyConsentedAt,
    }
  }
}
