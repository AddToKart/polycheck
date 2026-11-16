import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import {
  claimStale,
  createTrimScheduler,
  drainOnce,
  pendingSummary,
  summarizePending,
  PermanentWriteError,
  isInfrastructureError,
  type AttendanceWriter,
  type BufferedScan,
  type DrainerDeps,
} from '../src/queue'

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

interface FakeStreamEntry {
  id: string
  fields: string[]
}

function fakeRedis(entries: Array<[string, BufferedScan | null]>) {
  const acked: string[] = []
  const added: Array<{ key: string; args: string[] }> = []
  const claimed: string[][] = []
  const stream: FakeStreamEntry[] = entries.map(([id, value]) => ({
    id,
    fields: ['payload', value === null ? '{bad' : JSON.stringify(value)],
  }))
  // Mirrors the parts of the PEL this code depends on: XREADGROUP inserts an
  // entry with delivery count 1, XCLAIM bumps it, XACK removes it, and the
  // detail form of XPENDING reports it.
  const pending = new Map<string, number>()
  let undelivered = [...stream]

  const xpending = vi.fn(async (...args: unknown[]) => {
    if (args.length <= 2) {
      const ids = [...pending.keys()]
      if (ids.length === 0) return [0, null, null, null]
      return [ids.length, ids[0], ids[ids.length - 1], [['c', String(ids.length)]]]
    }
    const start = String(args[2])
    const deliveries = pending.get(start)
    return deliveries === undefined ? [] : [[start, 'c', 0, deliveries]]
  })

  const xreadgroup = vi.fn(async () => {
    if (undelivered.length === 0) return null
    const batch = undelivered
    undelivered = []
    for (const entry of batch) pending.set(entry.id, (pending.get(entry.id) ?? 0) + 1)
    return [['ingest:scans', batch.map((entry) => [entry.id, entry.fields])]]
  })

  const xclaim = vi.fn(async (...args: unknown[]) => {
    const ids = args.slice(4).map(String)
    claimed.push(ids)
    const found = stream.filter((entry) => ids.includes(entry.id) && pending.has(entry.id))
    for (const entry of found) pending.set(entry.id, (pending.get(entry.id) ?? 0) + 1)
    return found.map((entry) => [entry.id, entry.fields])
  })

  const xack = vi.fn(async (_key: string, _group: string, ...ids: string[]) => {
    for (const id of ids) pending.delete(id)
    acked.push(...ids)
    return ids.length
  })

  const xadd = vi.fn(async (key: string, ...args: string[]) => {
    added.push({ key, args })
    return `${stream.length + 1}-0`
  })

  const buffered: Array<() => Promise<unknown>> = []
  const pipelineApi = {
    xpending: (...args: unknown[]) => {
      buffered.push(() => xpending(...args))
      return pipelineApi
    },
    exec: async () => {
      const replies: Array<[Error | null, unknown]> = []
      for (const command of buffered.splice(0)) {
        try {
          replies.push([null, await command()])
        } catch (error) {
          replies.push([error instanceof Error ? error : new Error(String(error)), null])
        }
      }
      return replies
    },
  }

  const redis = {
    xreadgroup,
    xack,
    xadd,
    xclaim,
    xpending,
    pipeline: vi.fn(() => pipelineApi),
  }
  return { redis: redis as unknown as Redis, acked, added, claimed, spy: redis }
}

const drainerStub = { writeBatch: vi.fn() }

function makeWriter(result = { written: 0, duplicates: 0 }): AttendanceWriter {
  drainerStub.writeBatch.mockReset()
  drainerStub.writeBatch.mockResolvedValue(result)
  return drainerStub as unknown as AttendanceWriter
}

function baseDeps(overrides: Partial<DrainerDeps> & Pick<DrainerDeps, 'redis' | 'writer'>): DrainerDeps {
  return {
    streamKey: 'ingest:scans',
    group: 'g',
    consumer: 'c',
    batchMax: 10,
    dlqKey: 'ingest:dead-letter',
    maxDeliveryAttempts: 5,
    ...overrides,
  }
}

