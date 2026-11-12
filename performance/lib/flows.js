/**
 * Flow implementations shared by attendance-load.js, login-load.js and
 * mixed-load.js. Every function performs one realistic unit of work and
 * records it under its own `flow` tag.
 */
import { sleep } from 'k6'
import { signQRTokenPayload } from './ed25519.js'
import { request, jsonOf, isOk } from './http.js'
import { recordFlow, syncConfirmation, loginAdmittedDuration } from './metrics.js'

// 1x1 JPEG (~300 bytes): small enough not to dominate the upload flow but a
// real image for the backend's magic-byte validation.
const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/AP/Z'

const attemptIds = {}

function numberEnv(name, fallback) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number, got ${raw}`)
  return value
}

/** Measures the server clock once in setup() so locationCapturedAt is server-based. */
export function measureClockOffset(fixture) {
  const response = request(fixture, 'GET', '/health', { operation: 'setup', timeout: '10s' })
  const body = jsonOf(response)
  const serverTime = body && typeof body.timestamp === 'string' ? new Date(body.timestamp).getTime() : NaN
  return {
    clockOffsetMs: Number.isFinite(serverTime) ? serverTime - Date.now() : 0,
    healthStatus: response.status,
  }
}

function serverNowIso(clockOffsetMs) {
  return new Date(Date.now() + clockOffsetMs).toISOString()
}

/**
 * Deterministic student pick with a per-flow offset so concurrent flows in the
 * mixed script do not target the same student's record.
 */
export function pickStudent(fixture, index, offsetFraction = 0) {
  const base = Math.floor(fixture.studentCount * offsetFraction) % fixture.studentCount
  return fixture.students[(base + index) % fixture.studentCount]
}

function sectionOf(fixture, student) {
  return fixture.sections[student.sectionIndex]
}

function clientAttemptId(fixture, flow, index) {
  const key = `${flow}:${index}`
  attemptIds[key] = (attemptIds[key] || 0) + 1
  const suffix = attemptIds[key] > 1 ? `-r${attemptIds[key]}` : ''
  const id = `${fixture.runId}-${flow}-${index}${suffix}`
  return id.length > 128 ? id.slice(0, 128) : id
}

function scanPayload(fixture, section, attemptId, clockOffsetMs) {
  return {
    sessionId: section.sessionId,
    qrToken: section.qrToken,
    lat: fixture.latitude,
    lon: fixture.longitude,
    accuracyMeters: fixture.accuracyMeters,
    locationCapturedAt: serverNowIso(clockOffsetMs),
    inputChannel: 'camera',
    mocked: false,
    clientAttemptId: attemptId,
  }
}

const meCache = {}
const roleCache = {}

function getMe(fixture, student) {
  if (typeof student.userId === 'string' && student.userId.length > 0) return { id: student.userId }
  if (meCache[student.studentId]) return meCache[student.studentId]
  const response = request(fixture, 'GET', '/auth/me', { token: student.token, operation: 'auth_me' })
  const body = jsonOf(response)
  if (body && typeof body.id === 'string') {
    meCache[student.studentId] = body
    return body
  }
  return null
}

/** Scans once; if the record already exists (duplicate), resolves it via the roster list. */
function ensureRecord(fixture, student, section, clockOffsetMs, flow, index) {
  const scanResponse = request(fixture, 'POST', '/attendance/scan', {
    token: student.token,
    operation: `${flow}_record_scan`,
    body: scanPayload(fixture, section, clientAttemptId(fixture, `${flow}-lookup`, index), clockOffsetMs),
  })
  const scanned = jsonOf(scanResponse)
  if (scanned && typeof scanned.id === 'string') return { record: scanned, response: scanResponse }

  const me = getMe(fixture, student)
  if (!me) return { record: null, response: scanResponse }
  const listResponse = request(fixture, 'GET', `/attendance/student/${encodeURIComponent(me.id)}`, {
    token: student.token,
    operation: `${flow}_record_lookup`,
  })
  const records = jsonOf(listResponse)
  if (!Array.isArray(records)) return { record: null, response: listResponse }
  const match = records.find((item) => item && item.sessionId === section.sessionId) || null
  return { record: match, response: listResponse }
}

// ── Flows ────────────────────────────────────────────────────────────────

/**
 * Stable installation id for the load generator. The backend's login gate
 * grandfathers legacy null-device sessions when the attempt identifies itself,
 * but fails closed for an unidentified attempt while any session exists — so a
 * fixture token plus a re-login needs a real deviceId. Keeping it constant per
 * run also avoids tripping the "signed in on another device" branch on re-runs.
 */
function loadDeviceId(fixture) {
  const id = `k6-${fixture.runId}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 128)
  return id
}

