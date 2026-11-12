import { z } from 'zod'

/**
 * Ingest configuration. Deliberately small: the gateway owns four paths and a
 * drainer, and every knob that affects correctness is bounded here rather than
 * read ad hoc at the call site.
 */
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
