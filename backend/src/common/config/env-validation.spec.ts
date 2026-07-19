import { validateEnv } from './env-validation'

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/polycheck',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
}

const production = {
  ...base,
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@pgbouncer:5432/polycheck?pgbouncer=true&connection_limit=10&pool_timeout=10',
  REDIS_URL: 'redis://redis:6379',
  BETTER_AUTH_URL: 'https://polycheck.example.edu',
  CORS_ORIGINS: 'https://polycheck.example.edu',
  FRONTEND_URL: 'https://polycheck.example.edu',
  TRUST_PROXY: 'true',
  TRUST_PROXY_HOPS: '2',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'polycheck-proofs',
  METRICS_TOKEN: 'm'.repeat(32),
}

describe('validateEnv', () => {
  it('parses explicit false booleans without coercing them to true', () => {
    const result = validateEnv({ ...base, TRUST_PROXY: 'false', ENABLE_API_DOCS: 'false' })
    expect(result.TRUST_PROXY).toBe(false)
    expect(result.ENABLE_API_DOCS).toBe(false)
  })

  it('uses the configured trusted proxy hop count', () => {
    expect(validateEnv(production).TRUST_PROXY_HOPS).toBe(2)
  })

  it('requires Redis in production', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://polycheck.example.edu' }),
    ).toThrow('REDIS_URL is required in production')
  })

  it('rejects insecure production origins', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        BETTER_AUTH_URL: 'https://polycheck.example.edu',
        FRONTEND_URL: 'https://polycheck.example.edu',
        TRUST_PROXY: 'true',
        CORS_ORIGINS: 'http://localhost:3000',
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'polycheck-proofs',
        METRICS_TOKEN: 'm'.repeat(32),
      }),
    ).toThrow('must use HTTPS')
  })

  it('requires pooled production database settings', () => {
    expect(() => validateEnv({ ...production, DATABASE_URL: base.DATABASE_URL })).toThrow(
      'must use PgBouncer transaction-pool compatibility',
    )
  })

  it('requires the production proxy topology', () => {
    expect(() => validateEnv({ ...production, TRUST_PROXY: 'false' })).toThrow('TRUST_PROXY must be enabled')
  })

  it('requires a metrics token of at least 32 characters in production', () => {
    expect(() => validateEnv({ ...production, METRICS_TOKEN: undefined })).toThrow('METRICS_TOKEN is required')
    expect(() => validateEnv({ ...production, METRICS_TOKEN: 'short' })).toThrow('at least 32 characters')
    expect(validateEnv(production).METRICS_TOKEN).toHaveLength(32)
  })
})