export function runLogin(fixture, shape, clockOffsetMs, index) {
  const student = pickStudent(fixture, index)
  const response = request(fixture, 'POST', '/auth/mobile/login/student', {
    operation: 'login',
    body: { studentId: student.studentId, password: student.password, deviceId: loadDeviceId(fixture) },
  })
  const body = jsonOf(response)
  const ok = (response.status === 200 || response.status === 201) && Boolean(body && body.token)
  const result = recordFlow('login', shape, response, ok)
  if (ok) loginAdmittedDuration.add(response.timings.duration)
  return result
}

export function runScan(fixture, shape, clockOffsetMs, index) {
  const student = pickStudent(fixture, index)
  const section = sectionOf(fixture, student)
  const response = request(fixture, 'POST', '/attendance/scan', {
    token: student.token,
    operation: 'scan',
    body: scanPayload(fixture, section, clientAttemptId(fixture, 'scan', index), clockOffsetMs),
  })
  const body = jsonOf(response)
  // A duplicate acknowledgement is the documented replay behaviour for a
  // second scan of the same session: the request was fully processed, so it
  // counts as success (it is how a real student's retry is answered).
  const duplicateAcknowledged =
    body && typeof body.error === 'string' && /already/i.test(body.error) && !/rejected/i.test(body.error)
  const ok = isOk(response) && (Boolean(body && typeof body.id === 'string') || duplicateAcknowledged)
  return recordFlow('scan', shape, response, ok)
}

export function runSync(fixture, shape, clockOffsetMs, index) {
  const student = pickStudent(fixture, index, 0.75)
  const section = sectionOf(fixture, student)
  const payload = {
    ...scanPayload(fixture, section, clientAttemptId(fixture, 'sync', index), clockOffsetMs),
    scannedAt: serverNowIso(clockOffsetMs),
  }
  const enqueueResponse = request(fixture, 'POST', '/sync/attendance/batches', {
    token: student.token,
    operation: 'sync_enqueue',
    body: { records: [payload] },
  })
  const enqueueBody = jsonOf(enqueueResponse)
  const receiptId = enqueueBody && typeof enqueueBody.receiptId === 'string' ? enqueueBody.receiptId : null
  recordFlow('sync_enqueue', shape, enqueueResponse, enqueueResponse.status === 202 && Boolean(receiptId))
  if (!receiptId) return

  const deadlineMs = numberEnv('K6_SYNC_DEADLINE_SECONDS', 30) * 1000
  const pollSeconds = Math.max(0.05, numberEnv('K6_SYNC_POLL_SECONDS', 0.25))
  const startedAt = Date.now()
  const deadline = startedAt + deadlineMs
  let state = 'pending'
  let resultsOk = false
  let lastResponse = enqueueResponse
  while (Date.now() < deadline) {
    lastResponse = request(fixture, 'GET', `/sync/attendance/batches/${receiptId}`, {
      token: student.token,
      operation: 'sync_receipt',
    })
    const body = jsonOf(lastResponse)
    if (body && body.state === 'completed') {
      // `syncScan` answers a replayed record with `{ error: 'Attendance was
      // already submitted...' }`. That is an acknowledged replay (the queue
      // processed the batch), not a broken pipeline, so it still counts as a
      // successful confirmation; genuine rejections keep their own `error`.
      resultsOk =
        Array.isArray(body.results) &&
        body.results.length > 0 &&
        body.results.every(
          (result) =>
            result && (typeof result.error !== 'string' || /already/i.test(result.error)),
        )
      state = 'completed'
      break
    }
    if (body && body.state === 'failed') {
      state = 'failed'
      break
    }
    sleep(pollSeconds)
  }
  const elapsedMs = Date.now() - startedAt
  if (state === 'completed') syncConfirmation.add(elapsedMs)
  recordFlow('sync_receipt', shape, lastResponse, state === 'completed' && resultsOk, { durationMs: elapsedMs })
}

