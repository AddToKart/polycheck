/**
 * Runtime roles and bootstrap.
 *
 * Three process shapes, selected by `INGEST_ROLE`:
 *   - `http`  : Fastify only (cluster mode forks `INGEST_HTTP_WORKERS` of them)
 *   - `drain` : the single ordered micro-batch drainer + its own health port
 *   - `all`   : both in one process — the original behaviour and the default
 *
 * The split exists so CPU-bound token verification scales with cores while the
 * hash-chain writer stays a single instance: one process fleet-wide takes the
 * per-session advisory lock, so batch ordering is unchanged.
 */
import cluster, { type Worker } from 'node:cluster'
import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { loadConfig, type IngestConfig } from './config'
import { buildServer, type AuthedUser, type AuthResolution, type HotPathProbe } from './http'
import { buildInternalServer } from './internal-server'
import {
  appendScan,
  claimStale,
  createTrimScheduler,
  drainOnce,
  ensureConsumerGroup,
  pendingSummary,
  streamDepth,
  summarizePending,
  type BufferedScan,
  type DrainResult,
} from './queue'
import { ACTIVE_SESSION_KEY_PREFIX, parseSessionSnapshot } from './snapshot'
import { createMetrics, mergeIngestMetrics, renderMetrics, type IngestMetrics } from './metrics'
import { createPgWriter } from './writer'

export type RuntimePlan =
  | { kind: 'single'; role: 'all' | 'http' | 'drain' }
  | { kind: 'cluster-primary'; workers: number }
  | { kind: 'cluster-worker' }

/**
 * Decides what this process is. `all` and `drain` never fork; only `http` with
 * more than one worker does, and the forked children resolve to `cluster-worker`
 * because `cluster.isWorker` is true in them.
 */
export function resolveRuntimePlan(
  config: IngestConfig,
  status: { isPrimary: boolean; isWorker: boolean } = { isPrimary: cluster.isPrimary, isWorker: cluster.isWorker },
): RuntimePlan {
  if (config.INGEST_ROLE !== 'http') return { kind: 'single', role: config.INGEST_ROLE }
  if (!config.INGEST_CLUSTER_ENABLED || config.INGEST_HTTP_WORKERS <= 1) return { kind: 'single', role: 'http' }
  return status.isWorker ? { kind: 'cluster-worker' } : { kind: 'cluster-primary', workers: config.INGEST_HTTP_WORKERS }
}

export interface RuntimeHandle {
  shutdown: () => Promise<void>
}

const sleep = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

const authCacheKey = (authorization: string) =>
  `polycheck:ingest:auth:${createHash('sha256').update(authorization).digest('hex')}`

/**
 * Bearer sessions are resolved through an ingest-owned cache.
 *
 * Three outcomes, and the distinction matters:
 *   { user }        — authenticated
 *   null            — the control plane positively rejected the session
 *   { unavailable } — we could not ask (timeout/network/5xx)
 *
 * Mapping the third onto `null` would answer 401 to every student during an
 * upstream blip — a terminal status that makes clients drop the session — so it
 * is surfaced separately and the route answers a retryable 503 instead.
 *
 * A cold cache during a bell rush would otherwise fire one `/auth/me` per
 * student simultaneously, so lookups are single-flighted per token and capped at
 * INGEST_AUTH_REFRESH_CONCURRENCY in flight; the rest wait their turn.
 */
