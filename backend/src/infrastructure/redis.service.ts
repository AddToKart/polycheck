import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'

const MAX_LOCAL_FALLBACK_ENTRIES = 10_000

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: ReturnType<typeof createClient> | null = null
  private readonly localValues = new Map<string, { value: string; expiresAt: number }>()
  private readonly localRateLimits = new Map<string, { count: number; expiresAt: number }>()

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL')
    if (!url) {
      this.logger.log('REDIS_URL is not set; using local WebSocket, database, and throttling fallbacks')
      return
    }
    try {
      const client = createClient({ url })
      client.on('error', (error) => this.logger.warn(`Redis error: ${error.message}`))
      await client.connect()
      this.client = client
      this.logger.log('Redis infrastructure connected')
    } catch (error) {
      this.logger.warn(
        `Redis unavailable; continuing with local fallbacks: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  isAvailable() {
    return Boolean(this.client?.isReady)
  }

  async getJson<T>(key: string): Promise<T | null> {
    const storageKey = this.key(key)
    if (this.client?.isReady) {
      try {
        const value = await this.client.get(storageKey)
        if (value) return JSON.parse(value) as T
      } catch (error) {
        this.logFallback('read JSON value', error)
      }
    }
    const value = this.getLocalValue(storageKey)
    return value ? (JSON.parse(value) as T) : null
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    const storageKey = this.key(key)
    const serialized = JSON.stringify(value)
    const ttl = Math.max(1, ttlSeconds)
    if (this.client?.isReady) {
      try {
        await this.client.set(storageKey, serialized, { EX: ttl })
        return
      } catch (error) {
        this.logFallback('write JSON value', error)
      }
    }
    this.setLocalValue(storageKey, serialized, ttl)
  }

  async delete(key: string) {
    const storageKey = this.key(key)
    this.localValues.delete(storageKey)
    this.localRateLimits.delete(storageKey)
    if (!this.client?.isReady) return
    try {
      await this.client.del(storageKey)
    } catch (error) {
      this.logFallback('delete value', error)
    }
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number) {
    const redisKey = this.key(`rate:${key}`)
    if (this.client?.isReady) {
      try {
        const results = await this.client
          .multi()
          .incr(redisKey)
          .expire(redisKey, Math.max(1, windowSeconds), 'NX')
          .exec()
        const count = Number(results[0])
        if (Number.isFinite(count)) return count <= limit
        this.logger.warn('Redis returned an invalid rate-limit counter; using the in-process fallback')
      } catch (error) {
        this.logFallback('consume rate limit', error)
      }
    }
    return this.consumeLocalRateLimit(redisKey, limit, windowSeconds)
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const storageKey = this.key(key)
    const ttl = Math.max(1, ttlSeconds)
    if (this.client?.isReady) {
      try {
        const result = await this.client.set(storageKey, value, { EX: ttl, NX: true })
        return result === 'OK'
      } catch (error) {
        this.logFallback('set value if absent', error)
      }
    }
    if (this.getLocalValue(storageKey) !== null) return false
    this.setLocalValue(storageKey, value, ttl)
    return true
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) await this.client.quit()
  }

  private key(value: string) {
    return `polycheck:${value}`
  }

  private getLocalValue(key: string) {
    const entry = this.localValues.get(key)
    if (!entry) return null
    if (entry.expiresAt > Date.now()) return entry.value
    this.localValues.delete(key)
    return null
  }

  private setLocalValue(key: string, value: string, ttlSeconds: number) {
    this.pruneLocalState()
    this.evictOldestIfFull(this.localValues)
    this.localValues.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 })
  }

  private consumeLocalRateLimit(key: string, limit: number, windowSeconds: number) {
    this.pruneLocalState()
    const now = Date.now()
    const existing = this.localRateLimits.get(key)
    const entry =
      !existing || existing.expiresAt <= now
        ? { count: 1, expiresAt: now + Math.max(1, windowSeconds) * 1_000 }
        : { ...existing, count: existing.count + 1 }
    if (!existing) this.evictOldestIfFull(this.localRateLimits)
    this.localRateLimits.set(key, entry)
    return entry.count <= limit
  }

  private pruneLocalState() {
    const now = Date.now()
    for (const [key, entry] of this.localValues) {
      if (entry.expiresAt <= now) this.localValues.delete(key)
    }
    for (const [key, entry] of this.localRateLimits) {
      if (entry.expiresAt <= now) this.localRateLimits.delete(key)
    }
  }

  private evictOldestIfFull<T>(entries: Map<string, T>) {
    if (entries.size < MAX_LOCAL_FALLBACK_ENTRIES) return
    const oldestKey = entries.keys().next().value as string | undefined
    if (oldestKey) entries.delete(oldestKey)
  }

  private logFallback(operation: string, error: unknown) {
    this.logger.warn(
      `Redis failed to ${operation}; using the in-process fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }
}
