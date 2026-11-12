/**
 * Bootstrap. Wires Redis, the optional drainer, and the HTTP surface.
 *
 * The request path only ever touches Redis; Postgres is opened lazily and only
 * when the drainer is enabled, so a database outage cannot stop scans from being
 * accepted and buffered.
 */
import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import { loadConfig } from './config'
import { buildServer, type AuthedUser } from './http'
import type { SessionSnapshot } from './core/scan'
import { appendScan, drainOnce, ensureConsumerGroup, oldestPendingAgeSeconds, streamDepth } from './queue'
import { createPgWriter } from './writer'
import { readSessionSnapshot } from './snapshot'
import { createMetrics } from './metrics'
import { Pool } from 'pg'

const config = loadConfig()
const metrics = createMetrics()
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: true })

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
type AuthResult = { user: AuthedUser } | { unavailable: true } | null

const authCacheKey = (authorization: string) =>
  `polycheck:ingest:auth:${createHash('sha256').update(authorization).digest('hex')}`

const inflightAuth = new Map<string, Promise<AuthResult>>()
let authInFlight = 0
const authWaiters: Array<() => void> = []

async function withAuthSlot<T>(fn: () => Promise<T>): Promise<T> {
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

async function resolveUser(authorization: string | undefined): Promise<AuthResult> {
  if (!authorization) return null
  const key = authCacheKey(authorization)

  const cached = await redis.get(key)
  if (cached) {
    // A negative entry is cached briefly so a rejected token cannot re-storm.
    return cached === 'denied' ? null : { user: JSON.parse(cached) as AuthedUser }
  }

  const existing = inflightAuth.get(key)
  if (existing) return existing

  const lookup = withAuthSlot(async (): Promise<AuthResult> => {
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

/** Redis-backed attempt counter, identical key shape to the control plane. */
async function consumePinAttempt(key: string, limit: number, windowMs: number): Promise<boolean> {
  const value = await redis.incr(key)
  if (value === 1) await redis.pexpire(key, windowMs)
  return value <= limit
}

const app = buildServer({
  config,
  redis,
  appendScan: (scan) => appendScan(redis, config.INGEST_STREAM_KEY, scan),
  bufferDepth: () => streamDepth(redis, config.INGEST_STREAM_KEY),
  bufferLagSeconds: () => oldestPendingAgeSeconds(redis, config.INGEST_STREAM_KEY, config.INGEST_CONSUMER_GROUP),
  resolveUser,
  readSnapshot: (sessionId: string) => readSessionSnapshot(redis, sessionId),
  consumePinAttempt,
  metrics,
})

async function startDrainer(): Promise<void> {
  if (!config.INGEST_DRAINER_ENABLED) {
    console.log('[ingest] drainer disabled (INGEST_DRAINER_ENABLED=false); buffering only')
    return
  }
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required when the drainer is enabled')

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
  const writer = createPgWriter(pool)

  await ensureConsumerGroup(redis, config.INGEST_STREAM_KEY, config.INGEST_CONSUMER_GROUP)

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const result = await drainOnce({
        redis,
        writer,
        streamKey: config.INGEST_STREAM_KEY,
        group: config.INGEST_CONSUMER_GROUP,
        consumer: config.INGEST_CONSUMER_NAME,
        batchMax: config.INGEST_BATCH_MAX,
        publish: async (sessionId, scans) => {
          await redis.publish(
            'ingest:attendance-updated',
            JSON.stringify({ sessionId, count: scans.length, at: new Date().toISOString() }),
          )
        },
      })
      metrics.drainWritten += result.written
      if (result.read > 0) {
        console.log(
          `[ingest] drained read=${result.read} written=${result.written} acked=${result.acked}`,
        )
      }
    } catch (error) {
      metrics.drainFailures += 1
      console.error('[ingest] drain failed', error)
    } finally {
      running = false
    }
  }

  console.log(
    `[ingest] drainer enabled stream=${config.INGEST_STREAM_KEY} group=${config.INGEST_CONSUMER_GROUP} consumer=${config.INGEST_CONSUMER_NAME} batch=${config.INGEST_BATCH_MAX}`,
  )
  setInterval(() => void tick(), Math.max(25, config.INGEST_BATCH_WINDOW_MS))
}

async function main(): Promise<void> {
  await startDrainer()
  await app.listen({ port: config.PORT, host: config.HOST })
  console.log(`[ingest] listening on ${config.HOST}:${config.PORT}`)

  const shutdown = async (signal: string) => {
    console.log(`[ingest] ${signal} received, closing`)
    await app.close()
    await redis.quit()
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

void main()
