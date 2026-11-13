/**
 * Redis Streams buffer + ordered micro-batch drainer.
 *
 * The gateway never writes Postgres on the request path. Accepted work lands in
 * a stream, and the drainer commits it in batches grouped by session so the
 * per-session advisory lock is taken **once per batch** instead of once per
 * row — the change that turns 2,000 serialised transactions into ~40.
 *
 * Stream lifecycle (added in the scaling wave):
 *   - `XLEN` counts *retained* entries (history + backlog) after trimming.
 *   - `XPENDING` counts *unacknowledged* entries — the true backlog, which is
 *     what backpressure and `/health/ready` must look at.
 *   - The drainer trims from its ack cycle only, never from the producers:
 *       PEL empty  → `XTRIM MAXLEN ~ maxlen` (nothing unacked can be removed)
 *       PEL present → `XTRIM MINID <oldest pending>` (only the acked prefix)
 *     Producers deliberately do NOT pass MAXLEN to XADD: a backlog larger than
 *     the cap would silently evict accepted-but-unwritten scans.
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
  /**
   * `>` = new messages (steady state); `0` = this consumer's pending entries
   * (replayed once on startup after a crash so nothing is stranded).
   */
  startId?: string
  /**
   * Session-level concurrency inside one drain batch. Each session is still
   * written by exactly one advisory-locked transaction (ordering per session is
   * untouched); distinct sessions are independent, so a small bound keeps the
   * drainer ahead of ingest without multiplying lock contention. Default 1.
   */
  concurrency?: number
  now?: () => number
}

export interface DrainResult {
  read: number
  acked: number
  written: number
  duplicates: number
  /** Sessions whose commit threw and stayed pending (retried on the next tick). */
  failed: number
}

export interface PendingSummary {
  /** Unacknowledged entries across every consumer of the group. */
  count: number
  oldestId: string | null
  /** Age of `oldestId` in seconds; 0 when nothing is pending. */
  lagSeconds: number
}

export interface TrimResult {
  mode: 'maxlen' | 'minid' | 'skipped'
  trimmed: number
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
  // No MAXLEN here on purpose — see the module comment. Trimming happens after
  // the drainer acknowledges, where it provably cannot drop unprocessed work.
  const id = await redis.xadd(streamKey, '*', 'payload', JSON.stringify(scan))
  if (!id) throw new Error('Redis XADD returned no id')
  return id
}

export async function streamDepth(redis: Redis, streamKey: string): Promise<number> {
  return redis.xlen(streamKey)
}

/**
 * Parses the `XPENDING <key> <group>` summary:
 * `[count, smallestId, greatestId, [[consumer, count], ...]]`.
 *
 * The previous implementation split `summary[0]` (the count) on `-`, so the lag
 * gauge was permanently 0. `summary[1]` is the oldest entry ID.
 */
export function summarizePending(raw: unknown, nowMs = Date.now()): PendingSummary {
  if (!Array.isArray(raw) || raw.length === 0) return { count: 0, oldestId: null, lagSeconds: 0 }
  const count = Number(raw[0])
  const oldestId = typeof raw[1] === 'string' && raw[1].length > 0 ? raw[1] : null
  let lagSeconds = 0
  if (oldestId) {
    const enqueuedAt = Number(oldestId.split('-')[0])
    if (Number.isFinite(enqueuedAt)) lagSeconds = Math.max(0, (nowMs - enqueuedAt) / 1000)
  }
  return { count: Number.isFinite(count) ? count : 0, oldestId, lagSeconds }
}

export async function pendingSummary(
  redis: Pick<Redis, 'xpending'>,
  streamKey: string,
  group: string,
  nowMs = Date.now(),
): Promise<PendingSummary> {
  try {
    const raw = await redis.xpending(streamKey, group)
    return summarizePending(raw, nowMs)
  } catch (error) {
    // NOGROUP is not an error for a read-only probe: no group means nothing is
    // pending (the drainer creates it; health may be scraped first).
    if (error instanceof Error && (error.message.includes('NOGROUP') || error.message.includes('no such key'))) {
      return { count: 0, oldestId: null, lagSeconds: 0 }
    }
    throw error
  }
}

export interface TrimSchedulerDeps {
  redis: Pick<Redis, 'xpending' | 'xtrim'>
  streamKey: string
  group: string
  /** Approximate retained-entry cap; 0 disables trimming. */
  maxlen: number
  /** Minimum spacing between trim runs. */
  intervalMs: number
  now?: () => number
}

/**
 * Creates the drainer's throttled trim step. Safe by construction: entries are
 * only ever removed below the oldest pending ID, or (when nothing is pending)
 * beyond the `MAXLEN ~` cap.
 */
/**
 * Approximate `XTRIM` removes at most ~100 stream nodes per call (roughly 10k
 * entries with kilobyte payloads), so one idle trim from a 100k-entry backlog
 * would leave the stream at 90k until the next interval. The scheduler loops a
 * bounded number of times so a single pass converges instead of relying on
 * wall-clock spacing; the cap keeps one pass from monopolising the drainer.
 */
