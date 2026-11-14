import { availableParallelism } from 'node:os'
import { z } from 'zod'

/**
 * Ingest configuration. Deliberately small: the gateway owns four paths and a
 * drainer, and every knob that affects correctness is bounded here rather than
 * read ad hoc at the call site.
 */
const defaultHttpWorkers = Math.max(1, Math.min(32, availableParallelism() - 1))

export const ingestConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  HOST: z.string().default('0.0.0.0'),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Enables the drainer. Off lets Phase 1/2 run without touching Postgres. */
  INGEST_DRAINER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /**
   * Accepted work is buffered here; the drainer consumes from the group.
   * Carries the `polycheck:` prefix that `RedisService` applies to every key, so
   * the control plane's fallback drainer addresses the same stream.
   */
  INGEST_STREAM_KEY: z.string().default('polycheck:ingest:scans'),
  INGEST_CONSUMER_GROUP: z.string().default('ingest-workers'),
  INGEST_CONSUMER_NAME: z.string().default(`ingest-${process.pid}`),

  /**
   * Backpressure. Above this depth the gateway answers 503 instead of
   * accepting work it cannot flush — 503 is retryable by every client's
   * sync classifier, so a full buffer degrades to "try again" rather than loss.
   */
  INGEST_MAX_BUFFER: z.coerce.number().int().min(1).default(50_000),
  INGEST_MAX_LAG_SECONDS: z.coerce.number().int().min(1).default(30),

  /** Drainer batching. */
  INGEST_BATCH_MAX: z.coerce.number().int().min(1).max(1_000).default(200),
  INGEST_BATCH_WINDOW_MS: z.coerce.number().int().min(1).max(5_000).default(30),

  /** Session snapshot cache. */
  INGEST_SNAPSHOT_TTL_SECONDS: z.coerce.number().int().min(1).default(120),
  INGEST_AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(900),

  /** NestJS control plane, used only to resolve an auth-cache miss. */
  CONTROL_PLANE_URL: z.string().url().default('http://backend:4000/api'),
    /**
   * Parallel `/auth/me` lookups on a cold cache. A bell rush starts cold, so this
   * is sized for ~2,000 unknown sessions: at the measured ~11 ms per lookup,
   * 64 concurrent clears 2,000 in well under a second instead of serialising
   * them into 20-second waits.
   */
  INGEST_AUTH_REFRESH_CONCURRENCY: z.coerce.number().int().min(1).max(256).default(64),

  /** Drainer pool, intentionally much smaller than the control plane's. */
  INGEST_DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(8),

  /**
   * Process role:
   *   `all`   — both surfaces in one process (the original behaviour)
   *   `http`  — Fastify workers only; never drains
   *   `drain` — the single ordered drainer + its own health/metrics port
   */
  INGEST_ROLE: z.enum(['all', 'http', 'drain']).default('all'),

  /** Fork `INGEST_HTTP_WORKERS` workers with node:cluster (role `http`). */
  INGEST_CLUSTER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /** HTTP workers to fork in cluster mode; defaults to available cores - 1. */
  INGEST_HTTP_WORKERS: z.coerce.number().int().min(1).max(32).default(defaultHttpWorkers),

  /** Drainer-role health/metrics port; 0 disables the internal server. */
  INGEST_DRAIN_PORT: z.coerce.number().int().min(0).max(65_535).default(4002),

  /** Cluster-primary aggregation port; 0 disables it. */
  INGEST_METRICS_PORT: z.coerce.number().int().min(0).max(65_535).default(4003),

  /**
   * Approximate retained-entry cap, enforced by the drainer's XACK cycle.
   * 0 disables trimming. Producers never trim: a backlog larger than this cap
   * must be rejected by backpressure, not silently evicted from the stream.
   */
  INGEST_STREAM_MAXLEN: z.coerce.number().int().min(0).default(50_000),
  INGEST_STREAM_TRIM_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(3_600).default(30),

  /** Drainer health: a tick older than this marks the drainer `stalled`. */
  INGEST_DRAIN_HEALTH_STALE_SECONDS: z.coerce.number().int().min(1).default(30),

  /**
   * Deliveries before a poison message is quarantined to the DLQ. A message
   * that can never commit (deleted session, FK/enum violation) must not keep
   * the request path in backpressure: after this many failed deliveries it is
   * copied to the dead-letter stream and acked from the live stream.
   */
  INGEST_MAX_DELIVERY_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),

  /**
   * Dead-letter stream. Ingest-only (the NestJS fallback drainer never reads
   * it); entries are inspected with XRANGE and replayed manually after a fix.
   * The `polycheck:ingest:` prefix keeps one namespace for every ingest key.
   */
  INGEST_DLQ_STREAM_KEY: z.string().default('polycheck:ingest:dead-letter'),

  /**
   * Request-path dedupe reservation TTL. Fixed 24 h rather than "session
   * lifespan": the snapshot carries no lifespan fields, and deriving one would
   * add a lookup to the hot path. Covers the practical live-replay horizon.
   */
  INGEST_DEDUPE_TTL_SECONDS: z.coerce.number().int().min(60).default(86_400),

  /** Reservation key namespace: `<prefix><sessionId>:<userId>`. */
  INGEST_DEDUPE_KEY_PREFIX: z.string().default('polycheck:ingest:dedupe:'),
})

export type IngestConfig = z.infer<typeof ingestConfigSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const parsed = ingestConfigSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid ingest configuration: ${issues}`)
  }
  return parsed.data
}
