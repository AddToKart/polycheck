/**
 * End-to-end proof for the ingestion gateway.
 *
 * Exercises the real path against a running local stack:
 *   Nest creates a session -> Nest activates it (which writes the
 *   `polycheck:active-session:<id>` snapshot including the teacher public key)
 *   -> the Flutter/RN-style client signs a token -> the SCAN goes to
 *   polycheck-ingest (not the backend) -> the drainer writes Postgres with the
 *   hash chain -> the ledger verifier confirms the chain.
 *
 * Usage (from services/ingest):
 *   node scripts/e2e-smoke.mjs <fixture.json>
 *
 * Env: E2E_API (default http://127.0.0.1:4000/api),
 *      E2E_INGEST (default http://127.0.0.1:4001),
 *      DATABASE_URL (for the direct row assertions).
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { signQRToken } from '@polycheck/shared'

const API = process.env.E2E_API ?? 'http://127.0.0.1:4000/api'
const INGEST = process.env.E2E_INGEST ?? 'http://127.0.0.1:4001'
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const fixturePath = process.argv[2]
if (!fixturePath) throw new Error('usage: node scripts/e2e-smoke.mjs <fixture.json>')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function call(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: response.status, json }
}

const pad = (value) => String(value).padStart(2, '0')
const now = new Date()
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
const endTime = `${pad((now.getHours() + 1) % 24)}:${pad(now.getMinutes())}`

const section = fixture.sections[0]
const student = fixture.students.find((candidate) => candidate.sectionIndex === 0)
if (!section || !student) throw new Error('fixture needs sections[0] and a student in section 0')

const latitude = fixture.LATITUDE
const longitude = fixture.LONGITUDE

async function main() {
  // 1. Both processes answer.
  const ingestHealth = await call(INGEST, '/health')
  check('ingest /health is ok', ingestHealth.status === 200 && ingestHealth.json?.status === 'ok')
  const ingestReady = await call(INGEST, '/health/ready')
  check('ingest /health/ready is ok', ingestReady.status === 200, JSON.stringify(ingestReady.json?.checks ?? {}))

  // 2. Control plane is reachable with the fixture teacher.
  const me = await call(API, '/auth/me', { token: section.teacherToken })
  check('control plane accepts the fixture teacher token', me.status === 200)

  // 3. Create a fresh session and activate it (this writes the Redis snapshot).
  const created = await call(API, '/sessions', {
    method: 'POST',
    token: section.teacherToken,
    body: {
      sectionId: section.sectionId,
      subjectName: section.subjectName ?? `Ingest E2E ${fixture.K6_RUN_ID}`,
      mode: 'in_person',
      date,
      startTime,
      endTime,
      qrValidityMinutes: 15,
      gracePeriodMinutes: 10,
      geofence: { latitude, longitude, radiusMeters: 100 },
    },
  })
  const sessionId = created.json?.id
  check('session created', created.status === 201 || created.status === 200, `status=${created.status} id=${sessionId ?? 'none'}`)
  if (!sessionId) return finish()

  const issuedAt = Date.now()
  const qrToken = signQRToken(
    {
      version: 1,
      sessionId,
      sectionId: section.sectionId,
      teacherId: section.teacherId,
      teacherName: section.teacherName ?? 'E2E Professor',
      issuedAt,
      validityMinutes: 15,
      gracePeriodMinutes: 10,
      mode: 'in_person',
      pinRequired: false,
    },
    section.signingKey,
  )

  const activated = await call(API, `/sessions/${encodeURIComponent(sessionId)}/activate`, {
    method: 'POST',
    token: section.teacherToken,
    body: { validityMinutes: 15, gracePeriodMinutes: 10, token: qrToken },
  })
  check('session activated (snapshot published)', activated.status === 201 || activated.status === 200, `status=${activated.status}`)

  // 4. Scan through the GATEWAY, exactly as a device would.
  const scanPayload = {
    sessionId,
    qrToken,
    lat: latitude + 0.00002,
    lon: longitude,
    deviceId: 'mobile-e2e',
    scannedAt: new Date(issuedAt + 2_000).toISOString(),
    clientAttemptId: `e2e-${randomUUID()}`,
    accuracyMeters: 8,
    locationCapturedAt: new Date(issuedAt + 1_000).toISOString(),
    mocked: false,
    inputChannel: 'camera',
  }
  const scan = await call(INGEST, '/attendance/scan', {
    method: 'POST',
    token: student.token,
    body: scanPayload,
  })
  check(
    'gateway accepted the scan',
    scan.status === 201 && scan.json?.success === true,
    `status=${scan.status} decision=${scan.json?.status} reason=${scan.json?.reason ?? '-'}`,
  )
  check('gateway answered `buffered`', scan.json?.syncState === 'buffered', String(scan.json?.syncState))

  // 5. Duplicate scan through the same path (replay must not double-insert).
  const duplicate = await call(INGEST, '/attendance/scan', {
    method: 'POST',
    token: student.token,
    body: { ...scanPayload, clientAttemptId: `e2e-dup-${randomUUID()}` },
  })
  check(
    'duplicate replay is acknowledged, not a 5xx',
    duplicate.status < 500,
    `status=${duplicate.status} decision=${duplicate.json?.status}`,
  )

  // 6. Let the drainer commit, then assert the row + hash chain in Postgres.
  const db = new Client({ connectionString: databaseUrl })
  await db.connect()
  let row = null
  // Activation pre-seeds a `pending` roster row, so "a row exists" is not the
  // signal — wait until the drainer has claimed and chained it.
  for (let attempt = 0; attempt < 40; attempt++) {
    const { rows } = await db.query(
      `SELECT status::text AS status, "prevHash", "recordHash", "salt", "studentName"
         FROM "AttendanceRecord" WHERE "sessionId" = $1 AND "studentId" = $2`,
      [sessionId, studentIdOf(student)],
    )
    row = rows[0] ?? null
    if (row && row.status !== 'pending' && row.recordHash) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  check('drainer wrote the attendance row', Boolean(row), row ? `status=${row.status}` : 'no row after 10s')
  check('row is accepted (present/late)', row?.status === 'present' || row?.status === 'late', String(row?.status))
  check('row carries a ledger hash', Boolean(row?.recordHash), row?.recordHash ? 'hashed' : 'missing')
  check('row carries its salt', Boolean(row?.salt))
  check('first row in the session has no predecessor', row?.prevHash === null, String(row?.prevHash))

  const { rows: counted } = await db.query(
    `SELECT count(*)::int AS total FROM "AttendanceRecord" WHERE "sessionId" = $1 AND "studentId" = $2`,
    [sessionId, studentIdOf(student)],
  )
  check('duplicate replay did not create a second row', counted[0]?.total === 1, `rows=${counted[0]?.total}`)
  await db.end()

  // 7. The chain verifies through the product's own endpoint.
  const verify = await call(API, '/audit-logs/ledger/verify', { method: 'POST', token: fixture.ADMIN_TOKEN, body: {} })
  const verified = verify.json?.status ?? verify.json?.verified
  check(
    'ledger verification passes',
    verify.status < 400 && verified !== 'broken',
    `status=${verify.status} result=${JSON.stringify(verified)} hashed=${verify.json?.hashedRecords ?? '?'}`,
  )

  // 8. Scope guard: the gateway must NOT own /sync. A misrouted batch has to
  // fail loudly (404) rather than ack with a receipt shape it cannot honour.
  const badBatch = await call(INGEST, '/sync/attendance/batches', { method: 'POST', token: student.token, body: {} })
  check('gateway refuses /sync with 404 (control plane owns it)', badBatch.status === 404, `status=${badBatch.status}`)

  // 9. Observability surface promised by the plan.
  const metrics = await fetch(`${INGEST}/metrics`).then((r) => r.text())
  check(
    'Prometheus metrics are exposed',
    metrics.includes('ingest_scans_accepted_total') && metrics.includes('ingest_buffer_depth'),
    `${metrics.split('\n').length} lines`,
  )

  return finish(sessionId)
}

// The fixture stores the auth identity separately from the row id; scans are
// keyed by the authenticated user id, which is what the record stores.
function studentIdOf(entry) {
  return entry.userId ?? entry.studentId
}

async function finish(sessionId) {
  const failed = results.filter((result) => !result.ok)
  console.log('')
  console.log(`session: ${sessionId ?? 'n/a'}`)
  console.log(`${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) {
    console.log('FAILED:', failed.map((result) => result.name).join(', '))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('E2E crashed:', error)
  process.exitCode = 1
})
