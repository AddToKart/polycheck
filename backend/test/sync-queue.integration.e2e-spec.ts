import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import type { Queue, Worker } from 'bullmq'
import type IORedis from 'ioredis'
import { SyncService } from '../src/sync/sync.service'

describe('Durable sync receipts with real Redis', () => {
  it('survives a worker restart and a lost submission response without duplicate processing', async () => {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL must point at an isolated test Redis')
    const url = new URL(process.env.REDIS_URL)
    url.pathname = '/15' // Isolate this queue from the application's integration-test worker.
    const config = new ConfigService({ REDIS_URL: url.toString(), NODE_ENV: 'production' })
    const attendance = { syncScan: jest.fn().mockResolvedValue({ id: 'confirmed-record', status: 'present' }) }
    let service = new SyncService(attendance as never, config)
    let receiptId: string | undefined
    const user = { id: `receipt-test-${randomUUID()}`, role: 'student' as const }
    try {
      await service.onModuleInit()
      await (service as unknown as { worker: Worker }).worker.pause()
      const records = [
        {
          sessionId: 'isolated-session',
          lat: 1,
          lon: 1,
          qrToken: 'x'.repeat(80),
          clientAttemptId: randomUUID(),
          scannedAt: new Date().toISOString(),
        },
      ]
      const first = await service.enqueue(user, records)
      if (!first.queued) throw new Error('Expected durable queue')
      receiptId = first.receiptId
      expect(await service.enqueue(user, records)).toEqual(first)
      expect(await service.status(user, receiptId)).toEqual({ state: 'pending' })
      expect(attendance.syncScan).not.toHaveBeenCalled()
      await expect(service.status({ ...user, id: 'another-student' }, receiptId)).rejects.toThrow(
        'Sync receipt not found',
      )
      await service.onModuleDestroy()
      service = new SyncService(attendance as never, config)
      await service.onModuleInit()
      const deadline = Date.now() + 10_000
      let result = await service.status(user, receiptId)
      while (result.state !== 'completed' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        result = await service.status(user, receiptId)
      }
      expect(result).toMatchObject({ state: 'completed', results: [{ id: 'confirmed-record' }] })
      expect(await service.enqueue(user, records)).toEqual(first)
      expect(attendance.syncScan).toHaveBeenCalledTimes(1)
      const producer = (service as unknown as { producerConnection: IORedis }).producerConnection
      const disconnected = new Promise<void>((resolve) => {
        producer.once('end', resolve)
      })
      producer.disconnect()
      await disconnected
      const disconnectedAt = Date.now()
      await expect(service.enqueue(user, records)).rejects.toThrow('Sync is temporarily unavailable')
      expect(Date.now() - disconnectedAt).toBeLessThan(3_000)
      await producer.connect()
    } finally {
      try {
        if (receiptId) await (await (service as unknown as { queue: Queue }).queue?.getJob(receiptId))?.remove()
      } finally {
        await service.onModuleDestroy()
      }
    }
  }, 30_000)
})
