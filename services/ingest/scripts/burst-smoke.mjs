/**
 * Bell-rush burst measurement for the ingestion gateway.
 *
 * Reproduces the shape that collapsed the control plane (2,000 scans inside a
 * few seconds) but across the real topology: one active session per section,
 * 60 students each, all fired concurrently — so 34 parallel advisory locks
 * instead of one.
 *
 * Usage (from services/ingest, gateway already running):
 *   node scripts/burst-smoke.mjs <fixture.json> [concurrency]
 *
 * Env: E2E_API (control plane, default http://127.0.0.1:4000/api),
 *      E2E_INGEST (gateway, default http://127.0.0.1:4001)
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { signQRToken } from '@polycheck/shared'

const API = process.env.E2E_API ?? 'http://127.0.0.1:4000/api'
const INGEST = process.env.E2E_INGEST ?? 'http://127.0.0.1:4001'
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'))

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
const endTime = `${pad((now.getHours() + 1) % 24)}:${pad(now.getMinutes())}`

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  return { status: response.status, json: await response.json().catch(() => null) }
}

const targets = []

for (const [index, section] of fixture.sections.entries()) {
  const created = await api('/sessions', {
    method: 'POST',
    token: section.teacherToken,
    body: {
      sectionId: section.sectionId,
      subjectName: `Burst ${fixture.K6_RUN_ID} S${index + 1}`,
      mode: 'in_person',
      date,
      startTime,
      endTime,
      qrValidityMinutes: 15,
      gracePeriodMinutes: 15,
      geofence: { latitude: fixture.LATITUDE, longitude: fixture.LONGITUDE, radiusMeters: 200 },
    },
  })
  const sessionId = created.json?.id
  if (!sessionId) {
    console.error(`session create failed for section ${index}: ${created.status}`)
    continue
  }
  const issuedAt = Date.now()
  const qrToken = signQRToken(
    {
      version: 1,
      sessionId,
      sectionId: section.sectionId,
      teacherId: section.teacherId,
      teacherName: section.teacherName ?? 'Burst Professor',
      issuedAt,
      validityMinutes: 15,
      gracePeriodMinutes: 15,
      mode: 'in_person',
      pinRequired: false,
    },
    section.signingKey,
  )
  const activated = await api(`/sessions/${encodeURIComponent(sessionId)}/activate`, {
    method: 'POST',
    token: section.teacherToken,
    body: { validityMinutes: 15, gracePeriodMinutes: 15, token: qrToken },
  })
  if (activated.status >= 400) {
    console.error(`activate failed for section ${index}: ${activated.status}`)
    continue
  }
  const students = fixture.students.filter((student) => student.sectionIndex === index)
  for (const student of students) {
    targets.push({ sessionId, qrToken, studentToken: student.token, issuedAt })
  }
}

console.log(`armed ${fixture.sections.length} sessions, ${targets.length} scans queued for a single burst`)

const results = []
const startedAt = Date.now()

await Promise.all(
  targets.map(async (target) => {
    const at = target.issuedAt + 2_000
    const requestStart = Date.now()
    try {
      const response = await fetch(`${INGEST}/attendance/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${target.studentToken}` },
        body: JSON.stringify({
          sessionId: target.sessionId,
          qrToken: target.qrToken,
          lat: fixture.LATITUDE + 0.00002,
          lon: fixture.LONGITUDE,
          deviceId: 'mobile-burst',
          scannedAt: new Date(at).toISOString(),
          clientAttemptId: `burst-${randomUUID()}`,
          accuracyMeters: 8,
          locationCapturedAt: new Date(at - 1_000).toISOString(),
          mocked: false,
          inputChannel: 'camera',
        }),
        signal: AbortSignal.timeout(30_000),
      })
      const body = await response.json().catch(() => null)
      results.push({ ok: response.ok && body?.success !== false, status: response.status, ms: Date.now() - requestStart, reason: body?.reason })
    } catch (error) {
      results.push({ ok: false, status: 0, ms: Date.now() - requestStart, reason: error?.name ?? 'error' })
    }
  }),
)

const elapsed = Date.now() - startedAt
const durations = results.map((r) => r.ms).sort((a, b) => a - b)
const pct = (p) => durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))] ?? 0
const accepted = results.filter((r) => r.ok).length
const byStatus = {}
for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
const byReason = {}
for (const r of results) if (!r.ok) byReason[r.reason ?? 'unknown'] = (byReason[r.reason ?? 'unknown'] ?? 0) + 1

console.log('')
console.log(`burst: ${targets.length} concurrent scans in ${elapsed} ms`)
console.log(`accepted: ${accepted}/${targets.length} (${((accepted / targets.length) * 100).toFixed(1)}%)`)
console.log(`latency : p50=${pct(50)}ms p95=${pct(95)}ms p99=${pct(99)}ms max=${durations[durations.length - 1] ?? 0}ms`)
console.log('statuses:', JSON.stringify(byStatus))
if (Object.keys(byReason).length > 0) console.log('rejections:', JSON.stringify(byReason))

if (accepted < targets.length * 0.95) {
  console.error('FAIL: fewer than 95% accepted')
  process.exitCode = 1
}
