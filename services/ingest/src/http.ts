/**
 * HTTP surface for the ingestion gateway.
 *
 * Only the four hot paths are served here. Every response shape mirrors the
 * NestJS control plane so no client can tell which process answered.
 */
import { createHash } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import type Redis from 'ioredis'
import { z } from 'zod'
import type { IngestConfig } from './config'
import { validateScan, type ScanEvidenceInput, type SessionSnapshot } from './core/scan'
import type { BufferedScan } from './queue'
import { observeHttpDuration, renderMetrics, type IngestMetrics } from './metrics'

/** Keep-alive must outlive every proxy's upstream idle window (nginx 65s). */
const KEEP_ALIVE_TIMEOUT_MS = 72_000

export const scanBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  qrToken: z.string().min(80).max(4096),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  deviceId: z.string().max(128).optional(),
  scannedAt: z.string().datetime().optional(),
  clientAttemptId: z.string().max(128).optional(),
  accuracyMeters: z.number().min(0).max(10_000).optional(),
  locationCapturedAt: z.string().datetime().optional(),
  mocked: z.boolean().optional(),
  inputChannel: z.enum(['camera', 'image', 'manual']).optional(),
  pin: z.string().regex(/^\d{2,4}$/).optional(),
  deviceSecurity: z
    .object({
      rootDetected: z.boolean().optional(),
      hookDetected: z.boolean().optional(),
      emulatorDetected: z.boolean().optional(),
    })
    .optional(),
})

export interface AuthedUser {
  id: string
  role: string
  privacyConsent: boolean
}

/**
 * `null` = positively unauthorised (401). `unavailable` = the auth upstream could
 * not answer — a retryable condition (503), never a session-terminating 401.
 */
export type AuthResolution = { user: AuthedUser } | { unavailable: true } | null

export interface HotPathProbe {
  /** Unacknowledged stream entries — the true backlog. */
  depth: number
  /** Age of the oldest unacknowledged entry, in seconds. */
  lag: number
  /** Missing means the snapshot is unpublished/unparsable: retryable 503. */
  snapshot: { snapshot: SessionSnapshot; teacherPublicKey: string } | undefined
}

export interface IngestDeps {
  config: IngestConfig
  redis: Pick<Redis, 'ping'>
  appendScan: (scan: BufferedScan) => Promise<string>
  /** Pending (unacked) entries — what backpressure and readiness gate on. */
  bufferDepth: () => Promise<number>
  bufferLagSeconds: () => Promise<number>
  /** Retained entries (`XLEN`) — observability only, never backpressure. */
  streamLength: () => Promise<number>
  /** One pipelined round-trip: pending summary + session snapshot. */
  probeHotPath: (sessionId: string) => Promise<HotPathProbe>
  resolveUser: (authorization: string | undefined) => Promise<AuthResolution>
  consumePinAttempt: (key: string, limit: number, windowMs: number) => Promise<boolean>
  /**
   * Atomically claims `(sessionId, userId, checkpoint)` for the dedupe TTL. Returns false
   * when another request already holds the claim — the second scan is a
   * duplicate and MUST NOT be buffered.
   */
  reserveScan: (sessionId: string, userId: string, ttlSeconds: number, checkpoint?: string) => Promise<boolean>
  /** Releases a claim when buffering failed, so a retry is not answered "duplicate". */
  releaseScan?: (sessionId: string, userId: string, checkpoint?: string) => Promise<void>
  /** Forwards online-mode scans directly to NestJS (/attendance/scan). */
  forwardOnlineScan?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  /** Dead-letter stream length — observability only, never backpressure. */
  dlqDepth: () => Promise<number>
  metrics: IngestMetrics
}

const bearer = (request: FastifyRequest): string | undefined => {
  const header = request.headers.authorization
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined
}

const tooMany = (reply: FastifyReply, retryAfterSeconds = 5) =>
  reply
    .code(503)
    .header('retry-after', String(retryAfterSeconds))
    .send({ statusCode: 503, error: 'ServiceUnavailable', message: 'Ingestion buffer is full', retryAfterSeconds })

