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

/**
 * A write failure retrying cannot fix: the session vanished after accept, or
 * Postgres rejected the row outright (FK/CHECK violation, unrepresentable enum).
 * Left pending it would be redelivered forever, and once its age crosses the lag
 * ceiling the request path answers 503 for *every* session. The drainer
 * quarantines these to the dead-letter stream on the first delivery instead.
 */
export class PermanentWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentWriteError'
  }
}

/**
 * Detects transient infrastructure failures that should not count against the
 * delivery ceiling (ECONNREFUSED, ECONNRESET, ETIMEDOUT, 57P01, 57P03, 53300,
 * 08xxx connection exceptions, 40001 serialization failure, 40P01 deadlock,
 * or pool acquire timeouts).
 */
export function isInfrastructureError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>
    const code = typeof err.code === 'string' ? err.code : ''
    if (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === '57P01' ||
      code === '57P03' ||
      code === '53300' ||
      code === '40001' ||
      code === '40P01' ||
      code.startsWith('08')
    ) {
      return true
    }
    const message = typeof err.message === 'string' ? err.message : ''
    if (
      message.includes('timeout exceeded when trying to connect') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('Connection terminated')
    ) {
      return true
    }
  }
  return false
}

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
  /** Stream that receives entries which can never commit (quarantine). */
  dlqKey: string
  /**
   * Delivery ceiling. A transient failure is retried with backoff until the
   * entry has been delivered this many times; then it is dead-lettered.
   */
  maxDeliveryAttempts: number
  /** Cutoff age in seconds above which any failing entry is quarantined to DLQ regardless of error. */
  dlqMaxAgeSeconds?: number
  /**
   * Sessions awaiting a backoff retry, keyed by sessionId. Shared per drainer
   * process so pacing survives across ticks; the PEL delivery count remains the
   * durable attempt source of truth (it survives restarts), this only schedules.
   */
  retryState?: Map<string, { ids: string[]; nextAttemptAt: number }>
  /** Releases the request-path dedupe reservation when an entry is dead-lettered. */
  releaseDedupe?: (sessionId: string, userId: string, checkpoint?: string) => Promise<void>
}

