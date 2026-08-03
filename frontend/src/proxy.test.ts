import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentSecurityPolicy } from './proxy'

describe('contentSecurityPolicy', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('allows the same default API origin used by the browser client', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const policy = contentSecurityPolicy('test-nonce', 'http://localhost:4000/api')

    expect(policy).toContain('connect-src')
    expect(policy).toContain('http://localhost:4000')
    expect(policy).toContain('ws://localhost:4000')
  })
})
