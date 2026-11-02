import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue, QueueEvents, Worker } from 'bullmq'
import type { Job } from 'bullmq'
import IORedis from 'ioredis'
import { createHash } from 'node:crypto'
import type { ImportCredential, ImportJobStatus, StudentImportRequest, StudentImportResult } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { RedisService } from '../infrastructure/redis.service'
import { ErrorCode } from '../common/constants/error-codes'
import { StudentImportService } from './student-import.service'
import type { StudentImportRequestDto } from './dto/import-students.dto'

const QUEUE_NAME = 'users-import'
// Credentials are staged only long enough for the first status poll; they are
// deleted on first read and never written to the database.
const CREDENTIALS_TTL_SECONDS = 5 * 60

interface UsersImportJobData {
  user: Pick<RequestUser, 'id' | 'role' | 'scope' | 'department'>
  request: StudentImportRequest
  rowChecksum: string
}

export type BackgroundImportAck = {
  queued: true
  jobId: string
  state: 'waiting'
}

@Injectable()
export class StudentImportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StudentImportQueueService.name)
  private connection?: IORedis
  private producerConnection?: IORedis
  private queue?: Queue<UsersImportJobData, StudentImportResult>
  private events?: QueueEvents
  private worker?: Worker<UsersImportJobData, StudentImportResult>

  constructor(
    private readonly importer: StudentImportService,
    private readonly redis: RedisService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config?.get<string>('REDIS_URL')
    const required = this.config?.get<string>('NODE_ENV') === 'production'
    if (!redisUrl) {
      if (required) throw new Error('REDIS_URL is required for durable bulk imports')
      this.logger.warn('REDIS_URL is not set; bulk imports will run inline in this development instance')
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
      this.queue = new Queue<UsersImportJobData, StudentImportResult>(QUEUE_NAME, {
        connection: this.producerConnection,
      })
      this.events = new QueueEvents(QUEUE_NAME, { connection: this.connection })
      this.worker = new Worker<UsersImportJobData, StudentImportResult>(QUEUE_NAME, (job) => this.processJob(job), {
        connection: this.connection,
        concurrency: 2,
      })
      this.queue.on('error', () => undefined)
      this.events.on('error', () => undefined)
      this.worker.on('error', (error) => this.logger.error(`Bulk import worker error: ${error.message}`))
      this.worker.on('failed', (job, error) =>
        this.logger.error(`Bulk import job ${job?.id ?? 'unknown'} failed: ${error.message}`),
      )
      await Promise.all([this.queue.waitUntilReady(), this.events.waitUntilReady(), this.worker.waitUntilReady()])
      this.logger.log('BullMQ bulk import worker connected')
    } catch (error) {
      await this.closeQueue()
      const message = error instanceof Error ? error.message : 'unknown connection error'
      if (required) throw new Error(`BullMQ bulk imports are required in production: ${message}`)
      this.logger.warn(`BullMQ unavailable; bulk imports will run inline: ${message}`)
    }
  }

  /**
   * `background=false` always executes inline. `background=true` requires an
   * execute request bound to a valid checksum; without Redis (development) it
   * transparently executes the same service function inline.
   */
  async importStudents(
    user: RequestUser,
    dto: StudentImportRequestDto,
    background: boolean,
  ): Promise<StudentImportResult | BackgroundImportAck> {
    if (!background) return this.importer.importStudents(dto, user)
    if (dto.mode !== 'execute') {
      throw new BadRequestException('Background imports only support execute mode')
    }
    this.importer.assertChecksum(dto, user)
    if (!this.queue) return this.importer.importStudents(dto, user)

    const request: StudentImportRequest = {
      mode: dto.mode,
      conflictMode: dto.conflictMode,
      rows: dto.rows,
      ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
      ...(dto.rowChecksum ? { rowChecksum: dto.rowChecksum } : {}),
    }
    const jobId = createHash('sha256')
      .update(JSON.stringify([user.id, request]))
      .digest('hex')
    try {
      const existing = await this.queue.getJob(jobId)
      if (existing && (await existing.getState()) === 'failed') await existing.retry()
      await this.queue.add(
        'execute-import',
        {
          user: { id: user.id, role: user.role, scope: user.scope, department: user.department },
          request,
          rowChecksum: request.rowChecksum!,
        },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          // Job payloads contain roster PII; keep failures only an hour.
          removeOnFail: { age: 3_600, count: 1_000 },
        },
      )
      return { queued: true, jobId, state: 'waiting' }
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        code: ErrorCode.IMPORT_QUEUE_UNAVAILABLE,
        message: 'The import queue is temporarily unavailable. Retry with the same checksum.',
      })
    }
  }

  async status(user: RequestUser, jobId: string): Promise<ImportJobStatus> {
    if (!/^[a-f0-9]{64}$/.test(jobId)) throw new NotFoundException('Import job not found')
    if (!this.queue) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        code: ErrorCode.IMPORT_QUEUE_UNAVAILABLE,
        message: 'The import queue is unavailable',
      })
    }

    const job = await this.queue.getJob(jobId)
    if (!job || job.data.user.id !== user.id) throw new NotFoundException('Import job not found')

    const rawState = await job.getState()
    const state = this.mapState(rawState)
    const progress = this.progress(job.progress)
    const base: ImportJobStatus = {
      id: jobId,
      state,
      ...(progress ? { progress } : {}),
    }

    if (state === 'completed') {
      // The worker can finish between getJob() and getState(); reload before
      // reporting the terminal payload.
      const completed = await this.queue.getJob(jobId)
      if (completed?.data.user.id === user.id && completed.returnvalue) {
        const result = await this.attachOneTimeCredentials(jobId, completed.returnvalue as StudentImportResult)
        return { ...base, result }
      }
      return { ...base, state: 'active' }
    }
    if (state === 'failed') {
      return { ...base, error: job.failedReason || 'The import job failed' }
    }
    return base
  }

  private async processJob(job: Job<UsersImportJobData, StudentImportResult>) {
    await job.updateProgress({ chunksDone: 0, chunksTotal: 1 })
    const result = await this.importer.importStudents(job.data.request as StudentImportRequestDto, {
      id: job.data.user.id,
      role: job.data.user.role,
      scope: job.data.user.scope,
      department: job.data.user.department,
    })

    if (result.credentials?.length) {
      const stored = await this.redis
        .setJson(this.credentialsKey(job.id!), result.credentials, CREDENTIALS_TTL_SECONDS)
        .catch(() => false)
      if (!stored) {
        this.logger.error(`Could not stage credentials for completed import job ${job.id}`)
      }
    }
    await job.updateProgress({ chunksDone: 1, chunksTotal: 1 })
    const { credentials: _credentials, ...summary } = result
    return summary
  }

  private async attachOneTimeCredentials(jobId: string, result: StudentImportResult): Promise<StudentImportResult> {
    const credentials = await this.redis.getJson<ImportCredential[]>(this.credentialsKey(jobId)).catch(() => null)
    if (!credentials) return result
    const claimed = await this.redis.delete(this.credentialsKey(jobId)).catch(() => false)
    return claimed ? { ...result, credentials } : result
  }

  private credentialsKey(jobId: string) {
    return `import:credentials:${jobId}`
  }

  private mapState(state: string): ImportJobStatus['state'] {
    if (state === 'waiting' || state === 'delayed' || state === 'prioritized' || state === 'waiting-children') {
      return 'waiting'
    }
    if (state === 'active') return 'active'
    if (state === 'completed') return 'completed'
    if (state === 'failed') return 'failed'
    return 'unknown'
  }

  private progress(value: Job['progress']): { chunksDone: number; chunksTotal: number } | undefined {
    if (!value || typeof value !== 'object') return undefined
    const progress = value as { chunksDone?: unknown; chunksTotal?: unknown }
    if (typeof progress.chunksDone !== 'number' || typeof progress.chunksTotal !== 'number') return undefined
    return { chunksDone: progress.chunksDone, chunksTotal: progress.chunksTotal }
  }

  async onModuleDestroy() {
    await this.closeQueue()
  }

  private async closeQueue() {
    await Promise.allSettled([this.worker?.close(), this.events?.close(), this.queue?.close()].filter(Boolean))
    this.connection?.disconnect()
    this.producerConnection?.disconnect()
    this.connection = undefined
    this.producerConnection = undefined
    this.queue = undefined
    this.events = undefined
    this.worker = undefined
  }
}