export interface DrainResult {
  read: number
  acked: number
  written: number
  duplicates: number
  /** Sessions whose commit threw and stayed pending (retried on a later tick). */
  failed: number
  /** Entries moved to the dead-letter stream and acknowledged out of the PEL. */
  deadLettered: number
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
 * Failures leave entries pending so a retry replays them (at-least-once), until
 * the delivery ceiling is reached — then the entry is quarantined to the DLQ and
 * acknowledged so a poison scan cannot stall the stream (and every session) with it.
 */
export async function drainOnce(deps: DrainerDeps): Promise<DrainResult> {
  // Retries scheduled by an earlier failure come first: they are already
  // accounted for in the PEL, so leaving them behind new traffic would grow the
  // oldest-pending age the request path uses for backpressure.
  const retried = await processDueRetries(deps)
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
  const fresh = await commitMessages(deps, messages)
  return {
    read: retried.read + fresh.read,
    acked: retried.acked + fresh.acked,
    written: retried.written + fresh.written,
    duplicates: retried.duplicates + fresh.duplicates,
    failed: retried.failed + fresh.failed,
    deadLettered: retried.deadLettered + fresh.deadLettered,
  }
}

/**
 * Exponential backoff between delivery attempts: 500 ms, 1 s, 2 s, 4 s, then a
 * 5 s ceiling. The cap bounds how long a transient outage can hide a scan while
 * still giving Postgres time to recover between attempts.
 */
function retryDelayMs(attempts: number): number {
  return Math.min(500 * 2 ** Math.max(0, attempts - 1), 5_000)
}

/**
 * Re-delivers this consumer's own scheduled retries whose backoff has elapsed,
 * then commits them. Claiming rather than reading removes the need to remember
 * payloads: XCLAIM also bumps the delivery count the quarantine decision uses,
 * and entries trimmed or acknowledged elsewhere simply come back empty.
 */
async function processDueRetries(deps: DrainerDeps): Promise<DrainResult> {
  const aggregate: DrainResult = { read: 0, acked: 0, written: 0, duplicates: 0, failed: 0, deadLettered: 0 }
  const retryState = deps.retryState
  if (!retryState || retryState.size === 0) return aggregate
  const now = deps.now ? deps.now() : Date.now()
  for (const [sessionId, state] of [...retryState]) {
    if (state.nextAttemptAt > now) continue
    if (state.ids.length === 0) {
      retryState.delete(sessionId)
      continue
    }
    // min-idle 0 is deliberate: the idle clock is not our schedule — a failed
    // entry may be only milliseconds old when its backoff expires.
    const reply = await deps.redis.xclaim(deps.streamKey, deps.group, deps.consumer, 0, ...state.ids)
    const messages = parseMessages(reply)
    if (messages.length === 0) {
      retryState.delete(sessionId)
      continue
    }
    const result = await commitMessages(deps, messages)
    aggregate.read += result.read
    aggregate.acked += result.acked
    aggregate.written += result.written
    aggregate.duplicates += result.duplicates
    aggregate.failed += result.failed
    aggregate.deadLettered += result.deadLettered
  }
  return aggregate
}

/**
 * Reads each failed entry's PEL delivery count in ONE round trip. Redis keeps
 * that count durably (it survives a restart, unlike an in-process counter), so
 * it is the authoritative attempt number; the retry schedule is only a pacing
 * hint layered on top.
 */
async function deliveryCounts(deps: DrainerDeps, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ids.length === 0) return counts
  const pipeline = deps.redis.pipeline()
  for (const id of ids) pipeline.xpending(deps.streamKey, deps.group, id, id, 1)
  const replies = await pipeline.exec()
  if (!replies) return counts
  replies.forEach((reply, index) => {
    const id = ids[index]
    if (!id) return
    const [commandError, result] = reply
    if (commandError || !Array.isArray(result)) return
    // Detail form: [[id, consumer, idleMs, deliveries]]; empty once the entry
    // left the PEL (acked by another consumer), in which case 0 is correct.
    const detail = result[0]
    if (!Array.isArray(detail)) return
    const deliveries = Number(detail[3])
    if (Number.isFinite(deliveries)) counts.set(id, deliveries)
  })
  return counts
}

/**
 * Quarantines never-committable entries to the dead-letter stream, one XADD per
 * entry, then lets the caller acknowledge them. The entry is copied verbatim
 * (`payload`) so an operator can re-enqueue a repaired scan; the rest is audit
 * metadata — why it died, where it came from, and how many deliveries it took.
 */
async function quarantine(
  deps: DrainerDeps,
  sessionId: string,
  message: StreamMessage,
  error: unknown,
  attempts: number,
): Promise<void> {
  const scan = message.scan
  if (!scan) return
  const reason = error instanceof Error ? error.message : String(error)
  await deps.redis.xadd(
    deps.dlqKey,
    '*',
    'payload',
    JSON.stringify(scan),
    'originalId',
    message.id,
    'sessionId',
    sessionId,
    'userId',
    scan.userId,
    'error',
    reason,
    'failedAt',
    new Date(deps.now ? deps.now() : Date.now()).toISOString(),
    'attempts',
    String(attempts),
  )
  if (deps.releaseDedupe) {
    if (scan.checkpoint) {
      await deps.releaseDedupe(sessionId, scan.userId, scan.checkpoint).catch(() => undefined)
    } else {
      await deps.releaseDedupe(sessionId, scan.userId).catch(() => undefined)
    }
  }
}

