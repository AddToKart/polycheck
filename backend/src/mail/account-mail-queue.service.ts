import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { ACCOUNT_MAIL_QUEUED_EVENT } from '../account-activation/account-activation.service'
import { AccountMailProcessor, MAIL_MAX_ATTEMPTS } from './account-mail.processor'
import { MailService } from './mail.service'

const QUEUE_NAME = 'account-mail'

/**
 * Delivery plumbing for the activation-mail outbox. A dedicated BullMQ queue
 * (never the attendance-sync queue), concurrency 1 and a per-second limiter so
 * mail can never starve the API. Without Redis (development) rows are
 * processed inline on the next event/sweep. Mail is not on the attendance
 * critical path, so a queue failure degrades to the sweeper instead of
 * blocking boot.
 */
@Injectable()
export class AccountMailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountMailQueueService.name)
  private connection?: IORedis
  private queue?: Queue<{ id: string }>
  private worker?: Worker<{ id: string }>

  constructor(
    private readonly processor: AccountMailProcessor,
    private readonly mail: MailService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config?.get<string>('REDIS_URL')
    if (!redisUrl) {
      this.logger.warn('REDIS_URL is not set; account mail is processed inline by the sweeper')
      return
    }
    try {
      this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, connectTimeout: 10_000, lazyConnect: true })
      await this.connection.connect()
      this.queue = new Queue<{ id: string }>(QUEUE_NAME, { connection: this.connection })
      this.worker = new Worker<{ id: string }>(
        QUEUE_NAME,
        async (job) => {
          const outcome = await this.processor.process(job.data.id)
          // A transient failure re-queues the row; throwing lets BullMQ back off before the next try.
          if (outcome === 'retry') throw new Error('retry')
        },
        {
          connection: this.connection,
          concurrency: 1,
          limiter: { max: this.ratePerSecond(), duration: 1_000 },
        },
      )
      this.worker.on('error', (error) => this.logger.warn(`Account mail worker error: ${error.message}`))
      await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()])
      this.logger.log('Account mail worker connected')
    } catch (error) {
      await this.close()
      this.logger.warn(
        `Account mail queue unavailable; falling back to the sweeper: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    }
  }

  async onModuleDestroy() {
    await this.close()
  }

  private ratePerSecond(): number {
    const raw = Number(this.config?.get('MAIL_RATE_PER_SECOND') ?? process.env.MAIL_RATE_PER_SECOND)
    return Number.isFinite(raw) && raw >= 1 ? Math.min(10, Math.floor(raw)) : 2
  }

  @OnEvent(ACCOUNT_MAIL_QUEUED_EVENT, { async: true })
  async onQueued(payload: { id: string }) {
    await this.enqueue(payload.id)
  }

  async enqueue(id: string): Promise<void> {
    if (!this.mail.status().configured) return
    if (!this.queue) {
      await this.processInline(id)
      return
    }
    try {
      await this.queue.add(
        'send',
        { id },
        {
          jobId: `mail-${id}`,
          attempts: MAIL_MAX_ATTEMPTS,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      )
    } catch (error) {
      // The row stays queued; the sweeper picks it up.
      this.logger.warn(`Could not enqueue account mail ${id}: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  /** Every five minutes: recover crashed sends and re-queue overdue rows. Idle when nothing matches. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<number> {
    if (!this.mail.status().configured) return 0
    try {
      await this.processor.releaseStaleSending()
      if (await this.processor.capReached()) return 0
      const ids = await this.processor.findOverdueQueued()
      for (const id of ids) await this.enqueue(id)
      return ids.length
    } catch (error) {
      this.logger.warn(`Account mail sweep failed: ${error instanceof Error ? error.message : 'unknown'}`)
      return 0
    }
  }

  private async processInline(id: string) {
    try {
      await this.processor.process(id)
    } catch (error) {
      this.logger.warn(`Inline account mail ${id} failed: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  private async close() {
    await Promise.allSettled([this.worker?.close(), this.queue?.close()].filter(Boolean))
    this.connection?.disconnect()
    this.worker = undefined
    this.queue = undefined
    this.connection = undefined
  }
}
