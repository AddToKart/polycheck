import { SyncService } from './sync.service'

const workerCtor = jest.fn()
const queueCtor = jest.fn()

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((...args: unknown[]) => {
    queueCtor(...args)
    return {
      on: jest.fn(),
      waitUntilReady: jest.fn().mockResolvedValue(undefined),
      getJobCounts: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined),
      client: Promise.resolve({ status: 'ready' }),
    }
  }),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    client: Promise.resolve({ status: 'ready' }),
  })),
  Worker: jest.fn().mockImplementation((...args: unknown[]) => {
    workerCtor(...args)
    return {
      on: jest.fn(),
      waitUntilReady: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
      client: Promise.resolve({ status: 'ready' }),
    }
  }),
}))

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  })),
)

function build(env: Record<string, string | undefined>) {
  const config = { get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : env[key])) }
  const metrics = {
    configureBullMq: jest.fn(),
    setBullMqComponentReady: jest.fn(),
    setBullMqJobCounts: jest.fn(),
    recordBullMqFailure: jest.fn(),
    observeBullMqJob: jest.fn(),
  }
  const service = new SyncService({ syncScan: jest.fn() } as never, config as never, metrics as never)
  return { service, metrics }
}

describe('SyncService worker configuration', () => {
  beforeEach(() => {
    workerCtor.mockClear()
    queueCtor.mockClear()
  })

  it('keeps the long-standing defaults: a worker in this process with concurrency 20', async () => {
    const { service } = build({})
    await service.onModuleInit()
    expect(workerCtor).toHaveBeenCalledTimes(1)
    expect(workerCtor.mock.calls[0][2]).toMatchObject({ concurrency: 20 })
    await service.onModuleDestroy()
  })

  it.each([
    ['5', 5],
    ['1', 1],
    ['500', 100],
    ['12.9', 12],
    ['0', 20],
    ['-3', 20],
    ['abc', 20],
    ['', 20],
  ])('SYNC_WORKER_CONCURRENCY=%j runs %i jobs at a time', async (raw, expected) => {
    const { service } = build({ SYNC_WORKER_CONCURRENCY: raw })
    await service.onModuleInit()
    expect(workerCtor.mock.calls[0][2]).toMatchObject({ concurrency: expected })
    await service.onModuleDestroy()
  })

  it('SYNC_WORKER_ENABLED=false keeps the producer but starts no worker, and stays ready', async () => {
    const { service, metrics } = build({ SYNC_WORKER_ENABLED: 'false' })
    await service.onModuleInit()

    expect(queueCtor).toHaveBeenCalledTimes(1)
    expect(workerCtor).not.toHaveBeenCalled()
    // Nothing local to be unready: readiness must not fail an API that deliberately has no worker.
    expect(metrics.setBullMqComponentReady).toHaveBeenCalledWith('worker', true)
    expect(metrics.setBullMqComponentReady).toHaveBeenCalledWith('producer', true)
    await service.onModuleDestroy()
  })

  it('still accepts and queues jobs when the worker lives elsewhere', async () => {
    const { service } = build({ SYNC_WORKER_ENABLED: 'false' })
    await service.onModuleInit()
    const queue = (service as unknown as { queue: { add: jest.Mock; getJob: jest.Mock } }).queue
    queue.getJob = jest.fn().mockResolvedValue(undefined)
    queue.add = jest.fn().mockResolvedValue(undefined)

    const receipt = await service.enqueue({ id: 'student-1', role: 'student' } as never, [{ sessionId: 's1' } as never])
    expect(receipt).toMatchObject({ queued: true, receiptId: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(queue.add).toHaveBeenCalledTimes(1)
    await service.onModuleDestroy()
  })
})