const MAX_TRIM_ROUNDS = 20

export function createTrimScheduler(deps: TrimSchedulerDeps): () => Promise<TrimResult> {
  const now = deps.now ?? Date.now
  let lastRunAt: number | null = null
  return async function trim(): Promise<TrimResult> {
    if (deps.maxlen <= 0) return { mode: 'skipped', trimmed: 0 }
    const current = now()
    // `null` (not 0) matters: a monotonic clock can legitimately start at zero.
    if (lastRunAt !== null && current - lastRunAt < deps.intervalMs) return { mode: 'skipped', trimmed: 0 }
    lastRunAt = current

    const pending = await pendingSummary(deps.redis, deps.streamKey, deps.group, current)
    let total = 0
    // A pending entry without an ID is not a state Redis produces; refuse to
    // guess rather than risk trimming unprocessed work.
    if (pending.count > 0 && !pending.oldestId) return { mode: 'skipped', trimmed: 0 }
    for (let round = 0; round < MAX_TRIM_ROUNDS; round += 1) {
      const trimmed =
        pending.count > 0
          ? await deps.redis.xtrim(deps.streamKey, 'MINID', pending.oldestId as string)
          : await deps.redis.xtrim(deps.streamKey, 'MAXLEN', '~', deps.maxlen)
      total += Number(trimmed) || 0
      if (!trimmed) break
    }
    return { mode: pending.count > 0 ? 'minid' : 'maxlen', trimmed: total }
  }
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
export async function drainOnce(deps: DrainerDeps): Promise<DrainResult> {
  const entries = await deps.redis.xreadgroup(
    'GROUP',
    deps.group,
    deps.consumer,
    'COUNT',
    deps.batchMax,
    'STREAMS',
    deps.streamKey,
    deps.startId ?? '>',
  )
  const messages = parseMessages(Array.isArray(entries) ? (entries[0] as unknown[])?.[1] : [])
  return commitMessages(deps, messages)
}

/**
 * Reclaims entries left pending by a consumer that died (an old pid-based
 * consumer name, a crashed process). `XREADGROUP >` never redelivers those, so
 * without this they keep `buffer_lag` permanently `behind` and block MINID
 * trimming. Ownership only moves once the entry has been idle for `minIdleMs`,
 * so a live drainer is never robbed mid-batch.
 */
export async function claimStale(deps: DrainerDeps, minIdleMs: number): Promise<DrainResult> {
  const reply = await deps.redis.xautoclaim(
    deps.streamKey,
    deps.group,
    deps.consumer,
    minIdleMs,
    '0-0',
    'COUNT',
    deps.batchMax,
  )
  // Redis 7 returns [cursor, messages, deletedIds]; Redis 6.2 returned two.
  const messages = Array.isArray(reply) ? parseMessages(reply[1]) : []
  return commitMessages(deps, messages)
}

async function commitMessages(deps: DrainerDeps, messages: StreamMessage[]): Promise<DrainResult> {
  const { writer, streamKey, group } = deps
  if (messages.length === 0) return { read: 0, acked: 0, written: 0, duplicates: 0, failed: 0 }

  const malformed = messages.filter((message) => !message.scan).map((message) => message.id)
  const bySession = new Map<string, StreamMessage[]>()
  for (const message of messages) {
    if (!message.scan) continue
    const list = bySession.get(message.scan.sessionId) ?? []
    list.push(message)
    bySession.set(message.scan.sessionId, list)
  }

  let written = 0
  let duplicates = 0
  let failed = 0
  const acknowledged: string[] = [...malformed]

  // Distinct sessions are independent transactions; running a bounded number in
  // parallel keeps the drainer ahead of ingest. Within one session the batch is
  // still a single advisory-locked transaction in stream order.
  const queue = [...bySession.entries()]
  const runSession = async ([sessionId, batch]: [string, StreamMessage[]]) => {
    try {
      const result = await writer.writeBatch(
        sessionId,
        batch.map((message) => message.scan),
      )
      written += result.written
      duplicates += result.duplicates
      for (const message of batch) acknowledged.push(message.id)
      if (deps.publish) await deps.publish(sessionId, batch.map((message) => message.scan))
    } catch (error) {
      failed += 1
      // Never swallow this: a silent per-session failure looks exactly like
      // "the drainer ran and found nothing", and the rows just stay pending.
      console.error(
        `[ingest] batch write failed for session ${sessionId}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
  const workers = Array.from({ length: Math.min(deps.concurrency ?? 1, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) await runSession(next)
  })
  await Promise.all(workers)

  if (acknowledged.length > 0) await deps.redis.xack(streamKey, group, ...acknowledged)
  return { read: messages.length, acked: acknowledged.length, written, duplicates, failed }
}
