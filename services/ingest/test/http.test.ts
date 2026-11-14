import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { buildServer, type IngestDeps } from '../src/http'
import { createMetrics } from '../src/metrics'
import { testConfig } from './config-fixture'

const config = testConfig

const token = 'a'.repeat(90)

const keys = createSigningKeyPair(new Uint8Array(32).fill(21))

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

/** A token the route can actually validate: issued now, inside the window. */
const signToken = (overrides: Record<string, unknown> = {}): string =>
  signQRToken(
    {
      version: 1,
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      teacherName: 'Prof',
      issuedAt: Date.now(),
      validityMinutes: 15,
      gracePeriodMinutes: 10,
      mode: 'in_person',
      pinRequired: false,
      ...overrides,
    } as never,
    keys.secretKey,
  )

/** Envelope that passes every gate, so `validation.success` is reachable. */
const acceptedScan = () => ({
  sessionId: 'sess-1',
  qrToken: signToken(),
  lat: 14.86975,
  lon: 120.99915,
  accuracyMeters: 12,
  locationCapturedAt: new Date().toISOString(),
  deviceId: 'mobile-abc',
  inputChannel: 'camera' as const,
  clientAttemptId: 'attempt-1',
  mocked: false,
})

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
    reserveScan: vi.fn().mockResolvedValue(true),
    releaseScan: vi.fn().mockResolvedValue(undefined),
    dlqDepth: vi.fn().mockResolvedValue(0),
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
    // Reservations gate buffering only: a rejected scan never touches the
    // dedupe key, otherwise a bad token would lock the student out of retrying.
    expect(deps.reserveScan).not.toHaveBeenCalled()
    await app.close()
  })

  it('claims the dedupe key once and buffers the first accepted scan', async () => {
    const { deps, appended } = makeDeps({
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 0,
        lag: 0,
        snapshot: { snapshot, teacherPublicKey: keys.publicKey },
      }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: acceptedScan(),
    })
    expect(response.statusCode).toBe(201)
    expect(JSON.parse(response.body).success).toBe(true)
    expect(appended).toHaveLength(1)
    expect(deps.metrics.scansAccepted).toBe(1)
    expect(deps.reserveScan).toHaveBeenCalledTimes(1)
    expect(deps.reserveScan).toHaveBeenCalledWith('sess-1', 'student-1', config.INGEST_DEDUPE_TTL_SECONDS)
    await app.close()
  })

  it('includes checkpoint in the dedupe key when claiming reservation', async () => {
    const token = signToken({
      mode: 'online',
      checkpoint: 'start',
      pinRequired: false,
      validitySeconds: 300,
    })
    const onlineSnapshot = {
      ...snapshot,
      mode: 'online' as const,
      checkpoint: 'start' as const,
      checkpointArmedAt: new Date(Date.now() - 30_000).toISOString(),
      checkpointWindowMinutes: 15,
      startQrToken: token,
    }
    const { deps } = makeDeps({
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 0,
        lag: 0,
        snapshot: { snapshot: onlineSnapshot, teacherPublicKey: keys.publicKey },
      }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: {
        ...acceptedScan(),
        qrToken: token,
      },
    })
    expect(response.statusCode).toBe(201)
    expect(deps.reserveScan).toHaveBeenCalledWith('sess-1', 'student-1', config.INGEST_DEDUPE_TTL_SECONDS, 'start')
    await app.close()
  })

  it('answers the duplicate envelope for a second scan and buffers nothing', async () => {
    const reserveScan = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { deps, appended } = makeDeps({
      reserveScan,
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 0,
        lag: 0,
        snapshot: { snapshot, teacherPublicKey: keys.publicKey },
      }),
    })
    const app = buildServer(deps)
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/attendance/scan',
        headers: { authorization: 'Bearer x' },
        payload: acceptedScan(),
      })

    expect((await send()).statusCode).toBe(201)
    const second = await send()

    expect(second.statusCode).toBe(200)
    expect(JSON.parse(second.body)).toEqual({
      success: false,
      reason: 'duplicate',
      message: 'Attendance was already submitted for this session',
    })
    expect(appended).toHaveLength(1)
    expect(deps.metrics.scansDuplicate).toBe(1)
    // The duplicate is not an acceptance: only the first scan counted.
    expect(deps.metrics.scansAccepted).toBe(1)
    await app.close()
  })

  it('answers a retryable 503 without buffering when the dedupe key cannot be claimed', async () => {
    const { deps, appended } = makeDeps({
      reserveScan: vi.fn().mockRejectedValue(new Error('redis down')),
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 0,
        lag: 0,
        snapshot: { snapshot, teacherPublicKey: keys.publicKey },
      }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: acceptedScan(),
    })
    expect(response.statusCode).toBe(503)
    expect(response.headers['retry-after']).toBe('2')
    expect(JSON.parse(response.body)).toMatchObject({ message: 'Ingestion temporarily unavailable' })
    expect(appended).toHaveLength(0)
    // Not accepted and not rejected — the request has to be retried.
    expect(deps.metrics.scansAccepted).toBe(0)
    await app.close()
  })

  it('releases the reservation when buffering fails so the retry is not a false duplicate', async () => {
    const { deps, appended } = makeDeps({
      appendScan: vi.fn().mockRejectedValue(new Error('XADD failed')),
      probeHotPath: vi.fn().mockResolvedValue({
        depth: 0,
        lag: 0,
        snapshot: { snapshot, teacherPublicKey: keys.publicKey },
      }),
    })
    const app = buildServer(deps)
    const response = await app.inject({
      method: 'POST',
      url: '/attendance/scan',
      headers: { authorization: 'Bearer x' },
      payload: acceptedScan(),
    })
    expect(response.statusCode).toBe(500)
    expect(appended).toHaveLength(0)
    expect(deps.releaseScan).toHaveBeenCalledTimes(1)
    expect(deps.releaseScan).toHaveBeenCalledWith('sess-1', 'student-1')
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
    const { deps } = makeDeps({ dlqDepth: vi.fn().mockResolvedValue(3) })
    const app = buildServer(deps)
    const response = await app.inject({ method: 'GET', url: '/metrics' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('ingest_scans_accepted_total')
    expect(response.body).toContain('ingest_buffer_depth')
    expect(response.body).toContain('ingest_stream_length')
    expect(response.body).toContain('ingest_dlq_depth 3')
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