export function runDispute(fixture, shape, clockOffsetMs, index) {
  const student = pickStudent(fixture, index, 0.85)
  const section = sectionOf(fixture, student)
  const { record, response } = ensureRecord(fixture, student, section, clockOffsetMs, 'dispute', index)
  if (!record) {
    recordFlow('dispute', shape, response, false, { tags: { phase: 'file' } })
    return
  }
  const fileResponse = request(fixture, 'POST', '/disputes', {
    token: student.token,
    operation: 'dispute',
    body: {
      recordId: record.id,
      reason: 'expired_token',
      description: `Load test ${fixture.runId}: student reports an expired token at the door.`,
    },
  })
  const fileBody = jsonOf(fileResponse)
  const alreadyDisputed =
    fileResponse.status === 409 &&
    /unresolved dispute/i.test(String((fileBody && fileBody.message) || fileResponse.body || ''))
  if (alreadyDisputed) {
    // The record is already under review (auto-flagged or a replayed run); the
    // professor's queue owns it. Acknowledge the replay, no second filing.
    recordFlow('dispute', shape, fileResponse, true, { tags: { phase: 'file' } })
    return
  }
  const filed = isOk(fileResponse) && Boolean(fileBody && fileBody.id)
  recordFlow('dispute', shape, fileResponse, filed, { tags: { phase: 'file' } })
  if (!filed) return

  const resolveShare = Math.min(1, Math.max(0, numberEnv('K6_DISPUTE_RESOLVE_SHARE', 0.5)))
  const shouldResolve = index % 100 < Math.round(resolveShare * 100)
  if (!shouldResolve) return
  const resolveResponse = request(fixture, 'POST', `/disputes/${encodeURIComponent(fileBody.id)}/resolve`, {
    token: section.teacherToken,
    operation: 'dispute',
    body: { resolution: index % 2 === 0 ? 'accept' : 'reject' },
  })
  recordFlow('dispute', shape, resolveResponse, isOk(resolveResponse), { tags: { phase: 'resolve' } })
}

export function runExcuse(fixture, shape, clockOffsetMs, index) {
  const student = pickStudent(fixture, index, 0.95)
  const section = sectionOf(fixture, student)
  const { record, response } = ensureRecord(fixture, student, section, clockOffsetMs, 'excuse', index)
  if (!record) {
    recordFlow('excuse', shape, response, false, { tags: { phase: 'file' } })
    return
  }
  // Always re-mark late immediately before filing: the professor's "mark late"
  // is a real cockpit action, and it keeps the excuse valid when a concurrent
  // dispute in the mixed run flips the record between the lookup and the file.
  const markResponse = request(fixture, 'PATCH', `/attendance/${encodeURIComponent(record.id)}/status`, {
    token: section.teacherToken,
    operation: 'excuse',
    body: { status: 'late' },
  })
  if (!isOk(markResponse)) {
    recordFlow('excuse', shape, markResponse, false, { tags: { phase: 'file' } })
    return
  }
  const excuseBody = {
    reason: 'medical',
    description: `Load test ${fixture.runId}: medical certificate submitted for review.`,
  }
  let fileResponse = request(fixture, 'POST', `/attendance/records/${encodeURIComponent(record.id)}/excuse`, {
    token: student.token,
    operation: 'excuse',
    body: excuseBody,
  })
  if (fileResponse.status === 400 && /only absent/i.test(fileResponse.body || '')) {
    // Lost a race with a concurrent status change; re-mark and retry once.
    const remark = request(fixture, 'PATCH', `/attendance/${encodeURIComponent(record.id)}/status`, {
      token: section.teacherToken,
      operation: 'excuse',
      body: { status: 'late' },
    })
    if (isOk(remark)) {
      fileResponse = request(fixture, 'POST', `/attendance/records/${encodeURIComponent(record.id)}/excuse`, {
        token: student.token,
        operation: 'excuse',
        body: excuseBody,
      })
    }
  }
  const fileBody = jsonOf(fileResponse)
  const alreadyExcused =
    fileResponse.status === 409 &&
    /already/i.test(String((fileBody && fileBody.message) || fileResponse.body || ''))
  if (alreadyExcused) {
    // Re-running against a record that already carries an approved excuse:
    // there is no API to clear it, so acknowledge the replay instead of
    // reporting a pipeline failure.
    recordFlow('excuse', shape, fileResponse, true, { tags: { phase: 'file' } })
    return
  }
  const filed = isOk(fileResponse)
  recordFlow('excuse', shape, fileResponse, filed, { tags: { phase: 'file' } })
  if (!filed) return
  const decisionResponse = request(
    fixture,
    'POST',
    `/attendance/records/${encodeURIComponent(record.id)}/excuse/decision`,
    {
      token: section.teacherToken,
      operation: 'excuse',
      body: { decision: 'approve', note: 'Approved by load-test professor' },
    },
  )
  recordFlow('excuse', shape, decisionResponse, isOk(decisionResponse), { tags: { phase: 'resolve' } })
}

