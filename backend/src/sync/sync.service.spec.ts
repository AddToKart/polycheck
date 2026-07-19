import { SyncService } from './sync.service'

describe('SyncService', () => {
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

  it('derives a stable queue id from the student and batch payload', () => {
    const service = new SyncService({ syncScan: jest.fn() } as never)
    const batchId = (service as unknown as { batchId(userId: string, records: object[]): string }).batchId.bind(service)
    const records = [{ sessionId: 'session-1', clientAttemptId: 'attempt-1' }]

    expect(batchId('student-1', records)).toBe(batchId('student-1', records))
    expect(batchId('student-2', records)).not.toBe(batchId('student-1', records))
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
