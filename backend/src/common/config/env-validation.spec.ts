import { validateEnv } from './env-validation'

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/polycheck',
  JWT_SECRET: 'a'.repeat(32),
}

describe('validateEnv', () => {
  it('parses explicit false booleans without coercing them to true', () => {
    const result = validateEnv({ ...base, TRUST_PROXY: 'false', ENABLE_API_DOCS: 'false' })
    expect(result.TRUST_PROXY).toBe(false)
    expect(result.ENABLE_API_DOCS).toBe(false)
  })

  it('requires Redis in production', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://polycheck.example.edu' }),
    ).toThrow('REDIS_URL is required in production')
  })

  it('rejects localhost production CORS origins', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        REDIS_URL: 'redis://redis:6379',
        CORS_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrow('must not contain localhost')
  })
})