async function commitMessages(deps: DrainerDeps, messages: StreamMessage[]): Promise<DrainResult> {
  const { writer, streamKey, group, retryState } = deps
  const result: DrainResult = { read: 0, acked: 0, written: 0, duplicates: 0, failed: 0, deadLettered: 0 }
  if (messages.length === 0) return result
  result.read = messages.length

  const malformed = messages.filter((message) => !message.scan).map((message) => message.id)
  const bySession = new Map<string, StreamMessage[]>()
  for (const message of messages) {
    if (!message.scan) continue
    const list = bySession.get(message.scan.sessionId) ?? []
    list.push(message)
    bySession.set(message.scan.sessionId, list)
  }

  const acknowledged: string[] = [...malformed]

  // Distinct sessions are independent transactions; running a bounded number in
  // parallel keeps the drainer ahead of ingest. Within one session the batch is
  // still a single advisory-locked transaction in stream order.
  const queue = [...bySession.entries()]
  const runSession = async ([sessionId, batch]: [string, StreamMessage[]]) => {
    const nowMs = deps.now ? deps.now() : Date.now()
    try {
      const committed = await writer.writeBatch(
        sessionId,
        batch.map((message) => message.scan),
      )
      result.written += committed.written
      result.duplicates += committed.duplicates
      for (const message of batch) acknowledged.push(message.id)
      retryState?.delete(sessionId)
      if (deps.publish) await deps.publish(sessionId, batch.map((message) => message.scan))
    } catch (error) {
      // Requirement 2: On PermanentWriteError with batch.length > 1, retry each scan individually;
      // quarantine only the scans that fail again.
      if (error instanceof PermanentWriteError && batch.length > 1) {
        const retryIds: string[] = []
        for (const message of batch) {
          try {
            const single = await writer.writeBatch(sessionId, [message.scan])
            result.written += single.written
            result.duplicates += single.duplicates
            acknowledged.push(message.id)
            if (deps.publish) await deps.publish(sessionId, [message.scan])
          } catch (indivError) {
            if (isInfrastructureError(indivError)) {
              retryIds.push(message.id)
            } else {
              await quarantine(deps, sessionId, message, indivError, 1)
              acknowledged.push(message.id)
              result.deadLettered += 1
            }
          }
        }
        if (retryIds.length > 0) {
          result.failed += 1
          retryState?.set(sessionId, { ids: retryIds, nextAttemptAt: nowMs + 500 })
        } else {
          retryState?.delete(sessionId)
        }
        return
      }

      // Requirement 1: Infrastructure errors never count toward INGEST_MAX_DELIVERY_ATTEMPTS:
      // keep retrying with the 5 s backoff cap.
      // Add INGEST_DLQ_MAX_AGE_SECONDS (default 1800) as the only age-based cutoff.
      const permanent = error instanceof PermanentWriteError
      const infra = isInfrastructureError(error)
      const dlqMaxAgeSeconds = deps.dlqMaxAgeSeconds ?? 1800
      const attemptsById = await deliveryCounts(
        deps,
        batch.map((message) => message.id),
      )
      const retryIds: string[] = []
      let maxAttempts = 0
      for (const message of batch) {
        const attempts = Math.max(1, attemptsById.get(message.id) ?? 0)
        maxAttempts = Math.max(maxAttempts, attempts)
        const enqueuedAt = Number(message.id.split('-')[0])
        const isEpochTimestamp =
          Number.isFinite(enqueuedAt) && (enqueuedAt > 1_000_000_000_000 || nowMs < 1_000_000_000_000)
        const ageSeconds = isEpochTimestamp ? Math.max(0, (nowMs - enqueuedAt) / 1000) : 0
        const expired = ageSeconds >= dlqMaxAgeSeconds

        const shouldQuarantine = permanent || expired || (!infra && attempts >= deps.maxDeliveryAttempts)
        if (shouldQuarantine) {
          await quarantine(deps, sessionId, message, error, attempts)
          // XACK removes it from the PEL, so its age stops feeding the
          // campus-wide 503 backpressure guard.
          acknowledged.push(message.id)
          result.deadLettered += 1
        } else {
          retryIds.push(message.id)
        }
      }
      if (retryIds.length > 0) {
        result.failed += 1
        retryState?.set(sessionId, { ids: retryIds, nextAttemptAt: nowMs + retryDelayMs(maxAttempts) })
      } else {
        retryState?.delete(sessionId)
      }
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
  result.acked = acknowledged.length
  return result
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