describe('drainOnce', () => {
  it('groups a batch by session and acknowledges every committed entry', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ userId: 'student-2' })],
      ['3-0', scan({ sessionId: 'sess-2' })],
    ])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    const result = await drainOnce(baseDeps({ redis, writer }))

    expect(result.read).toBe(3)
    expect(result.written).toBe(2)
    expect(drainerStub.writeBatch).toHaveBeenCalledTimes(2)
    expect(drainerStub.writeBatch).toHaveBeenCalledWith('sess-1', expect.arrayContaining([expect.objectContaining({ userId: 'student-1' })]))
    expect(acked.sort()).toEqual(['1-0', '2-0', '3-0'])
  })

  it('reports duplicates and failed sessions from the writer', async () => {
    const { redis } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ sessionId: 'sess-2' })],
    ])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch
      .mockResolvedValueOnce({ written: 0, duplicates: 1 })
      .mockRejectedValueOnce(new Error('db down'))
    const writer = drainerStub as unknown as AttendanceWriter

    const result = await drainOnce(baseDeps({ redis, writer }))

    expect(result.duplicates).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('replays this consumer’s pending entries when startId is 0', async () => {
    const { redis, spy } = fakeRedis([['1-0', scan()]])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    await drainOnce(baseDeps({ redis, writer, startId: '0' }))

    expect(spy.xreadgroup.mock.calls[0]?.at(-1)).toBe('0')
  })

  it('reclaims stale pending entries with XAUTOCLAIM and acknowledges them', async () => {
    const acked: string[] = []
    const redis = {
      xautoclaim: vi.fn().mockResolvedValue([
        '0-0',
        [['9-0', ['payload', JSON.stringify(scan({ sessionId: 'sess-9' }))]]],
        [],
      ]),
      xack: vi.fn(async (_key: string, _group: string, ...ids: string[]) => {
        acked.push(...ids)
        return ids.length
      }),
    }
    const writer = makeWriter({ written: 1, duplicates: 0 })

    const result = await claimStale(baseDeps({ redis: redis as unknown as Redis, writer }), 30_000)

    expect(redis.xautoclaim).toHaveBeenCalledWith('ingest:scans', 'g', 'c', 30_000, '0-0', 'COUNT', 10)
    expect(drainerStub.writeBatch).toHaveBeenCalledWith('sess-9', expect.any(Array))
    expect(result).toEqual({ read: 1, acked: 1, written: 1, duplicates: 0, failed: 0, deadLettered: 0 })
    expect(acked).toEqual(['9-0'])
  })

  it('is a no-op when the stale scan finds nothing', async () => {
    const redis = {
      xautoclaim: vi.fn().mockResolvedValue(['0-0', [], []]),
      xack: vi.fn(),
    }
    const writer = makeWriter()

    const result = await claimStale(baseDeps({ redis: redis as unknown as Redis, writer }), 30_000)

    expect(result).toEqual({ read: 0, acked: 0, written: 0, duplicates: 0, failed: 0, deadLettered: 0 })
    expect(redis.xack).not.toHaveBeenCalled()
  })

  it('runs distinct sessions concurrently but keeps one write per session', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ sessionId: 'sess-2' })],
      ['3-0', scan({ sessionId: 'sess-3' })],
    ])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    const result = await drainOnce(baseDeps({ redis, writer, concurrency: 3 }))

    expect(drainerStub.writeBatch).toHaveBeenCalledTimes(3)
    expect(result.acked).toBe(3)
    expect(acked.sort()).toEqual(['1-0', '2-0', '3-0'])
  })

  it('drops malformed entries instead of poisoning the batch forever', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', null],
      ['2-0', scan()],
    ])
    const writer = makeWriter({ written: 1, duplicates: 0 })

    await drainOnce(baseDeps({ redis, writer }))

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

    await drainOnce(baseDeps({ redis, writer }))

    expect(acked).not.toContain('1-0')
    expect(acked).toContain('2-0')
  })

  it('quarantines a transient failure that outlives the delivery ceiling', async () => {
    const { redis, acked, added } = fakeRedis([['1-0', scan()]])
    let nowMs = 0
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(new Error('db down'))
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({ redis, writer, retryState, now: () => nowMs })

    // Attempts 1..4 are transient: the entry stays pending, unacknowledged.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await drainOnce(deps)
      expect(result.deadLettered).toBe(0)
      expect(acked).not.toContain('1-0')
      expect(retryState.get('sess-1')?.ids).toEqual(['1-0'])
      nowMs = retryState.get('sess-1')!.nextAttemptAt
    }
    expect(added).toHaveLength(0)

    const result = await drainOnce(deps)

    expect(result.deadLettered).toBe(1)
    expect(result.acked).toBe(1)
    expect(retryState.has('sess-1')).toBe(false)
    expect(acked).toContain('1-0')
    expect(added).toEqual([
      {
        key: 'ingest:dead-letter',
        args: [
          '*',
          'payload',
          JSON.stringify(scan()),
          'originalId',
          '1-0',
          'sessionId',
          'sess-1',
          'userId',
          'student-1',
          'error',
          'db down',
          'failedAt',
          expect.any(String),
          'attempts',
          '5',
        ],
      },
    ])
  })

  it('quarantines a permanent write failure on the first delivery', async () => {
    const { redis, acked, added } = fakeRedis([['1-0', scan()]])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(new PermanentWriteError('session sess-1 disappeared before commit'))
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()

    const result = await drainOnce(baseDeps({ redis, writer, retryState }))

    expect(result.deadLettered).toBe(1)
    expect(result.failed).toBe(0)
    expect(retryState.size).toBe(0)
    expect(drainerStub.writeBatch).toHaveBeenCalledTimes(1)
    expect(acked).toEqual(['1-0'])
    expect(added[0]?.args).toContain('session sess-1 disappeared before commit')
    expect(added[0]?.args.at(-1)).toBe('1')
  })

  it('drains a healthy session while another session is quarantined', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan()],
      ['2-0', scan({ sessionId: 'sess-2' })],
    ])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockImplementation(async (sessionId: string) => {
      if (sessionId === 'sess-2') throw new PermanentWriteError('session sess-2 disappeared before commit')
      return { written: 1, duplicates: 0 }
    })
    const writer = drainerStub as unknown as AttendanceWriter

    const result = await drainOnce(baseDeps({ redis, writer }))

    expect(result.written).toBe(1)
    expect(result.deadLettered).toBe(1)
    expect(acked.sort()).toEqual(['1-0', '2-0'])
    // The XACK that follows quarantine empties the PEL, so lag (and the 503
    // backpressure guard that reads it) returns to zero.
    expect(await pendingSummary(redis, 'ingest:scans', 'g', 0)).toEqual({ count: 0, oldestId: null, lagSeconds: 0 })
  })

  it('takes the delivery ceiling from deps', async () => {
    const { redis, acked, added } = fakeRedis([['1-0', scan()]])
    let nowMs = 0
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(new Error('db down'))
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({ redis, writer, retryState, now: () => nowMs, maxDeliveryAttempts: 2 })

    await drainOnce(deps)
    expect(acked).toHaveLength(0)
    nowMs = retryState.get('sess-1')!.nextAttemptAt

    const result = await drainOnce(deps)

    expect(result.deadLettered).toBe(1)
    expect(acked).toEqual(['1-0'])
    expect(added).toHaveLength(1)
    expect(added[0]?.args.at(-1)).toBe('2')
  })

  it('does not reclaim a retry before its backoff elapses', async () => {
    const { redis, acked, claimed } = fakeRedis([['1-0', scan()]])
    let nowMs = 0
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(new Error('db down'))
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({ redis, writer, retryState, now: () => nowMs })

    await drainOnce(deps)
    const scheduled = retryState.get('sess-1')!
    expect(scheduled.nextAttemptAt).toBeGreaterThan(nowMs)
    expect(claimed).toHaveLength(0)

    nowMs = scheduled.nextAttemptAt - 1
    const result = await drainOnce(deps)

    expect(claimed).toHaveLength(0)
    expect(acked).toHaveLength(0)
    expect(result.read).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('survives a 15 s Postgres outage with 3 valid buffered scans: 0 dead-lettered, 3 records written after recovery', async () => {
    const { redis, acked } = fakeRedis([
      ['1700000000000-0', scan({ userId: 'u1' })],
      ['1700000000001-0', scan({ userId: 'u2' })],
      ['1700000000002-0', scan({ userId: 'u3' })],
    ])
    let nowMs = 1_700_000_000_000
    const infraError = new Error('timeout exceeded when trying to connect')
    ;(infraError as unknown as { code: string }).code = 'ECONNREFUSED'
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(infraError)
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({
      redis,
      writer,
      retryState,
      now: () => nowMs,
      maxDeliveryAttempts: 5,
      dlqMaxAgeSeconds: 1800,
    })

    // During the 15s outage, multiple ticks occur (e.g. 6 delivery attempts)
    for (let i = 0; i < 6; i++) {
      const res = await drainOnce(deps)
      expect(res.deadLettered).toBe(0)
      nowMs += 2_500
    }
    // Still 0 dead-lettered, nothing acked during outage
    expect(acked).toHaveLength(0)

    // Recovery at 15s: Postgres recovers and next tick runs after backoff
    nowMs += 5_000
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockResolvedValue({ written: 3, duplicates: 0 })
    const recoveryResult = await drainOnce(deps)

    expect(recoveryResult.written).toBe(3)
    expect(recoveryResult.deadLettered).toBe(0)
    expect(acked.sort()).toEqual(['1700000000000-0', '1700000000001-0', '1700000000002-0'])
  })

  it('retries individually on PermanentWriteError with batch.length > 1: 4 records written, 1 dead-lettered', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan({ userId: 'u1' })],
      ['2-0', scan({ userId: 'u2' })],
      ['3-0', scan({ userId: 'u3' })],
      ['4-0', scan({ userId: 'u4' })],
      ['5-0', scan({ userId: 'nonexistent-user' })],
    ])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockImplementation(async (_sessionId: string, scans: BufferedScan[]) => {
      if (scans.some((s) => s.userId === 'nonexistent-user')) {
        throw new PermanentWriteError('attendance batch rejected by Postgres (23503): foreign key violation')
      }
      return { written: scans.length, duplicates: 0 }
    })
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({ redis, writer, retryState })

    const result = await drainOnce(deps)

    expect(result.written).toBe(4)
    expect(result.deadLettered).toBe(1)
    expect(acked.sort()).toEqual(['1-0', '2-0', '3-0', '4-0', '5-0'])
  })

  it('does not quarantine a transient row-count mismatch error when retrying individually in split-batch', async () => {
    const { redis, acked } = fakeRedis([
      ['1-0', scan({ userId: 'u1' })],
      ['2-0', scan({ userId: 'u2' })],
    ])
    drainerStub.writeBatch.mockReset()
    let firstCall = true
    drainerStub.writeBatch.mockImplementation(async (_sessionId: string, scans: BufferedScan[]) => {
      if (firstCall) {
        firstCall = false
        throw new PermanentWriteError('batch failed permanently')
      }
      if (scans.some((s) => s.userId === 'u2')) {
        throw new Error('attendance batch insert wrote 0/1 rows; retrying')
      }
      return { written: scans.length, duplicates: 0 }
    })
    const writer = drainerStub as unknown as AttendanceWriter
    const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()
    const deps = baseDeps({ redis, writer, retryState })

    const result = await drainOnce(deps)

    expect(result.written).toBe(1)
    expect(result.deadLettered).toBe(0)
    expect(result.failed).toBe(1)
    expect(acked).toEqual(['1-0'])
    expect(retryState.get('sess-1')?.ids).toEqual(['2-0'])
  })

  it('releases the dedupe key when a scan is dead-lettered', async () => {
    const releaseDedupe = vi.fn().mockResolvedValue(undefined)
    const { redis, acked } = fakeRedis([['1-0', scan({ userId: 'bad-user', checkpoint: 'start' })]])
    drainerStub.writeBatch.mockReset()
    drainerStub.writeBatch.mockRejectedValue(new PermanentWriteError('session sess-1 disappeared before commit'))
    const writer = drainerStub as unknown as AttendanceWriter
    const deps = baseDeps({ redis, writer, releaseDedupe })

    const result = await drainOnce(deps)

    expect(result.deadLettered).toBe(1)
    expect(releaseDedupe).toHaveBeenCalledTimes(1)
    expect(releaseDedupe).toHaveBeenCalledWith('sess-1', 'bad-user', 'start')
  })

  it('does nothing when the stream is empty', async () => {
    const redis = {
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn(),
    }
    const writer = makeWriter()
    const result = await drainOnce(baseDeps({ redis: redis as unknown as Redis, writer }))
    expect(result).toEqual({ read: 0, acked: 0, written: 0, duplicates: 0, failed: 0, deadLettered: 0 })
    expect(writer.writeBatch).not.toHaveBeenCalled()
  })
})