export function runFacultyRead(fixture, shape, clockOffsetMs, index) {
  const section = fixture.sections[index % fixture.sections.length]
  const paths = [
    `/sessions/${encodeURIComponent(section.sessionId)}`,
    `/attendance?sessionId=${encodeURIComponent(section.sessionId)}`,
    `/attendance/summaries?sectionId=${encodeURIComponent(section.sectionId)}`,
    `/attendance/report?sectionId=${encodeURIComponent(section.sectionId)}`,
    `/attendance/at-risk?sectionId=${encodeURIComponent(section.sectionId)}`,
    `/attendance/excuses?sectionId=${encodeURIComponent(section.sectionId)}`,
    '/notifications/unread-count',
  ]
  let failingResponse = null
  let lastResponse = null
  for (const path of paths) {
    lastResponse = request(fixture, 'GET', path, { token: section.teacherToken, operation: 'faculty_read' })
    if (!isOk(lastResponse) && !failingResponse) failingResponse = lastResponse
  }
  return recordFlow('faculty_read', shape, failingResponse || lastResponse, !failingResponse)
}

export function runAdminRead(fixture, shape, clockOffsetMs, index) {
  if (!fixture.adminToken) {
    recordFlow('admin_read', shape, null, false, { tags: { reason: 'missing_admin_token' } })
    return
  }
  const offset = (index % 50) * 20
  const paths = [
    '/dashboard/admin-overview',
    `/users?limit=20&offset=${offset}`,
    // The audit-log controller accepts page/pageSize, not limit.
    '/audit-logs?page=1&pageSize=20',
    '/dashboard/server-status',
    '/reports/stats',
  ]
  let failingResponse = null
  let lastResponse = null
  for (const path of paths) {
    lastResponse = request(fixture, 'GET', path, { token: fixture.adminToken, operation: 'admin_read' })
    if (!isOk(lastResponse) && !failingResponse) failingResponse = lastResponse
  }
  return recordFlow('admin_read', shape, failingResponse || lastResponse, !failingResponse)
}

function proofEligible(fixture, student, section) {
  if (student.qac === true) return true
  if (student.qac === false) return false
  if (roleCache[student.studentId] !== undefined) return roleCache[student.studentId]
  const me = getMe(fixture, student)
  if (!me) {
    roleCache[student.studentId] = false
    return false
  }
  const response = request(fixture, 'GET', `/section-roles/student/${encodeURIComponent(me.id)}`, {
    token: student.token,
    operation: 'role_lookup',
  })
  const roles = jsonOf(response)
  const eligible =
    Array.isArray(roles) && roles.some((role) => role && role.role === 'qac' && role.sectionId === section.sectionId)
  roleCache[student.studentId] = eligible
  return eligible
}

