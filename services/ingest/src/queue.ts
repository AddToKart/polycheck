/**
 * Redis Streams buffer + ordered micro-batch drainer.
 *
 * The gateway never writes Postgres on the request path. Accepted work lands in
 * a stream, and the drainer commits it in batches grouped by session so the
 * per-session advisory lock is taken **once per batch** instead of once per
 * row — the change that turns 2,000 serialised transactions into ~40.
 */
import type Redis from 'ioredis'

export interface BufferedScan {
  userId: string
  sessionId: string
  sectionId: string
  status: 'present' | 'late' | 'disputed' | 'incomplete'
  reason?: string
  message?: string
  scannedAt: string
  receivedAt: string
  mode?: 'in_person' | 'online'
  checkpoint?: 'start' | 'end'
  distanceMeters?: number
  geofenceRadiusMeters?: number
  riskSignals: string[]
  pinVerified?: boolean
  tokenHash?: string
  latitude?: number
  longitude?: number
  accuracyMeters?: number
  locationCapturedAt?: string
  deviceId?: string
  clientAttemptId?: string
  inputChannel?: string
  mocked?: boolean
  offline: boolean
  qrToken: string
}

export interface StreamMessage {
  id: string
  scan: BufferedScan
}

export interface AttendanceWriter {
  /**
   * Writes one session's batch inside a single advisory-locked transaction.
   * Must be idempotent: replaying the same batch cannot double-insert.
   */
  writeBatch(sessionId: string, scans: BufferedScan[]): Promise<{ written: number; duplicates: number }>
}

export interface DrainerDeps {
  redis: Redis
  writer: AttendanceWriter
  streamKey: string
  group: string
  consumer: string
  batchMax: number
  /** Publishes the control-plane realtime event after a successful commit. */
  publish?: (sessionId: string, granted: BufferedScan[]) => Promise<void>
  now?: () => number
}

export async function ensureConsumerGroup(
  redis: Redis,
  streamKey: string,
  group: string,
  startId = '$',
): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamKey, group, startId, 'MKSTREAM')
  } catch (error) {
    // BUSYGROUP = the group already exists, which is the steady state.
    if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) throw error
  }
}

export async function appendScan(redis: Redis, streamKey: string, scan: BufferedScan): Promise<string> {
  const id = await redis.xadd(streamKey, '*', 'payload', JSON.stringify(scan))
  if (!id) throw new Error('Redis XADD returned no id')
  return id
}

export async function streamDepth(redis: Redis, streamKey: string): Promise<number> {
  return redis.xlen(streamKey)
}

/** Age of the oldest un-acked entry, in seconds. 0 when the stream is empty. */
export async function oldestPendingAgeSeconds(
  redis: Redis,
  streamKey: string,
  group: string,
  nowMs = Date.now(),
): Promise<number> {
  const pending = await redis.xpending(streamKey, group)
  if (!Array.isArray(pending) || pending.length === 0) return 0
  const oldest = pending[0]
  if (!Array.isArray(oldest) || typeof oldest[0] !== 'string') return 0
  const [, id] = oldest[0].split('-')
  const enqueuedAt = Number(id)
  if (!Number.isFinite(enqueuedAt)) return 0
  return Math.max(0, (nowMs - enqueuedAt) / 1000)
}

function parseMessages(entries: unknown): StreamMessage[] {
  if (!Array.isArray(entries)) return []
  const messages: StreamMessage[] = []
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const [id, fields] = entry as [string, unknown]
    if (!Array.isArray(fields)) continue
    const payloadIndex = fields.indexOf('payload')
    if (payloadIndex < 0) continue
    const raw = fields[payloadIndex + 1]
    if (typeof raw !== 'string') continue
    try {
      messages.push({ id, scan: JSON.parse(raw) as BufferedScan })
    } catch {
      // A malformed entry is acknowledged and dropped by the caller; keeping it
      // pending would poison the batch forever.
      messages.push({ id, scan: null as unknown as BufferedScan })
    }
  }
  return messages
}

/**
 * Reads and commits one batch. Returns how many entries were acknowledged.
 * Failures leave entries pending so a retry replays them (at-least-once).
 */
export async function drainOnce(deps: DrainerDeps): Promise<{ read: number; acked: number; written: number }> {
  const { redis, writer, streamKey, group, consumer, batchMax } = deps
  const entries = await redis.xreadgroup(
    'GROUP',
    group,
    consumer,
    'COUNT',
    batchMax,
    'STREAMS',
    streamKey,
    '>',
  )
  const messages = parseMessages(Array.isArray(entries) ? (entries[0] as unknown[])?.[1] : [])
  if (messages.length === 0) return { read: 0, acked: 0, written: 0 }

  const malformed = messages.filter((message) => !message.scan).map((message) => message.id)
  const bySession = new Map<string, StreamMessage[]>()
  for (const message of messages) {
    if (!message.scan) continue
    const list = bySession.get(message.scan.sessionId) ?? []
    list.push(message)
    bySession.set(message.scan.sessionId, list)
  }

  let written = 0
  const acknowledged: string[] = [...malformed]

  for (const [sessionId, batch] of bySession) {
    try {
      const result = await writer.writeBatch(
        sessionId,
        batch.map((message) => message.scan),
      )
      written += result.written
      for (const message of batch) acknowledged.push(message.id)
      if (deps.publish) await deps.publish(sessionId, batch.map((message) => message.scan))
    } catch (error) {
      // Never swallow this: a silent per-session failure looks exactly like
      // "the drainer ran and found nothing", and the rows just stay pending.
      console.error(
        `[ingest] batch write failed for session ${sessionId}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  if (acknowledged.length > 0) await redis.xack(streamKey, group, ...acknowledged)
  return { read: messages.length, acked: acknowledged.length, written }
}