describe('pending summary', () => {
  it('parses count, oldest id and lag from the XPENDING summary', () => {
    const raw = [2, '1700000000000-0', '1700000000500-0', [['c', '2']]]
    const summary = summarizePending(raw, 1_700_000_030_000)
    expect(summary.count).toBe(2)
    expect(summary.oldestId).toBe('1700000000000-0')
    expect(summary.lagSeconds).toBe(30)
  })

  it('treats an empty group as nothing pending', async () => {
    const redis = { xpending: vi.fn().mockResolvedValue([0, null, null, null]) }
    const summary = await pendingSummary(redis as unknown as Pick<Redis, 'xpending'>, 'k', 'g')
    expect(summary).toEqual({ count: 0, oldestId: null, lagSeconds: 0 })
  })

  it('treats a missing consumer group (NOGROUP) as nothing pending', async () => {
    const redis = { xpending: vi.fn().mockRejectedValue(new Error('NOGROUP No such consumer group')) }
    const summary = await pendingSummary(redis as unknown as Pick<Redis, 'xpending'>, 'k', 'g')
    expect(summary).toEqual({ count: 0, oldestId: null, lagSeconds: 0 })
  })
})

describe('stream trimming', () => {
  it('trims with MAXLEN when nothing is pending', async () => {
    const redis = {
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      // Approximate trims are chunked, so a converging pass is >1 call.
      xtrim: vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(0),
    }
    const trim = createTrimScheduler({
      redis: redis as unknown as Pick<Redis, 'xpending' | 'xtrim'>,
      streamKey: 'ingest:scans',
      group: 'g',
      maxlen: 50_000,
      intervalMs: 1_000,
      now: () => 100_000,
    })

    const result = await trim()

    expect(redis.xtrim).toHaveBeenCalledWith('ingest:scans', 'MAXLEN', '~', 50_000)
    expect(result).toEqual({ mode: 'maxlen', trimmed: 12 })
  })

  it('never trims below the oldest pending entry', async () => {
    const redis = {
      xpending: vi.fn().mockResolvedValue([1, '1700000000000-0', '1700000000000-0', [['c', '1']]]),
      xtrim: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(0),
    }
    const trim = createTrimScheduler({
      redis: redis as unknown as Pick<Redis, 'xpending' | 'xtrim'>,
      streamKey: 'ingest:scans',
      group: 'g',
      maxlen: 50_000,
      intervalMs: 1_000,
      now: () => 100_000,
    })

    const result = await trim()

    expect(redis.xtrim).toHaveBeenCalledWith('ingest:scans', 'MINID', '1700000000000-0')
    expect(result).toEqual({ mode: 'minid', trimmed: 4 })
  })

  it('loops chunked trims until the backlog converges in one pass', async () => {
    const redis = {
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      xtrim: vi.fn().mockResolvedValueOnce(10_000).mockResolvedValueOnce(10_000).mockResolvedValueOnce(0),
    }
    const trim = createTrimScheduler({
      redis: redis as unknown as Pick<Redis, 'xpending' | 'xtrim'>,
      streamKey: 'ingest:scans',
      group: 'g',
      maxlen: 50_000,
      intervalMs: 30_000,
      now: () => 100_000,
    })

    expect(await trim()).toEqual({ mode: 'maxlen', trimmed: 20_000 })
    expect(redis.xtrim).toHaveBeenCalledTimes(3)
  })

  it('is throttled to one run per interval', async () => {
    let nowMs = 0
    const redis = {
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      xtrim: vi.fn().mockResolvedValue(0),
    }
    const trim = createTrimScheduler({
      redis: redis as unknown as Pick<Redis, 'xpending' | 'xtrim'>,
      streamKey: 'ingest:scans',
      group: 'g',
      maxlen: 50_000,
      intervalMs: 30_000,
      now: () => nowMs,
    })

    expect((await trim()).mode).toBe('maxlen')
    nowMs = 10_000
    expect((await trim()).mode).toBe('skipped')
    nowMs = 30_000
    expect((await trim()).mode).toBe('maxlen')
    expect(redis.xtrim).toHaveBeenCalledTimes(2)
  })

  it('does nothing when trimming is disabled', async () => {
    const redis = { xpending: vi.fn(), xtrim: vi.fn() }
    const trim = createTrimScheduler({
      redis: redis as unknown as Pick<Redis, 'xpending' | 'xtrim'>,
      streamKey: 'ingest:scans',
      group: 'g',
      maxlen: 0,
      intervalMs: 1_000,
      now: () => 100_000,
    })

    expect(await trim()).toEqual({ mode: 'skipped', trimmed: 0 })
    expect(redis.xpending).not.toHaveBeenCalled()
    expect(redis.xtrim).not.toHaveBeenCalled()
  })
})