async function forwardOnlineScan(deps: IngestDeps, request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  if (deps.forwardOnlineScan) {
    return deps.forwardOnlineScan(request, reply)
  }
  const url = `${deps.config.CONTROL_PLANE_URL}/attendance/scan`
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (typeof request.headers.authorization === 'string') {
    headers.authorization = request.headers.authorization
  }
  if (typeof request.headers.cookie === 'string') {
    headers.cookie = request.headers.cookie
  }
  const userAgent = request.headers['user-agent']
  if (typeof userAgent === 'string') {
    headers['user-agent'] = userAgent
  }

  // Forward client IP so control-plane audit logs observe the student device rather than gateway internal IP.
  // Fastify's trustProxy populates request.ips with the verified chain of trusted proxy IPs ending in the client IP.
  // Reversing this array yields standard X-Forwarded-For order: client, proxy1, proxy2...
  // Any untrusted or spoofed client-supplied headers beyond trusted proxies are stripped automatically.
  const forwardedFor =
    request.ips && request.ips.length > 0 ? [...request.ips].reverse().join(', ') : request.ip
  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor
  }

  if (typeof request.headers['x-forwarded-proto'] === 'string') {
    headers['x-forwarded-proto'] = request.headers['x-forwarded-proto']
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(10_000),
    })
    const text = await response.text()
    const contentType = response.headers.get('content-type') ?? 'application/json'
    return reply.code(response.status).type(contentType).send(text)
  } catch {
    return reply
      .code(503)
      .header('retry-after', '2')
      .send({
        statusCode: 503,
        error: 'ServiceUnavailable',
        message: 'Control plane temporarily unavailable',
        retryAfterSeconds: 2,
      })
  }
}

