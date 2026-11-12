import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { drainOnce, type AttendanceWriter, type BufferedScan } from '../src/queue'

const scan = (overrides: Partial<BufferedScan> = {}): BufferedScan => ({
  userId: 'student-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  status: 'present',
  scannedAt: '2026-11-13T00:05:00.000Z',
  receivedAt: '2026-11-13T00:05:01.000Z',
  riskSignals: [],
  offline: false,
  qrToken: 'token',
  ...overrides,
})

function fakeRedis(entries: Array<[string, BufferedScan | null]>) {
  const acked: string[] = []
  const fields = entries.map(([id, value]) => [id, ['payload', value === null ? '{bad' : JSON.stringify(value)]])
  const redis = {
    xreadgroup: vi.fn().mockResolvedValue([['ingest:scans', fields]]),
    xack: vi.fn(async (_key: string, _group: string, ...ids: string[]) => {
      acked.push(...ids)
      return ids.length
    }),
  }
  // Test double: it implements only the two commands drainOnce touches.
  return { redis: redis as unknown as Redis, acked, spy: redis }
}

const drainerStub = { writeBatch: vi.fn() }

function makeWriter(result = { written: 0, duplicates: 0 }): AttendanceWriter {
  drainerStub.writeBatch.mockReset()
  drainerStub.writeBatch.mockResolvedValue(result)
  return drainerStub as unknown as AttendanceWriter
}

describe('drainOnce', () => {
  it('groups a batch by session and acknowledges every committed entry', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ userId: 'student-2' })],
      ['3-0', scan({ sessionId: 'sess-2' })],
    ])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    const result = await drainOnce({
      redis,
      writer,
      streamKey: 'ingest:scans',
      group: 'g',
      consumer: 'c',
      batchMax: 10,
    })

    expect(result.read).toBe(3)
    expect(result.written).toBe(2)
    expect(drainerStub.writeBatch).toHaveBeenCalledTimes(2)
    expect(drainerStub.writeBatch).toHaveBeenCalledWith('sess-1', expect.arrayContaining([expect.objectContaining({ userId: 'student-1' })]))
    expect(acked.sort()).toEqual(['1-0', '2-0', '3-0'])
  })

  it('drops malformed entries instead of poisoning the batch forever', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', null],
      ['2-0', scan()],
    ])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    await drainOnce({ redis, writer, streamKey: 'ingest:scans', group: 'g', consumer: 'c', batchMax: 10 })

    expect(drainerStub.writeBatch).toHaveBeenCalledTimes(1)
    expect(acked).toContain('1-0')
  })

  it('leaves a failed session pending so it is redelivered', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ sessionId: 'sess-2' })],
    ])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ written: 1, duplicates: 0 })
    const writer = drainerStub as unknown as AttendanceWriter

    await drainOnce({ redis, writer, streamKey: 'ingest:scans', group: 'g', consumer: 'c', batchMax: 10 })

    expect(acked).not.toContain('1-0')
    expect(acked).toContain('2-0')
  })

  it('does nothing when the stream is empty', async () => {
    const redis = {
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn(),
    }
    const writer = makeWriter()
    const result = await drainOnce({
      // Test double: only xreadgroup/xack are reachable here.
      redis: redis as unknown as Redis,
      writer,
      streamKey: 'ingest:scans',
      group: 'g',
      consumer: 'c',
      batchMax: 10,
    })
    expect(result).toEqual({ read: 0, acked: 0, written: 0 })
    expect(writer.writeBatch).not.toHaveBeenCalled()
  })
})