describe('isInfrastructureError', () => {
  it('identifies connection errors, timeouts, and deadlock codes', () => {
    expect(isInfrastructureError({ code: 'ECONNREFUSED' })).toBe(true)
    expect(isInfrastructureError({ code: 'ECONNRESET' })).toBe(true)
    expect(isInfrastructureError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isInfrastructureError({ code: '57P01' })).toBe(true)
    expect(isInfrastructureError({ code: '57P03' })).toBe(true)
    expect(isInfrastructureError({ code: '53300' })).toBe(true)
    expect(isInfrastructureError({ code: '08006' })).toBe(true)
    expect(isInfrastructureError({ code: '08P01' })).toBe(true)
    expect(isInfrastructureError({ code: '40001' })).toBe(true)
    expect(isInfrastructureError({ code: '40P01' })).toBe(true)
    expect(isInfrastructureError(new Error('timeout exceeded when trying to connect'))).toBe(true)
    expect(isInfrastructureError(new Error('Connection terminated unexpectedly'))).toBe(true)
  })

  it('does not classify business or constraint errors as infrastructure', () => {
    expect(isInfrastructureError(new Error('session disappeared before commit'))).toBe(false)
    expect(isInfrastructureError({ code: '23503' })).toBe(false)
    expect(isInfrastructureError(null)).toBe(false)
    expect(isInfrastructureError(undefined)).toBe(false)
  })
})
