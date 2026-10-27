import { HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { AppNotification, NotificationReadInput, NotificationType, PushTokenInput } from '@polycheck/shared'
import type { Notification } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { EXPO_PUSH_FETCH, EXPO_PUSH_URL, NOTIFICATION_CREATED_EVENT } from './notification-events'

const DEFAULT_LIST_LIMIT = 30
const MAX_LIST_LIMIT = 100
const NOTIFICATION_RETENTION_DAYS = 30
const NOTIFICATION_PRUNE_BATCH_SIZE = 5_000
const PUSH_TOKEN_RATE_LIMIT = 10
const PUSH_TOKEN_RATE_WINDOW_SECONDS = 60 * 60
const ABSENT_THROTTLE_SECONDS = 7 * 24 * 60 * 60
const STANDING_THROTTLE_SECONDS = 24 * 60 * 60
const PUSH_REQUEST_TIMEOUT_MS = 10_000
const INVALID_PUSH_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials'])

export interface CreateNotificationInput {
  type: NotificationType
  title: string
  body: string
  link?: string
}

export interface AttendanceAbsentNotification {
  sessionId: string
  subjectName: string
  date: string
}

export interface StandingRiskNotification {
  sectionId: string
  subjectName: string
  status: 'below_threshold' | 'at_risk'
  attendanceRate: number | null
}

interface ExpoPushTicket {
  status?: string
  details?: { error?: string }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
    @Optional() @Inject(EXPO_PUSH_FETCH) private readonly fetchImpl: typeof fetch = globalThis.fetch,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /**
   * Persists a notification, fans it out over the per-user WebSocket room and
   * pushes it to registered devices. Push delivery is best-effort; a delivery
   * failure never fails the mutation that triggered the notification.
   */
  async create(userId: string, input: CreateNotificationInput): Promise<AppNotification> {
    const row = await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
    })
    const notification = this.present(row)
    try {
      this.events.emit(NOTIFICATION_CREATED_EVENT, { userId, notification })
    } catch (error) {
      this.logger.warn(
        `Could not emit notification ${row.id} for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    // Push is fire-and-forget: the durable row and realtime event must not wait
    // on an external provider round-trip.
    void this.sendPush(userId, notification)
    return notification
  }

  /** Best-effort wrapper used by feature services; never throws into callers. */
  async notify(userId: string, input: CreateNotificationInput): Promise<void> {
    try {
      await this.create(userId, input)
    } catch (error) {
      this.logger.warn(
        `Could not create ${input.type} notification for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  async list(user: { id: string }, filters: { unreadOnly?: boolean; limit?: number } = {}): Promise<AppNotification[]> {
    const limit = Math.min(Math.max(1, Math.floor(filters.limit ?? DEFAULT_LIST_LIMIT)), MAX_LIST_LIMIT)
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id, ...(filters.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map((row) => this.present(row))
  }

  async unreadCount(user: { id: string }): Promise<number> {
    return this.prisma.notification.count({ where: { userId: user.id, readAt: null } })
  }

  async markRead(user: { id: string }, input: NotificationReadInput = {}): Promise<number> {
    const ids = input.ids?.filter((id) => typeof id === 'string' && id.length > 0)
    if (input.all) {
      await this.prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      })
    } else if (ids && ids.length > 0) {
      await this.prisma.notification.updateMany({
        where: { userId: user.id, id: { in: [...new Set(ids)] }, readAt: null },
        data: { readAt: new Date() },
      })
    }
    return this.unreadCount(user)
  }

  async registerPushToken(user: { id: string }, input: PushTokenInput): Promise<boolean> {
    const withinLimit = await this.redis.consumeRateLimit(
      `notifications:push-token:${user.id}`,
      PUSH_TOKEN_RATE_LIMIT,
      PUSH_TOKEN_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many push registration attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
    const token = input.token.trim()
    await this.prisma.pushSubscription.upsert({
      where: { token },
      update: { userId: user.id, platform: input.platform, lastSeenAt: new Date() },
      create: { userId: user.id, platform: input.platform, token },
    })
    return true
  }

  async notifyAttendanceAbsent(userId: string, context: AttendanceAbsentNotification): Promise<boolean> {
    const shouldNotify = await this.firstWithinWindow(
      `notify:absent:${userId}:${context.sessionId}`,
      ABSENT_THROTTLE_SECONDS,
    )
    if (!shouldNotify) return false
    await this.notify(userId, {
      type: 'attendance_absent',
      title: 'Marked absent',
      body: `You were marked absent in ${context.subjectName} on ${context.date}.`,
      link: '/student/dashboard',
    })
    return true
  }

  async notifyStandingRisk(userId: string, context: StandingRiskNotification): Promise<boolean> {
    const shouldNotify = await this.firstWithinWindow(
      `notify:standing:${userId}:${context.sectionId}`,
      STANDING_THROTTLE_SECONDS,
    )
    if (!shouldNotify) return false
    const rate = context.attendanceRate === null ? '' : ` The current rate is ${context.attendanceRate}%.`
    await this.notify(userId, {
      type: 'standing_below_threshold',
      title: context.status === 'below_threshold' ? 'Attendance below threshold' : 'Attendance at risk',
      body: `Your attendance standing in ${context.subjectName} needs attention.${rate}`,
      link: '/student/dashboard',
    })
    return true
  }

  /** Deletes notifications past the retention window (default 30 days). */
  async pruneExpired(retentionDays = NOTIFICATION_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    let pruned = 0
    while (true) {
      const batch = await this.prisma.notification.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: NOTIFICATION_PRUNE_BATCH_SIZE,
      })
      if (batch.length === 0) break
      const result = await this.prisma.notification.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } })
      pruned += result.count
      if (batch.length < NOTIFICATION_PRUNE_BATCH_SIZE) break
    }
    return pruned
  }

  private async firstWithinWindow(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      return await this.redis.setIfAbsent(key, '1', ttlSeconds)
    } catch (error) {
      // Without the throttle we still prefer delivering over silently dropping
      // the notification; a duplicate is safer than a missed absence warning.
      this.logger.warn(
        `Notification throttle ${key} was unavailable: ${error instanceof Error ? error.message : String(error)}`,
      )
      return true
    }
  }

  private async sendPush(userId: string, notification: AppNotification): Promise<void> {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
        select: { token: true },
      })
      if (subscriptions.length === 0) return
      const fetchImpl = this.fetchImpl
      if (typeof fetchImpl !== 'function') return
      const messages = subscriptions.map((subscription) => ({
        to: subscription.token,
        title: notification.title,
        body: notification.body,
        sound: 'default',
        data: { type: notification.type, link: notification.link, notificationId: notification.id },
      }))
      const accessToken = this.config?.get<string>('EXPO_ACCESS_TOKEN')?.trim()
      const response = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        this.logger.warn(`Expo push request for user ${userId} returned HTTP ${response.status}`)
        return
      }
      const payload = (await response.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null
      const invalidTokens = subscriptions
        .filter((_, index) => {
          const ticket = payload?.data?.[index]
          return ticket?.status === 'error' && INVALID_PUSH_ERRORS.has(ticket.details?.error ?? '')
        })
        .map((subscription) => subscription.token)
      if (invalidTokens.length > 0) {
        await this.prisma.pushSubscription.deleteMany({ where: { token: { in: invalidTokens } } })
      }
    } catch (error) {
      // Push is an enhancement: the in-app notification row and realtime event
      // are already durable, so network/provider failures stay in the logs.
      this.logger.warn(
        `Push delivery for notification ${notification.id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private present(row: Notification): AppNotification {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      ...(row.link ? { link: row.link } : {}),
      ...(row.readAt ? { readAt: row.readAt.toISOString() } : {}),
      createdAt: row.createdAt.toISOString(),
    }
  }
}
