import type { IngestConfig } from '../src/config'

/**
 * One authoritative config literal for the route tests. Vitest resolves the
 * zod schema at runtime elsewhere, but the handler types need every field, so a
 * shared fixture keeps `config.ts` additions from drifting into N test files.
 */
export const testConfig: IngestConfig = {
  NODE_ENV: 'test',
  PORT: 4001,
  HOST: '127.0.0.1',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'error',
  INGEST_DRAINER_ENABLED: false,
  INGEST_STREAM_KEY: 'ingest:scans',
  INGEST_CONSUMER_GROUP: 'ingest-workers',
  INGEST_CONSUMER_NAME: 'test',
  INGEST_MAX_BUFFER: 2,
  INGEST_MAX_LAG_SECONDS: 30,
  INGEST_BATCH_MAX: 200,
  INGEST_BATCH_WINDOW_MS: 30,
  INGEST_SNAPSHOT_TTL_SECONDS: 120,
  INGEST_AUTH_CACHE_TTL_SECONDS: 900,
  CONTROL_PLANE_URL: 'http://backend:4000/api',
  INGEST_AUTH_REFRESH_CONCURRENCY: 5,
  INGEST_DB_POOL_SIZE: 8,
  INGEST_ROLE: 'all',
  INGEST_CLUSTER_ENABLED: true,
  INGEST_HTTP_WORKERS: 1,
  INGEST_DRAIN_PORT: 4002,
  INGEST_METRICS_PORT: 4003,
  INGEST_STREAM_MAXLEN: 50_000,
  INGEST_STREAM_TRIM_INTERVAL_SECONDS: 30,
  INGEST_DRAIN_HEALTH_STALE_SECONDS: 30,
  INGEST_MAX_DELIVERY_ATTEMPTS: 5,
  INGEST_DLQ_STREAM_KEY: 'ingest:dead-letter',
  INGEST_DLQ_MAX_AGE_SECONDS: 1800,
  INGEST_DEDUPE_TTL_SECONDS: 86_400,
  INGEST_DEDUPE_KEY_PREFIX: 'scan:dedupe:',
  INGEST_TRUST_PROXY: '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
}
