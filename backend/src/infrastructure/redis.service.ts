import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: ReturnType<typeof createClient> | null = null

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
      this.logger.warn(`Redis unavailable; continuing with local fallbacks: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  isAvailable() {
    return Boolean(this.client?.isReady)
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client?.isReady) return null
    const value = await this.client.get(this.key(key))
    return value ? JSON.parse(value) as T : null
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    if (!this.client?.isReady) return
    await this.client.set(this.key(key), JSON.stringify(value), { EX: Math.max(1, ttlSeconds) })
  }

  async delete(key: string) {
    if (!this.client?.isReady) return
    await this.client.del(this.key(key))
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number) {
    if (!this.client?.isReady) return true
    const redisKey = this.key(`rate:${key}`)
    const count = await this.client.incr(redisKey)
    if (count === 1) await this.client.expire(redisKey, windowSeconds)
    return count <= limit
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) await this.client.quit()
  }

  private key(value: string) {
    return `polycheck:${value}`
  }
}
