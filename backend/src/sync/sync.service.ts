import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { randomUUID } from 'crypto'
import { AttendanceService } from '../attendance/attendance.service'
import type { ScanAttendanceDto } from '../attendance/dto/attendance.dto'
import type { RequestUser } from '../auth/authenticated-principal'

const QUEUE_NAME = 'attendance-sync'
type SyncResult = Awaited<ReturnType<AttendanceService['syncScan']>>
interface SyncJobData {
  user: RequestUser
  records: ScanAttendanceDto[]
}

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name)
  private connection?: IORedis
  private queue?: Queue<SyncJobData, SyncResult[]>
  private events?: QueueEvents
  private worker?: Worker<SyncJobData, SyncResult[]>

  constructor(
    private readonly attendance: AttendanceService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config?.get<string>('REDIS_URL')
    const required = this.config?.get<string>('NODE_ENV') === 'production'
    if (!redisUrl) {
      if (required) throw new Error('REDIS_URL is required for durable attendance sync')
      this.logger.warn('REDIS_URL is not set; attendance sync will run inline in this development instance')
      return
    }
    try {
      this.connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 10_000,
        lazyConnect: true,
      })
      await this.connection.connect()
      this.queue = new Queue<SyncJobData, SyncResult[]>(QUEUE_NAME, { connection: this.connection })
      this.events = new QueueEvents(QUEUE_NAME, { connection: this.connection })
      this.worker = new Worker<SyncJobData, SyncResult[]>(
        QUEUE_NAME,
        (job) => this.processRecords(job.data.user, job.data.records),
        { connection: this.connection, concurrency: 20 },
      )
      this.worker.on('failed', (job, error) =>
        this.logger.error(`Attendance sync job ${job?.id ?? 'unknown'} failed: ${error.message}`),
      )
      await Promise.all([this.queue.waitUntilReady(), this.events.waitUntilReady(), this.worker.waitUntilReady()])
      this.logger.log('BullMQ attendance sync worker connected')
    } catch (error) {
      await this.closeQueue()
      const message = error instanceof Error ? error.message : 'unknown connection error'
      if (required) throw new Error(`BullMQ attendance sync is required in production: ${message}`)
      this.logger.warn(`BullMQ unavailable; attendance sync will run inline: ${message}`)
    }
  }

  async submit(user: RequestUser, records: ScanAttendanceDto[]) {
    if (!this.queue || !this.events) {
      return { queued: false as const, results: await this.processRecords(user, records) }
    }
    const job = await this.queue.add(
      'process-batch',
      { user, records },
      {
        jobId: randomUUID(),
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 10_000 },
        removeOnFail: { age: 86_400, count: 10_000 },
      },
    )
    // The job is durable before waiting, but SQLite records are acknowledged only after
    // the worker returns authoritative per-record results.
    const results = await job.waitUntilFinished(this.events, 60_000)
    return { queued: false as const, results }
  }

  private async processRecords(user: RequestUser, records: ScanAttendanceDto[]) {
    const results: SyncResult[] = []
    for (const record of records) results.push(await this.attendance.syncScan(user, record))
    return results
  }

  async onModuleDestroy() {
    await this.closeQueue()
  }

  private async closeQueue() {
    await Promise.allSettled([this.worker?.close(), this.events?.close(), this.queue?.close()].filter(Boolean))
    this.connection?.disconnect()
    this.worker = undefined
    this.events = undefined
    this.queue = undefined
    this.connection = undefined
  }
}
