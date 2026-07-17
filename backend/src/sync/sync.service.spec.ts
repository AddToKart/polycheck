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
})
