import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { Queue, QueueEvents, Worker } from 'bullmq'
import type { Job } from 'bullmq'
import IORedis from 'ioredis'
import { AttendanceService } from '../attendance/attendance.service'
import type { ScanAttendanceDto } from '../attendance/dto/attendance.dto'
import type { RequestUser } from '../auth/authenticated-principal'
import { MetricsService } from '../observability/metrics.service'

const QUEUE_NAME = 'attendance-sync'
type SyncResult = Awaited<ReturnType<AttendanceService['syncScan']>>
interface SyncJobData {
  user: Pick<RequestUser, 'id' | 'role'>
  records: ScanAttendanceDto[]
}

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name)
  private connection?: IORedis
  private producerConnection?: IORedis
  private queue?: Queue<SyncJobData, SyncResult[]>
  private events?: QueueEvents
  private worker?: Worker<SyncJobData, SyncResult[]>
  private metricsRefreshTimer?: ReturnType<typeof setInterval>

  constructor(
    private readonly attendance: AttendanceService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config?.get<string>('REDIS_URL')
    const required = this.config?.get<string>('NODE_ENV') === 'production'
    this.metrics?.configureBullMq(Boolean(redisUrl))
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
      this.producerConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        commandTimeout: 3_000,
        connectTimeout: 3_000,
        lazyConnect: true,
      })
      await this.producerConnection.connect()
      this.queue = new Queue<SyncJobData, SyncResult[]>(QUEUE_NAME, { connection: this.producerConnection })
      this.events = new QueueEvents(QUEUE_NAME, { connection: this.connection })
      this.worker = new Worker<SyncJobData, SyncResult[]>(QUEUE_NAME, (job) => this.processJob(job), {
        connection: this.connection,
        concurrency: 20,
      })
      this.queue.on('error', () => this.metrics?.setBullMqComponentReady('producer', false))
      this.events.on('error', () => this.metrics?.setBullMqComponentReady('events', false))
      this.worker.on('ready', () => this.metrics?.setBullMqComponentReady('worker', true))
      this.worker.on('error', () => this.metrics?.setBullMqComponentReady('worker', false))
      this.worker.on('closed', () => this.metrics?.setBullMqComponentReady('worker', false))
      this.worker.on('failed', (job, error) => {
        this.metrics?.recordBullMqFailure()
        this.logger.error(`Attendance sync job ${job?.id ?? 'unknown'} failed: ${error.message}`)
      })
      await Promise.all([this.queue.waitUntilReady(), this.events.waitUntilReady(), this.worker.waitUntilReady()])
      this.metrics?.setBullMqComponentReady('producer', true)
      this.metrics?.setBullMqComponentReady('events', true)
      this.metrics?.setBullMqComponentReady('worker', true)
      await this.refreshQueueMetrics()
      this.metricsRefreshTimer = setInterval(() => void this.refreshQueueMetrics(), 15_000)
      this.metricsRefreshTimer.unref()
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
      { user: { id: user.id, role: user.role }, records },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 10_000 },
        removeOnFail: { age: 86_400, count: 10_000 },
      },
    )
    this.metrics?.setBullMqComponentReady('producer', true)
    void this.refreshQueueMetrics()
    // The job is durable before waiting, but SQLite records are acknowledged only after
    // the worker returns authoritative per-record results.
    const results = await job.waitUntilFinished(this.events, 5_000)
    return { queued: false as const, results }
  }

  // A receipt is not an attendance acknowledgment. Clients retain evidence until
  // status() returns completed, including across process death or a lost response.
  async enqueue(user: RequestUser, records: ScanAttendanceDto[]) {
    if (!this.queue) return { queued: false as const, results: await this.processRecords(user, records) }
    const jobId = createHash('sha256')
      .update(JSON.stringify([user.id, records]))
      .digest('hex')
    try {
      const existing = await this.queue.getJob(jobId)
      if (existing && (await existing.getState()) === 'failed') await existing.retry()
      await this.queue.add(
        'process-batch',
        { user: { id: user.id, role: user.role }, records },
        {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { age: 86_400, count: 100_000 },
          removeOnFail: { age: 7 * 86_400, count: 100_000 },
        },
      )
      return { queued: true as const, receiptId: jobId }
    } catch {
      throw new ServiceUnavailableException(
        'Sync is temporarily unavailable. Keep the check-in on this device and retry.',
      )
    }
  }

  async status(user: RequestUser, receiptId: string) {
    if (!/^[a-f0-9]{64}$/.test(receiptId)) throw new NotFoundException('Sync receipt not found')
    if (!this.queue) throw new ServiceUnavailableException('Sync queue is unavailable')
    const job = await this.queue.getJob(receiptId)
    if (!job || job.data.user.id !== user.id) throw new NotFoundException('Sync receipt not found')
    const state = await job.getState()
    if (state === 'completed') {
      // getJob() is a snapshot. The worker can finish between that read and
      // getState(), so reload the committed result before acknowledging it.
      const completed = await this.queue.getJob(receiptId)
      if (completed?.data.user.id === user.id && Array.isArray(completed.returnvalue)) {
        return { state: 'completed' as const, results: completed.returnvalue }
      }
      return { state: 'pending' as const }
    }
    if (state === 'failed') return { state: 'failed' as const }
    return { state: 'pending' as const }
  }

  private async processRecords(user: RequestUser, records: ScanAttendanceDto[]) {
    const results: SyncResult[] = []
    for (const record of records) results.push(await this.attendance.syncScan(user, record))
    return results
  }

  private async processJob(job: Job<SyncJobData, SyncResult[]>) {
    const startedAt = Date.now()
    const waitSeconds = (startedAt - job.timestamp) / 1_000
    try {
      const result = await this.processRecords(job.data.user, job.data.records)
      this.metrics?.observeBullMqJob(waitSeconds, (Date.now() - startedAt) / 1_000, 'completed')
      return result
    } catch (error) {
      this.metrics?.observeBullMqJob(waitSeconds, (Date.now() - startedAt) / 1_000, 'failed')
      throw error
    }
  }

  private async refreshQueueMetrics() {
    const [producer, events, worker] = await Promise.all([
      this.componentAvailable(this.queue),
      this.componentAvailable(this.events),
      this.componentAvailable(this.worker),
    ])
    this.metrics?.setBullMqComponentReady('producer', producer)
    this.metrics?.setBullMqComponentReady('events', events)
    this.metrics?.setBullMqComponentReady('worker', worker && Boolean(this.worker?.isRunning()))
    if (!producer || !this.queue) return

    try {
      const counts = await this.queue.getJobCounts('wait', 'active', 'delayed', 'failed')
      this.metrics?.setBullMqJobCounts({
        wait: counts.wait ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      })
    } catch {
      this.metrics?.setBullMqComponentReady('producer', false)
    }
  }

  private async componentAvailable(component: Queue | QueueEvents | Worker | undefined) {
    if (!component) return false
    try {
      return (await component.client).status === 'ready'
    } catch {
      return false
    }
  }

  async onModuleDestroy() {
    await this.closeQueue()
  }

  private async closeQueue() {
    if (this.metricsRefreshTimer) clearInterval(this.metricsRefreshTimer)
    this.metricsRefreshTimer = undefined
    await Promise.allSettled([this.worker?.close(), this.events?.close(), this.queue?.close()].filter(Boolean))
    this.connection?.disconnect()
    this.producerConnection?.disconnect()
    this.producerConnection = undefined
    this.worker = undefined
    this.events = undefined
    this.queue = undefined
    this.connection = undefined
    this.metrics?.setBullMqComponentReady('producer', false)
    this.metrics?.setBullMqComponentReady('events', false)
    this.metrics?.setBullMqComponentReady('worker', false)
  }
}
