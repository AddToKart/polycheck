import { describe, expect, it, vi } from 'vitest'
import { buildInternalServer } from '../src/internal-server'

describe('internal operational server', () => {
  it('answers ready with the shared checks shape', async () => {
    const app = buildInternalServer({
      ready: vi.fn().mockResolvedValue({ ready: true, checks: { redis: 'ok', drainer: 'ok' } }),
      metricsText: vi.fn().mockResolvedValue('ingest_ready 1\n'),
    })

    const response = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ status: 'ok', checks: { redis: 'ok', drainer: 'ok' } })
    await app.close()
  })

  it('answers 503 with the same body when the check reports degraded', async () => {
    const app = buildInternalServer({
      ready: vi.fn().mockResolvedValue({ ready: false, checks: { drainer: 'stalled' } }),
      metricsText: vi.fn().mockResolvedValue(''),
    })

    const response = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toMatchObject({ status: 'degraded', checks: { drainer: 'stalled' } })
    await app.close()
  })

  it('answers 503 instead of throwing when the check itself throws', async () => {
    const app = buildInternalServer({
      ready: vi.fn().mockRejectedValue(new Error('redis down')),
      metricsText: vi.fn().mockResolvedValue(''),
    })

    const response = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body).checks.internal).toBe('unavailable')
    await app.close()
  })

  it('serves the metrics text', async () => {
    const app = buildInternalServer({
      ready: vi.fn().mockResolvedValue({ ready: true, checks: {} }),
      metricsText: vi.fn().mockResolvedValue('ingest_http_requests_total 7\n'),
    })

    const response = await app.inject({ method: 'GET', url: '/metrics' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('ingest_http_requests_total 7')
    await app.close()
  })
})