export function createAuthResolver(config: IngestConfig, redis: Redis) {
  const inflightAuth = new Map<string, Promise<AuthResolution>>()
  let authInFlight = 0
  const authWaiters: Array<() => void> = []

  const withAuthSlot = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (authInFlight >= config.INGEST_AUTH_REFRESH_CONCURRENCY) {
      await new Promise<void>((resolve) => authWaiters.push(resolve))
    }
    authInFlight += 1
    try {
      return await fn()
    } finally {
      authInFlight -= 1
      authWaiters.shift()?.()
    }
  }

  return async function resolveUser(authorization: string | undefined): Promise<AuthResolution> {
    if (!authorization) return null
    const key = authCacheKey(authorization)

    const cached = await redis.get(key)
    if (cached) {
      // A negative entry is cached briefly so a rejected token cannot re-storm.
      return cached === 'denied' ? null : { user: JSON.parse(cached) as AuthedUser }
    }

    const existing = inflightAuth.get(key)
    if (existing) return existing

    const lookup = withAuthSlot(async (): Promise<AuthResolution> => {
      try {
        const response = await fetch(`${config.CONTROL_PLANE_URL}/auth/me`, {
          headers: { authorization: `Bearer ${authorization}` },
          signal: AbortSignal.timeout(5_000),
        })
        if (response.status === 401 || response.status === 403) {
          await redis.set(key, 'denied', 'EX', 30)
          return null
        }
        if (!response.ok) return { unavailable: true }
        const body = (await response.json()) as {
          id?: string
          role?: string
          privacyConsentAccepted?: boolean
        }
        if (typeof body.id !== 'string' || typeof body.role !== 'string') return { unavailable: true }
        const user: AuthedUser = {
          id: body.id,
          role: body.role,
          privacyConsent: body.privacyConsentAccepted !== false,
        }
        await redis.set(key, JSON.stringify(user), 'EX', config.INGEST_AUTH_CACHE_TTL_SECONDS)
        return { user }
      } catch {
        // Timeout / connection failure: not the same thing as "invalid session".
        return { unavailable: true }
      }
    }).finally(() => inflightAuth.delete(key))

    inflightAuth.set(key, lookup)
    return lookup
  }
}

/** Redis-backed attempt counter, identical key shape to the control plane. */
export function createPinAttemptConsumer(redis: Redis) {
  return async function consumePinAttempt(key: string, limit: number, windowMs: number): Promise<boolean> {
    const value = await redis.incr(key)
    if (value === 1) await redis.pexpire(key, windowMs)
    return value <= limit
  }
}

/**
 * One pipelined Redis round-trip for the three reads every scan needs: pending
 * summary (backpressure + lag) and the session snapshot. NOGROUP is folded into
 * an empty summary; any other error propagates.
 */
export function createHotPathProbe(redis: Redis, config: IngestConfig) {
  const streamKey = config.INGEST_STREAM_KEY
  const group = config.INGEST_CONSUMER_GROUP
  return async function probeHotPath(sessionId: string): Promise<HotPathProbe> {
    const results = await redis
      .pipeline()
      .xpending(streamKey, group)
      .get(`${ACTIVE_SESSION_KEY_PREFIX}${sessionId}`)
      .exec()
    if (!Array.isArray(results)) throw new Error('Redis pipeline aborted while reading the hot path')

    const [, pendingRaw] = results[0] ?? []
    const [, snapshotRaw] = results[1] ?? []
    const pending = summarizePending(pendingRaw)
    return {
      depth: pending.count,
      lag: pending.lagSeconds,
      snapshot: typeof snapshotRaw === 'string' ? parseSessionSnapshot(snapshotRaw) : undefined,
    }
  }
}

/**
 * Workers report their counters to the cluster primary over IPC. The primary is
 * the single scrape point (`INGEST_METRICS_PORT`), so a Prometheus scrape sees
 * container totals instead of whatever worker accepted the connection.
 */
function startWorkerMetricsReporter(metrics: IngestMetrics): NodeJS.Timeout | null {
  if (typeof process.send !== 'function') return null
  const send = () => {
    try {
      process.send?.({ type: 'ingest-metrics', snapshot: metrics })
    } catch (error) {
      // The IPC channel closes during worker shutdown; reporting just stops.
      console.error('[ingest] metrics report failed:', error instanceof Error ? error.message : error)
    }
  }
  const timer = setInterval(send, 2_000)
  timer.unref()
  const initial = setTimeout(send, 100)
  initial.unref()
  return timer
}

