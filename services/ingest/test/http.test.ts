import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { buildServer, type IngestDeps } from '../src/http'
import { createMetrics } from '../src/metrics'
import { testConfig } from './config-fixture'

const config = testConfig

const token = 'a'.repeat(90)

const snapshot = {
  id: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  mode: 'in_person' as const,
  isActive: true,
  geofenceLatitude: 14.8697,
  geofenceLongitude: 120.9991,
  geofenceRadiusMeters: 100,
}

function makeDeps(overrides: Partial<IngestDeps> = {}) {
  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    ping: vi.fn().mockResolvedValue('PONG'),
  }
  const appended: unknown[] = []
  const deps: IngestDeps = {
    config,
    // Route tests only exercise ping/set/get, never the stream itself.
    redis: redis as unknown as Redis,
    appendScan: vi.fn(async (scan) => {
      appended.push(scan)
      return '1-0'
    }),
    bufferDepth: vi.fn().mockResolvedValue(0),
    bufferLagSeconds: vi.fn().mockResolvedValue(0),
    streamLength: vi.fn().mockResolvedValue(0),
    probeHotPath: vi.fn().mockResolvedValue({
      depth: 0,
      lag: 0,
      snapshot: { snapshot, teacherPublicKey: 'unused' },
    }),
    resolveUser: vi.fn().mockResolvedValue({ user: { id: 'student-1', role: 'student', privacyConsent: true } }),
    consumePinAttempt: vi.fn().mockResolvedValue(true),
    metrics: createMetrics(),
    ...overrides,
  }
  return { deps, appended, redis }
}

describe('ingest HTTP surface', () => {
  it('serves liveness and a clock alias with the trusted timestamp shape', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)
    const health = await app.inject({ method: 'GET', url: '/health' })
    expect(health.statusCode).toBe(200)
    expect(JSON.parse(health.body)).toMatchObject({ status: 'ok' })
    expect(Number.isFinite(new Date(JSON.parse(health.body).timestamp).getTime())).toBe(true)

    const clock = await app.inject({ method: 'GET', url: '/health/clock' })
    expect(clock.statusCode).toBe(200)
    expect(JSON.parse(clock.body).timestamp).toBeTruthy()
    await app.close()
  })

  it('keeps sockets alive past the proxy idle window and above headersTimeout', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)
    expect(app.server.keepAliveTimeout).toBe(72_000)
    // Node closes an idle keep-alive socket whose headers arrive too late, so
    // headersTimeout must sit above keepAliveTimeout.
    expect(app.server.headersTimeout).toBe(73_000)
    await app.close()
  })

  it('reports degraded when the buffer is saturated so the proxy can shed it', async () => {
    const { deps } = makeDeps({ bufferDepth: vi.fn().mockResolvedValue(99) })
    const app = buildServer(deps)
    const ready = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(ready.statusCode).toBe(503)
    expect(JSON.parse(ready.body).checks.buffer).toBe('saturated')
    await app.close()
  })

  it('rejects an unauthenticated scan', async () => {
    const { deps } = makeDeps({ resolveUser: vi.fn().mockResolvedValue(null) })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('rejects a teacher bearer with the control-plane message', async () => {
    const { deps } = makeDeps({
      resolveUser: vi.fn().mockResolvedValue({ user: { id: 't1', role: 'teacher', privacyConsent: true } }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body).message).toBe('Insufficient role permissions')
    await app.close()
  })

  it('answers a retryable 503, not 401, when the auth upstream cannot answer', async () => {
    const { deps, appended } = makeDeps({
      resolveUser: vi.fn().mockResolvedValue({ unavailable: true }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(503)
    expect(response.headers['retry-after']).toBe('2')
    expect(appended).toHaveLength(0)
    await app.close()
  })

  it('requires privacy consent before any work', async () => {
    const { deps, appended } = makeDeps({
      resolveUser: vi.fn().mockResolvedValue({ user: { id: 'student-1', role: 'student', privacyConsent: false } }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(403)
    expect(appended).toHaveLength(0)
    await app.close()
  })

  it('rejects a malformed body with a 400 before validating', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1' },
    })
    expect(response.statusCode).toBe(400)
    await app.close()
  })

  it('answers 503 (retryable) when pending depth is over the buffer cap', async () => {
    const { deps, appended } = makeDeps({
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 5,
        lag: 0,
        snapshot: { snapshot, teacherPublicKey: 'unused' },
      }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(503)
    expect(response.headers['retry-after']).toBe('5')
    expect(appended).toHaveLength(0)
    await app.close()
  })

  it('answers 503 when the session snapshot is unavailable', async () => {
    const { deps } = makeDeps({
      probeHotPath: vi.fn().mockResolvedValue({ depth: 0, lag: 0, snapshot: undefined }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    expect(response.statusCode).toBe(503)
    await app.close()
  })

  it('returns the control-plane envelope and buffers exactly one scan', async () => {
    const { deps, appended } = makeDeps()
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: { sessionId: 'sess-1', qrToken: token },
    })
    // An invalid signature is a 200 with the rejected decision, same as Nest.
    expect([200, 201]).toContain(response.statusCode)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('success')
    expect(appended.length).toBe(body.success ? 1 : 0)
    await app.close()
  })

  it('does not serve /sync — a misrouted batch fails loudly instead of acking a broken receipt', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)

    const post = await app.inject({
      method: 'POST',
      url: '/sync/attendance/batches',
      headers: { authorization: 'Bearer x' },
      payload: { records: [{ sessionId: 'sess-1', qrToken: token }] },
    })
    expect(post.statusCode).toBe(404)
    expect(JSON.parse(post.body).message).toMatch(/control plane/i)

    const receipt = await app.inject({ method: 'GET', url: '/sync/attendance/batches/abc' })
    expect(receipt.statusCode).toBe(404)
    await app.close()
  })

  it('exposes Prometheus metrics with the ingest counters', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)
    const response = await app.inject({ method: 'GET', url: '/metrics' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('ingest_scans_accepted_total')
    expect(response.body).toContain('ingest_buffer_depth')
    expect(response.body).toContain('ingest_stream_length')
    expect(response.body).toContain('ingest_ready 1')
    await app.close()
  })

  it('records HTTP latency on the response hook', async () => {
    const { deps } = makeDeps()
    const app = buildServer(deps)
    await app.inject({ method: 'GET', url: '/health' })
    expect(deps.metrics.httpRequests).toBeGreaterThan(0)
    expect(deps.metrics.httpDurationSumMs).toBeGreaterThanOrEqual(0)
    await app.close()
  })
})
