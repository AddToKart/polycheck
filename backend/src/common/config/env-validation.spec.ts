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
  PRIVACY_NOTICE_URL: 'https://polycheck.example.edu/privacy',
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

  it('keeps the assistant optional with safe defaults', () => {
    const result = validateEnv(base)
    expect(result.AI_BASE_URL).toBeUndefined()
    expect(result.AI_API_KEY).toBeUndefined()
    expect(result.AI_MODEL).toBeUndefined()
    expect(result.AI_TIMEOUT_MS).toBe(30_000)
    expect(result.AI_MAX_OUTPUT_TOKENS).toBe(1_024)
    expect(result.AI_MAX_MESSAGES_PER_DAY).toBe(100)
    expect(validateEnv(production).AI_TIMEOUT_MS).toBe(30_000)
  })

  it('accepts assistant endpoint settings and bounded limits', () => {
    const result = validateEnv({
      ...base,
      AI_BASE_URL: 'https://ai.example.edu/v1',
      AI_API_KEY: 'secret-value',
      AI_MODEL: 'gpt-test',
      AI_TIMEOUT_MS: '45000',
      AI_MAX_OUTPUT_TOKENS: '2048',
      AI_MAX_MESSAGES_PER_DAY: '250',
    })
    expect(result.AI_BASE_URL).toBe('https://ai.example.edu/v1')
    expect(result.AI_MODEL).toBe('gpt-test')
    expect(result.AI_TIMEOUT_MS).toBe(45_000)
    expect(result.AI_MAX_OUTPUT_TOKENS).toBe(2_048)
    expect(result.AI_MAX_MESSAGES_PER_DAY).toBe(250)
  })

  it('rejects malformed assistant endpoints and limit values', () => {
    expect(() => validateEnv({ ...base, AI_BASE_URL: 'not-a-url' })).toThrow('AI_BASE_URL')
    expect(() => validateEnv({ ...base, AI_TIMEOUT_MS: '999' })).toThrow('AI_TIMEOUT_MS')
    expect(() => validateEnv({ ...base, AI_MAX_OUTPUT_TOKENS: '32' })).toThrow('AI_MAX_OUTPUT_TOKENS')
    expect(() => validateEnv({ ...base, AI_MAX_MESSAGES_PER_DAY: '0' })).toThrow('AI_MAX_MESSAGES_PER_DAY')
  })
})