export function buildServer(deps: IngestDeps): FastifyInstance {
  const rawTrust = deps.config.INGEST_TRUST_PROXY ?? '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
  const asNumber = Number(rawTrust)
  const trustProxy =
    Number.isInteger(asNumber) && asNumber > 0
      ? (addr: string, hop: number) => hop < asNumber
      : rawTrust.split(',').map((s) => s.trim())

  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
    trustProxy,
  })
  // Fastify does not accept `headersTimeout` in its option schema, but Node
  // requires it to stay above keepAliveTimeout: an idle keep-alive socket whose
  // next request arrives late must not be closed mid-headers.
  app.server.headersTimeout = KEEP_ALIVE_TIMEOUT_MS + 1_000

  app.addHook('onResponse', async (_request, reply) => {
    observeHttpDuration(deps.metrics, reply.elapsedTime)
  })

  const healthHandler = async () => ({ status: 'ok', timestamp: new Date().toISOString() })
  app.get('/health', healthHandler)
  app.get('/api/health', healthHandler)

  const clockHandler = async () => ({ timestamp: new Date().toISOString() })
  app.get('/health/clock', clockHandler)
  app.get('/api/health/clock', clockHandler)

  const readyHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, string> = {}
    let ready = true
    try {
      await deps.redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'unavailable'
      ready = false
    }
    try {
      const depth = await deps.bufferDepth()
      const lag = await deps.bufferLagSeconds()
      checks.buffer = depth > deps.config.INGEST_MAX_BUFFER ? 'saturated' : 'ok'
      checks.lag = lag > deps.config.INGEST_MAX_LAG_SECONDS ? 'behind' : 'ok'
      if (checks.buffer !== 'ok' || checks.lag !== 'ok') ready = false
    } catch {
      checks.buffer = 'unavailable'
      ready = false
    }
    const body = { status: ready ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks }
    return ready ? body : reply.code(503).send(body)
  }
  app.get('/health/ready', readyHandler)
  app.get('/api/health/ready', readyHandler)

  app.get('/metrics', async (_request, reply) => {
    const [depth, length, lag, dlqDepth] = await Promise.all([
      deps.bufferDepth(),
      deps.streamLength(),
      deps.bufferLagSeconds(),
      deps.dlqDepth(),
    ])
    const ready = depth <= deps.config.INGEST_MAX_BUFFER && lag <= deps.config.INGEST_MAX_LAG_SECONDS
    return reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(renderMetrics(deps.metrics, { bufferDepth: depth, streamLength: length, lagSeconds: lag, dlqDepth, ready }))
  })

  /**
   * Accepts one live scan. The decision is made in-memory against the cached
   * session snapshot; the write is buffered, never synchronous.
   */
  const submit = async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await deps.resolveUser(bearer(request))
    if (!auth) return reply.code(401).send({ statusCode: 401, message: 'Unauthorized' })
    if ('unavailable' in auth) {
      // The control plane could not confirm the session. Answering 401 here would
      // make every client treat a transient upstream blip as a logout.
      return reply
        .code(503)
        .header('retry-after', '2')
        .send({ statusCode: 503, error: 'ServiceUnavailable', message: 'Authentication temporarily unavailable', retryAfterSeconds: 2 })
    }
    const user = auth.user
    if (user.role !== 'student') return reply.code(403).send({ statusCode: 403, message: 'Insufficient role permissions' })
    if (!user.privacyConsent) {
      return reply.code(403).send({ statusCode: 403, message: 'Privacy consent required', code: 'privacy_consent_required' })
    }

    const parsed = scanBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'BadRequestException',
        message: parsed.error.issues.map((issue) => issue.message),
      })
    }
    const body = parsed.data

    // Pending depth, lag and the session snapshot in one pipelined round-trip.
    const probe = await deps.probeHotPath(body.sessionId)
    if (!probe.snapshot) {
      // Cannot validate without the snapshot: retryable, never a silent accept.
      return tooMany(reply, 2)
    }
    const { snapshot, teacherPublicKey } = probe.snapshot

    if (snapshot.mode === 'online') {
      // Online windows are short and low-volume: the hot path isn't needed.
      // Bypass the buffer saturation/lag gate and forward directly to NestJS
      // which owns the dual-checkpoint contract.
      return forwardOnlineScan(deps, request, reply)
    }

    if (probe.depth > deps.config.INGEST_MAX_BUFFER || probe.lag > deps.config.INGEST_MAX_LAG_SECONDS) {
      return tooMany(reply)
    }

    const evidence: ScanEvidenceInput = {
      qrToken: body.qrToken,
      clientAttemptId: body.clientAttemptId,
      accuracyMeters: body.accuracyMeters,
      locationCapturedAt: body.locationCapturedAt,
      mocked: body.mocked,
      inputChannel: body.inputChannel,
      pin: body.pin,
      deviceSecurity: body.deviceSecurity,
      scannedAt: body.scannedAt,
      latitude: body.lat,
      longitude: body.lon,
      deviceId: body.deviceId,
    }

    const validation = await validateScan({
      snapshot,
      teacherPublicKey,
      userId: user.id,
      evidence,
      offline: false,
      receivedAt: new Date(),
      consumePinAttempt: deps.consumePinAttempt,
    })

    const tokenHash = createHash('sha256').update(body.qrToken).digest('hex')

    if (validation.success) {
      // Claim `(session, student)` before buffering. The writer is idempotent,
      // but only after both requests already answered 201 — the second client
      // was told "checked in" and its scan was silently discarded. An atomic
      // NX claim is the only place the second request can be told the truth.
      let reserved: boolean
      try {
        reserved =
          validation.checkpoint !== undefined
            ? await deps.reserveScan(
                snapshot.id,
                user.id,
                deps.config.INGEST_DEDUPE_TTL_SECONDS,
                validation.checkpoint,
              )
            : await deps.reserveScan(
                snapshot.id,
                user.id,
                deps.config.INGEST_DEDUPE_TTL_SECONDS,
              )
      } catch {
        // Without the claim we cannot append (the second scan would be lost)
        // and must not count the request as accepted. Retryable, so 503.
        return reply
          .code(503)
          .header('retry-after', '2')
          .send({
            statusCode: 503,
            error: 'ServiceUnavailable',
            message: 'Ingestion temporarily unavailable',
            retryAfterSeconds: 2,
          })
      }
      if (!reserved) {
        // Byte-for-byte the control-plane duplicate envelope: the client shows
        // "already checked in" rather than an error, and nothing is buffered.
        deps.metrics.scansDuplicate += 1
        return reply.code(200).send({
          success: false,
          reason: 'duplicate',
          message: 'Attendance was already submitted for this session',
        })
      }

      deps.metrics.scansAccepted += 1
      try {
        await deps.appendScan({
          userId: user.id,
          sessionId: snapshot.id,
          sectionId: snapshot.sectionId,
          status: validation.status === 'late' ? 'late' : validation.status === 'disputed' ? 'disputed' : 'present',
          reason: validation.reason,
          message: validation.message,
          scannedAt: validation.scannedAt.toISOString(),
          receivedAt: validation.receivedAt.toISOString(),
          mode: validation.mode,
          checkpoint: validation.checkpoint,
          distanceMeters: validation.distanceMeters,
          geofenceRadiusMeters: validation.geofenceRadiusMeters,
          riskSignals: validation.riskSignals,
          pinVerified: validation.pinVerified,
          tokenHash,
          latitude: body.lat,
          longitude: body.lon,
          accuracyMeters: body.accuracyMeters,
          locationCapturedAt: body.locationCapturedAt,
          deviceId: body.deviceId,
          clientAttemptId: body.clientAttemptId,
          inputChannel: body.inputChannel,
          mocked: body.mocked,
          offline: false,
          qrToken: body.qrToken,
        })
      } catch (error) {
        // A failed XADD must not strand the claim for the whole TTL: the retry
        // carries the same envelope and would be answered "duplicate" while
        // nothing was ever buffered. Release is best-effort — the original
        // failure is what the caller must see.
        if (validation.checkpoint !== undefined) {
          await deps.releaseScan?.(snapshot.id, user.id, validation.checkpoint).catch(() => undefined)
        } else {
          await deps.releaseScan?.(snapshot.id, user.id).catch(() => undefined)
        }
        throw error
      }
    }

    if (!validation.success) deps.metrics.scansRejected += 1

    // Same envelope the control plane returns for both outcomes.
    return reply.code(validation.success ? 201 : 200).send({
      success: validation.success,
      status: validation.status,
      reason: validation.reason,
      message: validation.message,
      distanceMeters: validation.distanceMeters,
      geofenceRadiusMeters: validation.geofenceRadiusMeters,
      syncState: validation.success ? 'buffered' : 'rejected',
    })
  }

  app.post('/attendance/scan', submit)
  app.post('/api/attendance/scan', submit)
  app.post('/attendance/check', submit)
  app.post('/api/attendance/check', submit)

  /**
   * `/sync/attendance/*` is deliberately NOT served here.
   *
   * The control plane's receipt contract is `{queued, receiptId}` (sha256 job
   * id) with `{state, results}` where each result is the full written
   * AttendanceRecord. Reproducing that requires returning rows from the
   * asynchronous drainer, which is a different design than "ack, then write".
   * Rather than ship a receipt that silently corrupts every client's offline
   * replay, the gateway answers 404 here: a misrouted sync request fails loudly
   * and the proxy sends it to NestJS, which owns the contract.
   */
  app.post('/sync/attendance/batches', async (_request, reply) =>
    reply.code(404).send({
      statusCode: 404,
      message: 'Sync batches are served by the control plane, not the ingestion gateway',
    }),
  )
  app.post('/api/sync/attendance/batches', async (_request, reply) =>
    reply.code(404).send({
      statusCode: 404,
      message: 'Sync batches are served by the control plane, not the ingestion gateway',
    }),
  )

  return app
}