export async function bootstrapHttp(config: IngestConfig, metrics: IngestMetrics): Promise<RuntimeHandle> {
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: true })
  const streamKey = config.INGEST_STREAM_KEY
  const group = config.INGEST_CONSUMER_GROUP

  const app = buildServer({
    config,
    redis,
    appendScan: (scan) => appendScan(redis, streamKey, scan),
    bufferDepth: async () => (await pendingSummary(redis, streamKey, group)).count,
    bufferLagSeconds: async () => (await pendingSummary(redis, streamKey, group)).lagSeconds,
    streamLength: () => streamDepth(redis, streamKey),
    probeHotPath: createHotPathProbe(redis, config),
    resolveUser: createAuthResolver(config, redis),
    consumePinAttempt: createPinAttemptConsumer(redis),
    // SET NX is the atomic claim: two concurrent scans of the same session by
    // the same student cannot both see "not reserved". Release on a failed
    // append keeps a retry from being answered as a duplicate for the full TTL.
    reserveScan: async (sessionId, userId, ttl, checkpoint) =>
      (await redis.set(
        checkpoint
          ? `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:${checkpoint}`
          : `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}`,
        '1',
        'EX',
        ttl,
        'NX',
      )) === 'OK',
    releaseScan: async (sessionId, userId, checkpoint) => {
      const keys = [
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}`,
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:start`,
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:end`,
      ]
      if (checkpoint) {
        keys.unshift(`${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:${checkpoint}`)
      }
      await redis.del(...keys)
    },
    dlqDepth: () => streamDepth(redis, config.INGEST_DLQ_STREAM_KEY),
    metrics,
  })

  await app.listen({ port: config.PORT, host: config.HOST })
  console.log(`[ingest] http worker pid=${process.pid} listening on ${config.HOST}:${config.PORT}`)
  const reporter = startWorkerMetricsReporter(metrics)

  return {
    shutdown: async () => {
      clearInterval(reporter ?? undefined)
      await app.close()
      await redis.quit()
    },
  }
}

interface DrainState {
  lastTickAt: number
  consecutiveFailures: number
  running: boolean
}

export async function bootstrapDrain(
  config: IngestConfig,
  metrics: IngestMetrics,
  options: { exposeInternalServer: boolean },
): Promise<RuntimeHandle> {
  if (!config.INGEST_DRAINER_ENABLED) {
    if (config.INGEST_ROLE === 'drain') {
      throw new Error('INGEST_ROLE=drain requires INGEST_DRAINER_ENABLED=true')
    }
    console.log('[ingest] drainer disabled (INGEST_DRAINER_ENABLED=false); buffering only')
    return { shutdown: async () => {} }
  }
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required when the drainer is enabled')

  const streamKey = config.INGEST_STREAM_KEY
  const group = config.INGEST_CONSUMER_GROUP
  const consumer = config.INGEST_CONSUMER_NAME

  // `AttendanceRecord.timestamp` is `timestamp without time zone` (Prisma's
  // default). A second writer MUST therefore use the same session time zone as
  // the control plane or it stores a different naive instant and every chain
  // hash it writes fails verification. The control plane runs UTC; pin it here
  // rather than inheriting whatever the host happens to be.
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.INGEST_DB_POOL_SIZE,
    options: '-c TimeZone=UTC',
  })
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: true })
  const writer = createPgWriter(pool)

  await ensureConsumerGroup(redis, streamKey, group)

  const state: DrainState = { lastTickAt: Date.now(), consecutiveFailures: 0, running: false }
  /** Entries idle longer than this are considered abandoned by a dead consumer. */
  const STALE_PENDING_IDLE_MS = 30_000
  const trim = createTrimScheduler({
    redis,
    streamKey,
    group,
    maxlen: config.INGEST_STREAM_MAXLEN,
    intervalMs: config.INGEST_STREAM_TRIM_INTERVAL_SECONDS * 1_000,
  })

  const applyDrainResult = async (result: DrainResult) => {
    metrics.drainWritten += result.written
    metrics.drainDuplicates += result.duplicates
    metrics.drainFailures += result.failed
    metrics.deadLetterTotal += result.deadLettered
    return result
  }

  /** Best-effort and self-throttled; a failed trim must never block the loop. */
  const trimOnce = async () => {
    try {
      const trimmed = await trim()
      metrics.streamTrimmed += trimmed.trimmed
    } catch (error) {
      console.error('[ingest] stream trim failed:', error instanceof Error ? error.message : error)
    }
  }

  /**
   * Delivery bookkeeping for poison messages, keyed by stream entry id. ONE map
   * per drainer process: a fresh map would reset every attempt counter on
   * restart, so a message that kills the drainer would loop forever instead of
   * eventually landing in the DLQ.
   */
  const retryState = new Map<string, { ids: string[]; nextAttemptAt: number }>()

  const drainerDeps = {
    redis,
    writer,
    streamKey,
    group,
    consumer,
    batchMax: config.INGEST_BATCH_MAX,
    dlqKey: config.INGEST_DLQ_STREAM_KEY,
    maxDeliveryAttempts: config.INGEST_MAX_DELIVERY_ATTEMPTS,
    dlqMaxAgeSeconds: config.INGEST_DLQ_MAX_AGE_SECONDS,
    releaseDedupe: async (sessionId: string, userId: string, checkpoint?: string) => {
      const keys = [
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}`,
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:start`,
        `${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:end`,
      ]
      if (checkpoint) {
        keys.unshift(`${config.INGEST_DEDUPE_KEY_PREFIX}${sessionId}:${userId}:${checkpoint}`)
      }
      await redis.del(...keys)
    },
    retryState,
    // Distinct sessions commit in parallel; bounded well below the pool so the
    // drainer never queues connections behind itself.
    concurrency: Math.max(1, Math.min(4, config.INGEST_DB_POOL_SIZE)),
    publish: async (sessionId: string, scans: BufferedScan[]) => {
      await redis.publish(
        'ingest:attendance-updated',
        JSON.stringify({ sessionId, count: scans.length, at: new Date().toISOString() }),
      )
    },
  }

  const drainRound = async (startId: '>' | '0') =>
    applyDrainResult(await drainOnce({ ...drainerDeps, startId }))
  const claimRound = async () => applyDrainResult(await claimStale(drainerDeps, STALE_PENDING_IDLE_MS))

  // Replay this consumer's own pending entries after a restart, then reclaim
  // entries stranded by a previous consumer name (pid-based deployments). Both
  // are invisible to `>` reads, and until reclaimed they keep `lag` degraded
  // and block MINID trimming.
  for (let round = 0; round < 50; round += 1) {
    const result = await drainRound('0')
    if (result.read === 0 || result.acked === 0) break
    console.log(`[ingest] replayed pending batch read=${result.read} written=${result.written}`)
  }
  for (let round = 0; round < 50; round += 1) {
    const result = await claimRound()
    if (result.read === 0) break
    console.log(`[ingest] reclaimed stale batch read=${result.read} written=${result.written}`)
  }

  let lastClaimAt = 0
  const tick = async () => {
    if (state.running) return
    state.running = true
    try {
      const result = await drainRound('>')
      let failed = result.failed
      // Idle stream: sweep the PEL for entries a dead consumer never acked.
      if (result.read === 0 && Date.now() - lastClaimAt >= 1_000) {
        lastClaimAt = Date.now()
        const claimed = await claimRound()
        failed += claimed.failed
        if (claimed.read > 0) {
          console.log(
            `[ingest] reclaimed stale batch read=${claimed.read} written=${claimed.written} duplicates=${claimed.duplicates}`,
          )
        }
      }
      // Trim on the interval even when the stream is idle: an already-acked
      // backlog must converge without waiting for new traffic.
      await trimOnce()
      state.lastTickAt = Date.now()
      state.consecutiveFailures = failed > 0 ? state.consecutiveFailures + 1 : 0
      if (result.read > 0) {
        console.log(
          `[ingest] drained read=${result.read} written=${result.written} duplicates=${result.duplicates} acked=${result.acked} failed=${result.failed}`,
        )
      }
    } catch (error) {
      metrics.drainFailures += 1
      state.consecutiveFailures += 1
      console.error('[ingest] drain failed', error)
    } finally {
      state.running = false
    }
  }

  const timer = setInterval(() => void tick(), Math.max(25, config.INGEST_BATCH_WINDOW_MS))
  console.log(
    `[ingest] drainer enabled stream=${streamKey} group=${group} consumer=${consumer} batch=${config.INGEST_BATCH_MAX} maxlen=${config.INGEST_STREAM_MAXLEN}`,
  )

  let internal: FastifyInstance | null = null
  if (options.exposeInternalServer && config.INGEST_DRAIN_PORT > 0) {
    internal = buildInternalServer({
      ready: async () => {
        const checks: Record<string, string> = {}
        let ready = true
        try {
          await redis.ping()
          checks.redis = 'ok'
        } catch {
          checks.redis = 'unavailable'
          ready = false
        }
        const fresh = Date.now() - state.lastTickAt <= config.INGEST_DRAIN_HEALTH_STALE_SECONDS * 1_000
        checks.drainer = fresh ? 'ok' : 'stalled'
        if (!fresh) ready = false
        checks.writes = state.consecutiveFailures >= 3 ? 'failing' : 'ok'
        if (state.consecutiveFailures >= 3) ready = false
        return { ready, checks }
      },
      metricsText: async () => {
        let pending = { count: 0, lagSeconds: 0 }
        let length = 0
        let dlq = 0
        try {
          pending = await pendingSummary(redis, streamKey, group)
          length = await streamDepth(redis, streamKey)
          dlq = await streamDepth(redis, config.INGEST_DLQ_STREAM_KEY)
        } catch (error) {
          console.error('[ingest] drain metrics: redis probe failed:', error instanceof Error ? error.message : error)
        }
        return renderMetrics(metrics, {
          bufferDepth: pending.count,
          streamLength: length,
          lagSeconds: pending.lagSeconds,
          dlqDepth: dlq,
          ready: Date.now() - state.lastTickAt <= config.INGEST_DRAIN_HEALTH_STALE_SECONDS * 1_000,
        })
      },
    })
    await internal.listen({ port: config.INGEST_DRAIN_PORT, host: config.HOST })
    console.log(`[ingest] drainer health/metrics on ${config.HOST}:${config.INGEST_DRAIN_PORT}`)
  }

  return {
    shutdown: async () => {
      clearInterval(timer)
      for (let waited = 0; waited < 5_000 && state.running; waited += 50) await sleep(50)
      await internal?.close()
      await pool.end()
      await redis.quit()
    },
  }
}

async function runClusterPrimary(config: IngestConfig): Promise<void> {
  const workerMetrics = new Map<number, IngestMetrics>()
  const recentExits: number[] = []
  let shuttingDown = false

  const liveWorkers = () =>
    Object.values(cluster.workers ?? {}).filter((worker): worker is Worker => worker !== undefined && !worker.isDead())
  const liveCount = () => liveWorkers().length

  let metricsServer: FastifyInstance | null = null
  let metricsRedis: Redis | null = null
  if (config.INGEST_METRICS_PORT > 0) {
    const metricsRedisClient = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 })
    metricsRedis = metricsRedisClient
    metricsServer = buildInternalServer({
      ready: async () => {
        const checks: Record<string, string> = {}
        let ready = true
        try {
          await metricsRedisClient.ping()
          checks.redis = 'ok'
        } catch {
          checks.redis = 'unavailable'
          ready = false
        }
        const alive = liveCount()
        checks.workers = alive > 0 ? 'ok' : 'unavailable'
        if (alive === 0) ready = false
        return { ready, checks }
      },
      metricsText: async () => {
        let pending = { count: 0, lagSeconds: 0 }
        let length = 0
        let dlq = 0
        try {
          pending = await pendingSummary(metricsRedisClient, config.INGEST_STREAM_KEY, config.INGEST_CONSUMER_GROUP)
          length = await streamDepth(metricsRedisClient, config.INGEST_STREAM_KEY)
          dlq = await streamDepth(metricsRedisClient, config.INGEST_DLQ_STREAM_KEY)
        } catch (error) {
          console.error('[ingest] primary metrics: redis probe failed:', error instanceof Error ? error.message : error)
        }
        return renderMetrics(mergeIngestMetrics([...workerMetrics.values()]), {
          bufferDepth: pending.count,
          streamLength: length,
          lagSeconds: pending.lagSeconds,
          dlqDepth: dlq,
          ready: liveCount() > 0,
        })
      },
    })
    try {
      await metricsServer.listen({ port: config.INGEST_METRICS_PORT, host: config.HOST })
      console.log(`[ingest] primary metrics on ${config.HOST}:${config.INGEST_METRICS_PORT}`)
    } catch (error) {
      // Observability is degraded, ingestion is not: log and keep serving.
      console.error('[ingest] primary metrics server failed to start:', error instanceof Error ? error.message : error)
      await metricsServer.close().catch(() => undefined)
      metricsServer = null
    }
  }

  const forkWorker = () => cluster.fork()

  cluster.on('message', (worker, message) => {
    const payload = message as { type?: string; snapshot?: IngestMetrics } | null
    if (!payload || payload.type !== 'ingest-metrics' || !payload.snapshot) return
    workerMetrics.set(worker.id, payload.snapshot)
  })

  cluster.on('exit', (worker, code, signal) => {
    workerMetrics.delete(worker.id)
    if (shuttingDown) return
    const now = Date.now()
    recentExits.push(now)
    while (recentExits.length > 0 && now - recentExits[0]! > 60_000) recentExits.shift()
    if (recentExits.length > 10) {
      console.error(`[ingest] primary: ${recentExits.length} worker exits within 60s; refusing to respawn`)
      void shutdown('crash-loop')
      return
    }
    console.error(`[ingest] primary: worker ${worker.process.pid} exited (code=${code} signal=${signal}); respawning`)
    forkWorker()
  })

  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[ingest] primary ${signal}: stopping ${liveCount()} worker(s)`)
    for (const worker of liveWorkers()) worker.process.kill('SIGTERM')
    const deadline = Date.now() + 10_000
    while (liveCount() > 0 && Date.now() < deadline) await sleep(100)
    for (const worker of liveWorkers()) worker.process.kill('SIGKILL')
    await metricsServer?.close().catch(() => undefined)
    await metricsRedis?.quit().catch(() => undefined)
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  for (let index = 0; index < config.INGEST_HTTP_WORKERS; index += 1) forkWorker()
  console.log(
    `[ingest] primary pid=${process.pid}: forked ${config.INGEST_HTTP_WORKERS} http worker(s) on ${config.HOST}:${config.PORT}`,
  )
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(env)
  const metrics = createMetrics()
  const plan = resolveRuntimePlan(config)

  if (plan.kind === 'cluster-primary') return runClusterPrimary(config)

  if ((plan.kind === 'cluster-worker' || plan.role === 'http') && config.INGEST_DRAINER_ENABLED) {
    console.warn('[ingest] INGEST_DRAINER_ENABLED is ignored in INGEST_ROLE=http; run the drain role separately')
  }

  const handles: RuntimeHandle[] = []
  if (plan.kind === 'cluster-worker' || plan.role === 'http') {
    handles.push(await bootstrapHttp(config, metrics))
  } else if (plan.role === 'drain') {
    handles.push(await bootstrapDrain(config, metrics, { exposeInternalServer: true }))
  } else {
    handles.push(await bootstrapDrain(config, metrics, { exposeInternalServer: false }))
    handles.push(await bootstrapHttp(config, metrics))
  }

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[ingest] ${signal} received, closing`)
    for (const handle of handles) {
      try {
        await handle.shutdown()
      } catch (error) {
        console.error('[ingest] shutdown step failed:', error instanceof Error ? error.message : error)
      }
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}
