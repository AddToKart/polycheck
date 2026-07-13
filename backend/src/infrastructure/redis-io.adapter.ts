import { Logger } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { INestApplicationContext } from '@nestjs/common'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient, type RedisClientType } from 'redis'

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name)
  private adapterConstructor?: ReturnType<typeof createAdapter>
  private publisher?: RedisClientType
  private subscriber?: RedisClientType

  constructor(app: INestApplicationContext) {
    super(app)
  }

  async connect(url?: string) {
    if (!url) return
    try {
      this.publisher = createClient({ url })
      this.subscriber = this.publisher.duplicate()
      this.publisher.on('error', (error) => this.logger.warn(`Redis publisher error: ${error.message}`))
      this.subscriber.on('error', (error) => this.logger.warn(`Redis subscriber error: ${error.message}`))
      await Promise.all([this.publisher.connect(), this.subscriber.connect()])
      this.adapterConstructor = createAdapter(this.publisher, this.subscriber)
      this.logger.log('Socket.IO Redis adapter enabled')
    } catch (error) {
      this.logger.warn(`Socket.IO Redis adapter unavailable; using the in-process adapter: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  createIOServer(port: number, options?: Record<string, unknown>) {
    const server = super.createIOServer(port, options)
    if (this.adapterConstructor) server.adapter(this.adapterConstructor)
    return server
  }

  async close(server: Parameters<IoAdapter['close']>[0]) {
    await super.close(server)
    if (this.subscriber?.isOpen) await this.subscriber.quit()
    if (this.publisher?.isOpen) await this.publisher.quit()
  }
}
