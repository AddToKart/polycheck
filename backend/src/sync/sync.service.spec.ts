import { SyncService } from './sync.service'

describe('SyncService', () => {
  it('reloads results when the worker completes between loading a job and reading its state', async () => {
    const service = new SyncService({ syncScan: jest.fn() } as never)
    const user = { id: 'student-1', role: 'student' as const }
    const queue = {
      getJob: jest
        .fn()
        .mockResolvedValueOnce({ data: { user }, getState: async () => 'completed', returnvalue: null })
        .mockResolvedValueOnce({ data: { user }, returnvalue: [{ id: 'record-1' }] }),
    }
    Object.assign(service, { queue })
    expect(await service.status(user, 'a'.repeat(64))).toEqual({ state: 'completed', results: [{ id: 'record-1' }] })
  })
  it('returns a stable receipt without waiting for the worker and scopes it to its owner', async () => {
    const service = new SyncService({ syncScan: jest.fn() } as never)
    const queue = { getJob: jest.fn().mockResolvedValue(undefined), add: jest.fn().mockResolvedValue({}) }
    Object.assign(service, { queue })
    const user = { id: 'student-1', role: 'student' as const }
    const records = [{ sessionId: 's1', lat: 1, lon: 1, qrToken: 'x'.repeat(80), clientAttemptId: 'attempt-1' }]
    const first = await service.enqueue(user, records)
    expect(await service.enqueue(user, records)).toEqual(first)
    expect(first).toMatchObject({ queued: true, receiptId: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(await service.enqueue({ ...user, id: 'student-2' }, records)).not.toEqual(first)
    if (!first.queued) throw new Error('Expected a receipt')
    queue.getJob.mockResolvedValue({
      data: { user },
      getState: async () => 'completed',
      returnvalue: [{ id: 'record-1' }],
    })
    expect(await service.status(user, first.receiptId)).toEqual({ state: 'completed', results: [{ id: 'record-1' }] })
    await expect(service.status({ ...user, id: 'student-2' }, first.receiptId)).rejects.toThrow(
      'Sync receipt not found',
    )
  })

  it('does not acknowledge queue submission when Redis is unavailable', async () => {
    const service = new SyncService({ syncScan: jest.fn() } as never)
    Object.assign(service, { queue: { getJob: jest.fn().mockRejectedValue(new Error('offline')) } })
    await expect(service.enqueue({ id: 's1', role: 'student' }, [])).rejects.toThrow('Sync is temporarily unavailable')
  })
  it('returns durable per-record results and never acknowledges a background queue', async () => {
    const attendance = {
      syncScan: jest.fn().mockResolvedValueOnce({ id: 'record-1' }).mockResolvedValueOnce({ error: 'expired' }),
    }
    const service = new SyncService(attendance as never)
    const records = [
      { sessionId: 's1', lat: 1, lon: 1, qrToken: 'x'.repeat(80), scannedAt: new Date().toISOString() },
      { sessionId: 's2', lat: 1, lon: 1, qrToken: 'y'.repeat(80), scannedAt: new Date().toISOString() },
    ]

    const result = await service.submit({ id: 'student-1', role: 'student' }, records)

    expect(result).toEqual({ queued: false, results: [{ id: 'record-1' }, { error: 'expired' }] })
    expect(attendance.syncScan).toHaveBeenCalledTimes(2)
  })

  it('marks BullMQ disabled when Redis is not configured', async () => {
    const metrics = { configureBullMq: jest.fn() }
    const config = { get: jest.fn().mockReturnValue(undefined) }
    const service = new SyncService({ syncScan: jest.fn() } as never, config as never, metrics as never)

    await service.onModuleInit()

    expect(metrics.configureBullMq).toHaveBeenCalledWith(false)
  })

  it('observes queue wait and successful processing duration without job identifiers', async () => {
    const attendance = { syncScan: jest.fn().mockResolvedValue({ id: 'record-1' }) }
    const metrics = { observeBullMqJob: jest.fn() }
    const service = new SyncService(attendance as never, undefined, metrics as never)
    const processJob = (
      service as unknown as {
        processJob(job: { timestamp: number; data: { user: object; records: object[] } }): Promise<unknown>
      }
    ).processJob.bind(service)

    await processJob({
      timestamp: Date.now() - 100,
      data: { user: { id: 'student-1', role: 'student' }, records: [{ sessionId: 'session-1' }] },
    })

    expect(metrics.observeBullMqJob).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'completed')
  })
})
