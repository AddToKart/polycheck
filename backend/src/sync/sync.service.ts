import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Queue, Worker, type ConnectionOptions } from 'bullmq'
import { AttendanceService } from '../attendance/attendance.service'
import type { ScanAttendanceDto } from '../attendance/dto/attendance.dto'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

type AttendanceBatchJob = {
  user: RequestUser
  records: ScanAttendanceDto[]
}

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name)
  private queue?: Queue<AttendanceBatchJob>
  private worker?: Worker<AttendanceBatchJob>

  constructor(
    private readonly config: ConfigService,
    private readonly attendance: AttendanceService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL')
    if (!redisUrl) return
    const connection = this.connectionOptions(redisUrl)
    this.queue = new Queue<AttendanceBatchJob>('polycheck-attendance-sync', { connection })
    this.worker = new Worker<AttendanceBatchJob>(
      'polycheck-attendance-sync',
      (job) => this.process(job),
      { connection, concurrency: 4 },
    )
    this.worker.on('failed', (job, error) => this.logger.error(`Attendance sync job ${job?.id ?? 'unknown'} failed: ${error.message}`))
    this.logger.log('BullMQ attendance sync worker enabled')
  }

  async submit(user: RequestUser, records: ScanAttendanceDto[]) {
    if (this.queue) {
      try {
        const job = await this.queue.add('attendance-batch', { user, records }, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { count: 1_000 },
          removeOnFail: { count: 1_000 },
        })
        return { queued: true, jobId: String(job.id), count: records.length }
      } catch (error) {
        this.logger.warn(`BullMQ enqueue failed; processing synchronously: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
    return { queued: false, results: await this.processRecords(user, records) }
  }

  async onModuleDestroy() {
    await this.worker?.close()
    await this.queue?.close()
  }

  private async process(job: Job<AttendanceBatchJob>) {
    return this.processRecords(job.data.user, job.data.records)
  }

  private async processRecords(user: RequestUser, records: ScanAttendanceDto[]) {
    const results: Array<Awaited<ReturnType<AttendanceService['scan']>>> = []
    for (const record of records) results.push(await this.attendance.scan(user, record))
    return results
  }

  private connectionOptions(value: string): ConnectionOptions {
    const url = new URL(value)
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    }
  }
}
