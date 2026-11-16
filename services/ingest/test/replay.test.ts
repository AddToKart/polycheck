import { describe, expect, it, vi } from 'vitest'
import { replayDlq } from '../scripts/replay-dlq.mjs'
import { drainOnce, PermanentWriteError, type AttendanceWriter, type BufferedScan, type DrainerDeps } from '../src/queue'

const scan = (overrides: Partial<BufferedScan> = {}): BufferedScan => ({
  userId: 'student-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  status: 'present',
  scannedAt: '2026-11-14T09:00:00.000Z',
  receivedAt: '2026-11-14T09:00:01.000Z',
  riskSignals: [],
  offline: false,
  qrToken: 'valid-qr-token',
  ...overrides,
})

describe('DLQ replay round trip (dead-letter, replay, record written)', () => {
  it('completes the full round trip: scan fails permanently -> dead-lettered -> replayed -> written', async () => {
    // In-memory stream storage for main stream and dlq stream
    const mainStream: Array<{ id: string; fields: string[] }> = [
      { id: '1-0', fields: ['payload', JSON.stringify(scan())] },
    ]
    const dlqStream: Array<{ id: string; fields: string[] }> = []
    const pending = new Map<string, number>()
    let idCounter = 1

    const xpending = vi.fn(async (...args: unknown[]) => {
      if (args.length <= 2) {
        const ids = [...pending.keys()]
        if (ids.length === 0) return [0, null, null, null]
        return [ids.length, ids[0], ids[ids.length - 1], [['c', String(ids.length)]]]
      }
      const start = String(args[2])
      const deliveries = pending.get(start) ?? 1
      return [[start, 'c1', 0, deliveries]]
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

    const fakeRedis = {
      pipeline: () => pipelineApi,
      xreadgroup: vi.fn(async () => {
        if (mainStream.length > 0) {
          const batch = mainStream.splice(0)
          for (const entry of batch) {
            pending.set(entry.id, (pending.get(entry.id) ?? 0) + 1)
          }
          return [['ingest:scans', batch.map((e) => [e.id, e.fields])]]
        }
        return null
      }),
      xpending,
      xclaim: vi.fn(async () => []),
      xack: vi.fn(async (_key: string, _group: string, ...ids: string[]) => {
        for (const id of ids) pending.delete(id)
        return ids.length
      }),
      xadd: vi.fn(async (key: string, _star: string, ...args: string[]) => {
        idCounter += 1
        const newId = `${idCounter}-0`
        if (key === 'ingest:dead-letter') {
          dlqStream.push({ id: newId, fields: args })
        } else if (key === 'ingest:scans') {
          mainStream.push({ id: newId, fields: args })
        }
        return newId
      }),
      xrange: vi.fn(async (key: string) => {
        if (key === 'ingest:dead-letter') {
          return dlqStream.map((e) => [e.id, e.fields])
        }
        return []
      }),
      xdel: vi.fn(async (key: string, ...ids: string[]) => {
        if (key === 'ingest:dead-letter') {
          for (const id of ids) {
            const idx = dlqStream.findIndex((e) => e.id === id)
            if (idx >= 0) dlqStream.splice(idx, 1)
          }
        }
        return ids.length
      }),
    }

    const failingWriter: AttendanceWriter = {
      writeBatch: vi.fn().mockRejectedValue(new PermanentWriteError('session sess-1 disappeared before commit')),
    }

    const retryState = new Map()
    const releasedDedupes: string[] = []

    const deps: DrainerDeps = {
      redis: fakeRedis as never,
      writer: failingWriter,
      streamKey: 'ingest:scans',
      group: 'drainers',
      consumer: 'c1',
      dlqKey: 'ingest:dead-letter',
      batchMax: 10,
      maxDeliveryAttempts: 5,
      retryBackoffCapSeconds: 5,
      deliveryCeiling: 3,
      retryState,
      releaseDedupe: async (sessionId, userId) => {
        releasedDedupes.push(`${sessionId}:${userId}`)
      },
    }

    // Step 1: Drain fails permanently -> scan is dead-lettered
    const drainResult1 = await drainOnce(deps)
    expect(drainResult1.deadLettered).toBe(1)
    expect(drainResult1.written).toBe(0)
    expect(drainResult1.acked).toBe(1)
    expect(dlqStream).toHaveLength(1)
    expect(mainStream).toHaveLength(0)
    expect(releasedDedupes).toContain('sess-1:student-1')

    // Verify DLQ contents
    const dlqFields = new Map<string, string>()
    for (let i = 0; i < dlqStream[0]!.fields.length; i += 2) {
      dlqFields.set(dlqStream[0]!.fields[i]!, dlqStream[0]!.fields[i + 1]!)
    }
    expect(dlqFields.get('sessionId')).toBe('sess-1')
    expect(dlqFields.get('userId')).toBe('student-1')
    expect(dlqFields.get('error')).toContain('session sess-1 disappeared')
    expect(dlqFields.get('payload')).toBeTruthy()

    // Step 2: Run replay script
    const replayResult = await replayDlq({
      redis: fakeRedis as never,
      streamKey: 'ingest:scans',
      dlqKey: 'ingest:dead-letter',
      targetSession: 'sess-1',
    })
    expect(replayResult.matched).toBe(1)
    expect(replayResult.replayed).toBe(1)
    expect(replayResult.dryRun).toBe(false)
    // DLQ should now be empty and mainStream should have re-enqueued scan
    expect(dlqStream).toHaveLength(0)
    expect(mainStream).toHaveLength(1)

    // Step 3: Writer recovers -> drainOnce processes replayed scan and writes to DB
    const writtenBatches: BufferedScan[][] = []
    const recoveredWriter: AttendanceWriter = {
      writeBatch: vi.fn().mockImplementation(async (_sessId, batch) => {
        writtenBatches.push(batch)
        return { written: batch.length, duplicates: 0 }
      }),
    }
    deps.writer = recoveredWriter

    const drainResult2 = await drainOnce(deps)
    expect(drainResult2.written).toBe(1)
    expect(drainResult2.deadLettered).toBe(0)
    expect(drainResult2.acked).toBe(1)
    expect(writtenBatches).toHaveLength(1)
    expect(writtenBatches[0]![0]!.userId).toBe('student-1')
    expect(writtenBatches[0]![0]!.sessionId).toBe('sess-1')
  })

  it('honors dry-run and session filtering without touching queues', async () => {
    const dlqStream = [
      {
        id: '2-0',
        fields: ['payload', JSON.stringify(scan({ sessionId: 'sess-target' })), 'sessionId', 'sess-target', 'userId', 's1'],
      },
      {
        id: '3-0',
        fields: ['payload', JSON.stringify(scan({ sessionId: 'sess-other' })), 'sessionId', 'sess-other', 'userId', 's2'],
      },
    ]

    const fakeRedis = {
      xrange: vi.fn(async () => dlqStream.map((e) => [e.id, e.fields])),
      xadd: vi.fn(),
      xdel: vi.fn(),
    }

    const result = await replayDlq({
      redis: fakeRedis as never,
      streamKey: 'ingest:scans',
      dlqKey: 'ingest:dead-letter',
      targetSession: 'sess-target',
      dryRun: true,
    })

    expect(result.matched).toBe(1)
    expect(result.replayed).toBe(0)
    expect(result.dryRun).toBe(true)
    expect(fakeRedis.xadd).not.toHaveBeenCalled()
    expect(fakeRedis.xdel).not.toHaveBeenCalled()
  })
})