export function runProofUpload(fixture, shape, clockOffsetMs, index) {
  const candidates = Math.max(1, Math.min(200, numberEnv('K6_PROOF_CANDIDATES', 60)))
  const step = Math.max(1, Math.floor(fixture.studentCount / candidates))
  for (let attempt = 0; attempt < candidates; attempt++) {
    const student = fixture.students[(index * step + attempt * step) % fixture.studentCount]
    const section = sectionOf(fixture, student)
    if (!proofEligible(fixture, student, section)) continue
    const response = request(fixture, 'POST', '/proofs', {
      token: student.token,
      operation: 'proof_upload',
      body: {
        sectionId: section.sectionId,
        sessionId: section.sessionId,
        photoData: TINY_JPEG_DATA_URL,
        description: `Load test ${fixture.runId} proof of class`,
      },
    })
    return recordFlow('proof_upload', shape, response, isOk(response))
  }
  return recordFlow('proof_upload', shape, null, false, { tags: { reason: 'no_eligible_student' } })
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function localTimeParts(ms) {
  const date = new Date(ms)
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  }
}

export function runSessionLifecycle(fixture, shape, clockOffsetMs, index) {
  const section = fixture.sections[index % fixture.sections.length]
  if (!section.signingKey) {
    recordFlow('session_lifecycle', shape, null, false, { tags: { reason: 'missing_signing_key' } })
    return
  }
  // Each cycle uses its own future slot (5 min + 3 min per iteration + 2 min
  // per retry). A 409 means that (section, date, startTime) slot already exists
  // — e.g. a fixture session or a previous cycle — so shift the slot and retry.
  let createResponse = null
  let session = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const slotMs = Date.now() + clockOffsetMs + (5 + index * 3 + attempt * 2) * 60 * 1000
    const { date, time: startTime } = localTimeParts(slotMs)
    const endTime = localTimeParts(slotMs + 60 * 60 * 1000).time
    createResponse = request(fixture, 'POST', '/sessions', {
      token: section.teacherToken,
      operation: 'session_lifecycle',
      body: {
        sectionId: section.sectionId,
        subjectName: section.subjectName || `Load test ${fixture.runId}`,
        mode: 'in_person',
        date,
        startTime,
        endTime,
        qrValidityMinutes: 15,
        gracePeriodMinutes: 0,
        geofence: { latitude: fixture.latitude, longitude: fixture.longitude, radiusMeters: 100 },
      },
    })
    session = jsonOf(createResponse)
    if (isOk(createResponse) && session && typeof session.id === 'string') break
    if (createResponse.status !== 409) break
    session = null
  }
  if (!isOk(createResponse) || !session || typeof session.id !== 'string') {
    recordFlow('session_lifecycle', shape, createResponse, false)
    return
  }

  // Signed locally with the professor's fixture Ed25519 key (lib/ed25519.js).
  let token
  try {
    token = signQRTokenPayload(
      {
        version: 1,
        sessionId: session.id,
        sectionId: section.sectionId,
        issuedAt: Date.now() + clockOffsetMs,
        validityMinutes: 15,
        gracePeriodMinutes: 0,
        teacherId: section.teacherId,
        teacherName: section.teacherName || 'Load Test Professor',
        mode: 'in_person',
        pinRequired: false,
      },
      section.signingKey,
    )
  } catch (error) {
    recordFlow('session_lifecycle', shape, createResponse, false, { tags: { reason: 'signing_failed' } })
    return
  }
  const activateResponse = request(fixture, 'POST', `/sessions/${encodeURIComponent(session.id)}/activate`, {
    token: section.teacherToken,
    operation: 'session_lifecycle',
    body: { validityMinutes: 15, gracePeriodMinutes: 0, token },
  })
  const endResponse = request(fixture, 'POST', `/sessions/${encodeURIComponent(session.id)}/end`, {
    token: section.teacherToken,
    operation: 'session_lifecycle',
    body: {},
  })
  const decisive = isOk(activateResponse) ? endResponse : activateResponse
  return recordFlow('session_lifecycle', shape, decisive, isOk(activateResponse) && isOk(endResponse))
}
