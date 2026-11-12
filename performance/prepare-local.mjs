#!/usr/bin/env node
/**
 * Local-only load fixture preparation — the 2000-student attendance topology.
 *
 * Provisions, through the real product pipelines:
 *   1. 2000 students via the super-admin bulk import (Flow A), 250 rows/chunk,
 *      then a forced password rotation + privacy consent per student.
 *   2. 12 professors (`POST /users/teachers`, explicit passwords so
 *      `mustChangePassword` is never set) and 12 subjects (one per professor).
 *   3. 34 sections — 3 per subject for the first 11 subjects, 1 for the 12th —
 *      enrolled through the teacher enrollment import (Flow B) in 250-row
 *      chunks, asserting each section's `studentCount` afterwards.
 *   4. One Ed25519 signing key per professor and one activated in-person
 *      session per owned section, with a QR token signed locally against the
 *      backend clock (`GET /health`), never the device clock.
 *
 * The result is written in the fixture contract consumed by the k6 scripts:
 *   performance/.local-fixture-<runId>.json   (mode 0600, gitignored)
 *
 * Requirements:
 *   - Local backend on http://127.0.0.1:4000 (never remote)
 *   - LOAD_TEST_AUTHORIZATION=DISPOSABLE_LOCAL_ONLY
 *   - Seeded super-admin credentials (defaults are the documented local seed)
 *
 * Environment:
 *   K6_USER_COUNT (default 2000; the mandated 33x60 + 1x20 split applies at 2000)
 *   K6_USER_START (default derived from the clock; five-digit sequence offset)
 *   K6_RUN_ID (default timestamp) — reruns with the same ID reuse, never duplicate
 *   K6_FIXTURE_FILE (absolute path; default performance/.local-fixture-<runId>.json)
 *   PREP_BASE_URL (default http://127.0.0.1:4000)
 *   K6_BASE_URL (fixture URL for k6, default http://127.0.0.1:4000)
 *   K6_PREP_CONCURRENCY (default 12, capped at 32)
 *   K6_PREP_TIMEOUT_MS (default 600000; a 250-row import hashes 250 passwords)
 *   K6_PREP_RETRIES (default 12; 429/5xx honour Retry-After with jittered backoff)
 *   K6_LOGIN_RATE_PER_MINUTE (default 800; must stay under LOGIN_IP_RATE_LIMIT)
 *   LOAD_ADMIN_EMAIL / LOAD_ADMIN_PASSWORD (defaults: seeded super admin)
 */
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'
import { createSigningKeyPair, signQRToken } from '../shared/dist/index.mjs'
import { TOPOLOGY, buildTopology } from './topology.mjs'

if (process.env.LOAD_TEST_AUTHORIZATION !== 'DISPOSABLE_LOCAL_ONLY') {
  throw new Error('Set LOAD_TEST_AUTHORIZATION=DISPOSABLE_LOCAL_ONLY to acknowledge disposable local data')
}

const prepBase = new URL(process.env.PREP_BASE_URL || 'http://127.0.0.1:4000')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(prepBase.hostname)) {
  throw new Error('prepare-local only runs against a local backend (127.0.0.1/localhost)')
}
const k6Base = new URL(process.env.K6_BASE_URL || 'http://127.0.0.1:4000')

const count = Number(process.env.K6_USER_COUNT ?? TOPOLOGY.studentCount)
if (!Number.isInteger(count) || count < TOPOLOGY.sectionCount || count > 5000) {
  throw new Error(`K6_USER_COUNT must be an integer between ${TOPOLOGY.sectionCount} and 5000`)
}
const runId = process.env.K6_RUN_ID || `local-${Date.now()}`
if (!/^[A-Za-z0-9._-]{1,64}$/.test(runId)) throw new Error('K6_RUN_ID must be 1-64 safe characters')

const requestedStart = Number(process.env.K6_USER_START ?? 10000 + (Date.now() % 60000))
if (!Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart + count > 99999) {
  throw new Error('K6_USER_START is invalid')
}

const fixturePath = (() => {
  const configured = process.env.K6_FIXTURE_FILE
  if (!configured) return resolve(process.cwd(), 'performance', `.local-fixture-${runId}.json`)
  if (!isAbsolute(configured)) throw new Error('K6_FIXTURE_FILE must be an absolute path')
  return configured
})()

const concurrency = Math.min(32, Math.max(1, Number(process.env.K6_PREP_CONCURRENCY ?? 12)))
/**
 * Password rotation opens one interactive transaction per request. The backend
 * runs bcrypt on a 4-thread libuv pool, so more than ~6 concurrent rotations
 * only queues transactions until Prisma's `maxWait` trips (HTTP 500
 * "Unable to start a transaction in the given time").
 */
const authConcurrency = Math.min(6, concurrency)
/**
 * The backend hashes with `bcryptjs` (pure JS, cost 12), so every hash blocks
 * its event loop for ~1s on a single core. Running chunks in parallel adds no
 * throughput, it only multiplies event-loop starvation, so imports stay serial.
 */
const importConcurrency = 1
const requestTimeoutMs = Math.max(10_000, Number(process.env.K6_PREP_TIMEOUT_MS ?? 600_000))
const maxAttempts = Math.min(20, Math.max(1, Number(process.env.K6_PREP_RETRIES ?? 12)))
const loginRatePerMinute = Math.min(1000, Math.max(1, Number(process.env.K6_LOGIN_RATE_PER_MINUTE ?? 800)))
const loginIntervalMs = 60_000 / loginRatePerMinute

const adminEmail = process.env.LOAD_ADMIN_EMAIL || 'mcreyes@pup.edu.ph'
const adminPassword = process.env.LOAD_ADMIN_PASSWORD || 'PolycheckLocal1!'

const GEO = { latitude: 14.5995, longitude: 120.9842, radiusMeters: 100 }
const ACCURACY_METERS = 5
const QR_VALIDITY_MINUTES = 15
const GRACE_PERIOD_MINUTES = 0
const SEMESTER = 'Load test'
const SESSION_START = '00:00'
const SESSION_END = '23:59'
/** A 250-row import hashes 250 passwords at bcrypt cost 12 (~60-90s). */
const importChunkSize = 250

// ── HTTP plumbing ────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(path, status, body) {
    super(`${path} failed with HTTP ${status}: ${String(body).slice(0, 400)}`)
    this.status = status
    this.path = path
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const backoffMs = (attempt) => Math.min(15_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)

const parseRetryAfter = (value) => {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, seconds * 1000)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.min(60_000, Math.max(0, at - Date.now())) : null
}

const requestJson = async (path, { body, token, headers = {}, allowStatus = [], idempotent = false } = {}) => {
  const url = new URL(`/api${path}`, prepBase)
  // 500 is only retried for calls that are safe to repeat; the importer and the
  // enrollment executor dedupe by student ID / idempotency key.
  const retryStatuses = idempotent ? [429, 500, 502, 503, 504] : [429, 502, 503, 504]
  for (let attempt = 0; ; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMs),
        redirect: 'error',
      })
    } catch (error) {
      if (attempt >= maxAttempts) throw error
      await sleep(backoffMs(attempt))
      continue
    }

    // 429 is expected here: 2000 student logins share one client IP and the
    // backend caps that at LOGIN_IP_RATE_LIMIT per window.
    if (retryStatuses.includes(response.status)) {
      if (attempt >= maxAttempts) {
        throw new Error(`${path}: still HTTP ${response.status} after ${maxAttempts + 1} attempts`)
      }
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
      await sleep(retryAfter ?? backoffMs(attempt))
      continue
    }

    if (allowStatus.includes(response.status)) {
      return { status: response.status, data: await response.json().catch(() => null) }
    }
    if (!response.ok) throw new HttpError(path, response.status, await response.text())
    return response.json()
  }
}

const mapLimit = async (items, limit, worker) => {
  const results = new Array(items.length)
  let cursor = 0
  const width = Math.max(1, Math.min(limit, items.length))
  await Promise.all(
    Array.from({ length: width }, async () => {
      for (;;) {
        const index = cursor
        cursor += 1
        if (index >= items.length) return
        results[index] = await worker(items[index], index)
      }
    }),
  )
  return results
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

/**
 * Student logins are the only IP-rate-limited burst. Spacing their starts under
 * LOGIN_IP_RATE_LIMIT (1000/min locally) avoids a 429 storm instead of relying
 * on retries to absorb one.
 */
let nextLoginSlot = 0
const awaitLoginSlot = async () => {
  const now = Date.now()
  const slot = Math.max(now, nextLoginSlot)
  nextLoginSlot = slot + loginIntervalMs
  if (slot > now) await sleep(slot - now)
}

// ── Observability ────────────────────────────────────────────────────────────

const startedAt = Date.now()
const timings = []
const formatDuration = (ms) => {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m${String(seconds).padStart(2, '0')}s` : `${seconds}s`
}

const phase = async (name, run) => {
  const phaseStart = Date.now()
  console.log(`[${name}] start`)
  try {
    const result = await run()
    const elapsed = Date.now() - phaseStart
    timings.push({ name, ms: elapsed })
    console.log(`[${name}] done in ${formatDuration(elapsed)}`)
    return result
  } catch (error) {
    timings.push({ name: `${name} (failed)`, ms: Date.now() - phaseStart })
    console.error(`[${name}] FAILED after ${formatDuration(Date.now() - phaseStart)}: ${error.message}`)
    throw error
  }
}

// ── Topology ─────────────────────────────────────────────────────────────────

const topology = buildTopology({ runId, studentCount: count })
console.log(
  `Preparing ${count} students / ${TOPOLOGY.sectionCount} sections / ${TOPOLOGY.subjectCount} subjects / ` +
    `${TOPOLOGY.professorCount} professors (run ${runId}, concurrency ${concurrency})`,
)

// ── Health clock ─────────────────────────────────────────────────────────────

let cachedClock = 0
let cachedClockAt = 0
const serverNow = async () => {
  if (Date.now() - cachedClockAt < 30_000) return cachedClock
  const health = await requestJson('/health')
  const parsed = Date.parse(health?.timestamp ?? '')
  if (!Number.isFinite(parsed)) throw new Error('/health did not return a usable timestamp')
  cachedClock = parsed
  cachedClockAt = Date.now()
  return cachedClock
}
const manilaDate = (ms) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms),
  )

// ── Student identities ───────────────────────────────────────────────────────

const loadPreviousFixture = async () => {
  try {
    return JSON.parse(await readFile(fixturePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const findFreeStudentBlock = async (adminToken) => {
  const year = new Date().getFullYear()
  const existing = new Set()
  for (let offset = 0; ; offset += 100) {
    const page = await requestJson(`/users?role=student&limit=100&offset=${offset}`, { token: adminToken })
    const rows = Array.isArray(page?.data) ? page.data : []
    for (const row of rows) {
      const match = typeof row.studentId === 'string' ? row.studentId.match(/^(\d{4})-(\d{5})-[A-Z]{2}-\d$/) : null
      if (match && Number(match[1]) === year) existing.add(Number(match[2]))
    }
    if (!page?.hasMore || rows.length === 0) break
  }

  const bases = requestedStart === 10000 ? [10000] : [requestedStart, 10000]
  for (const base of bases) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = base + attempt * count
      if (candidate + count > 100000) break
      let free = true
      for (let index = 0; index < count; index += 1) {
        if (existing.has(candidate + index)) {
          free = false
          break
        }
      }
      if (free) return { year, start: candidate }
    }
  }
  throw new Error(`No free ${count}-student block for ${year}; rerun with a different K6_USER_START`)
}

const buildIdentities = (year, start) =>
  Array.from({ length: count }, (_, index) => ({
    studentId: `${year}-${String(start + index).padStart(5, '0')}-MN-0`,
    sequence: String(start + index).padStart(5, '0'),
    password: `Ld${runId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'Load'}S${index + 1}Aa1!`,
  }))

let previousFixture = null
let identities = null

const admin = await phase('admin login', async () => {
  const session = await requestJson('/auth/mobile/login/faculty', {
    body: { email: adminEmail, password: adminPassword },
    // Logins are the first thing to fail while a previous bulk hash is still
    // blocking the event loop; repeating one is harmless.
    idempotent: true,
  })
  console.log(`  signed in as ${session.user.role} (${session.user.email})`)
  return session
})

await phase('student identities', async () => {
  previousFixture = await loadPreviousFixture()
  const reusable = Array.isArray(previousFixture?.students) && previousFixture.students.length === count
  if (reusable) {
    const mismatched = previousFixture.students.findIndex(
      (student, index) => student?.sectionIndex !== topology.studentSectionIndexes[index],
    )
    if (mismatched !== -1) {
      throw new Error(
        `Existing fixture ${fixturePath} has a different section layout at student #${mismatched + 1}; ` +
          'use a new K6_RUN_ID or delete the fixture',
      )
    }
    identities = previousFixture.students.map(({ studentId, password }) => ({ studentId, password }))
    console.log(`  reusing ${identities.length} student identities from ${fixturePath}`)
    return
  }
  if (previousFixture) console.log('  existing fixture does not match this topology; allocating fresh student IDs')
  const { year, start } = await findFreeStudentBlock(admin.token)
  if (start !== requestedStart) console.log(`  student sequence ${requestedStart} was occupied; using ${start}`)
  identities = buildIdentities(year, start)
  console.log(`  allocated ${identities.length} student IDs from ${identities[0].studentId}`)
})

const rows = identities.map((identity, index) => ({
  rowNumber: index + 2,
  studentId: identity.studentId,
  fullName: `Load Student ${runId} ${identity.sequence ?? identity.studentId.slice(5, 10)}`,
  program: 'BS Information Technology',
  yearLevel: 1,
  department: 'CCIS',
}))

// ── Phase 1: student import (Flow A) ─────────────────────────────────────────

const temporaryPasswords = new Map()
let importedCount = 0

await phase('student import', async () => {
  const chunks = chunk(rows, importChunkSize)
  let completedChunks = 0

  await mapLimit(chunks, importConcurrency, async (chunkRows, chunkIndex) => {
    const label = `chunk ${chunkIndex + 1}/${chunks.length} (${chunkRows.length} rows)`
    const validated = await requestJson('/users/students/import', {
      body: { mode: 'validate', conflictMode: 'skip_existing', rows: chunkRows },
      token: admin.token,
      idempotent: true,
    })
    const summary = validated.summary ?? {}
    if ((summary.invalid ?? 0) !== 0) {
      throw new Error(`${label}: ${summary.invalid} invalid rows: ${JSON.stringify((validated.issues ?? []).slice(0, 5))}`)
    }
    if ((summary.new ?? 0) === 0) {
      console.log(`  ${label}: validate only — all rows already exist`)
      return
    }
    const executed = await requestJson('/users/students/import', {
      body: { mode: 'execute', conflictMode: 'skip_existing', rows: chunkRows, rowChecksum: validated.rowChecksum },
      token: admin.token,
      headers: { 'Idempotency-Key': `load-${runId}-import-${chunkIndex}` },
      idempotent: true,
    })
    const credentials = executed.credentials ?? []
    if (credentials.length !== summary.new) {
      throw new Error(`${label}: execute returned ${credentials.length} credentials for ${summary.new} new rows`)
    }
    for (const credential of credentials) temporaryPasswords.set(credential.studentId, credential.tempPassword)
    importedCount += credentials.length
    completedChunks += 1
    console.log(`  ${label}: created ${credentials.length} (${completedChunks}/${chunks.length} chunks executed)`)
  })

  console.log(`  imported ${importedCount} new students (${count - importedCount} already existed)`)
})

// ── Phase 2: student login + forced rotation + consent ───────────────────────

const notice = await requestJson('/auth/privacy-notice')
const studentTokens = new Array(identities.length)
const studentUserIds = new Array(identities.length)
let rotatedCount = 0
let consentedCount = 0
const loginFailures = []

/**
 * `change-password` opens an interactive transaction. Under pool pressure
 * Prisma can answer 500 before the transaction starts, or commit and still
 * answer 500. Retrying is safe: a 400 means "no current password required",
 * i.e. the rotation already committed, which we confirm via `/auth/me`.
 */
const rotatePassword = async (token, newPassword) => {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await requestJson('/auth/change-password', { body: { newPassword }, token })
      return
    } catch (error) {
      lastError = error
      const status = error instanceof HttpError ? error.status : 0
      if (status === 400) {
        const me = await requestJson('/auth/me', { token, idempotent: true })
        if (me?.mustChangePassword === false) return
        throw error
      }
      if (status !== 500) throw error
      await sleep(1_000 * (attempt + 1))
    }
  }
  throw lastError
}

await phase('student authentication', async () => {
  console.log(
    `  ${identities.length} logins paced at ${loginRatePerMinute}/min (under LOGIN_IP_RATE_LIMIT), ` +
      `concurrency ${authConcurrency}`,
  )
  let completed = 0
  const reportEvery = Math.max(1, Math.floor(identities.length / 8))

  const prepared = await mapLimit(identities, authConcurrency, async (identity, index) => {
    await awaitLoginSlot()
    try {
      const login = await requestJson('/auth/mobile/login/student', {
        body: { studentId: identity.studentId, password: temporaryPasswords.get(identity.studentId) ?? identity.password },
        idempotent: true,
      })

      if (login.user?.mustChangePassword) {
        await rotatePassword(login.token, identity.password)
        rotatedCount += 1
      }
      if (login.user?.privacyConsentVersion !== notice.version) {
        await requestJson('/auth/privacy-consent', {
          body: { version: notice.version },
          token: login.token,
          idempotent: true,
        })
        consentedCount += 1
      }
      return { token: login.token, userId: login.user.id, studentId: identity.studentId }
    } catch (error) {
      if (error instanceof HttpError && [401, 403].includes(error.status)) {
        loginFailures.push({ studentId: identity.studentId, error: error.message })
        return null
      }
      throw error
    } finally {
      completed += 1
      if (completed % reportEvery === 0) console.log(`  authenticated ${completed}/${identities.length}`)
    }
  })

  prepared.forEach((entry, index) => {
    if (!entry) return
    studentTokens[index] = entry.token
    studentUserIds[index] = entry.userId
  })
  if (loginFailures.length > 0) {
    throw new Error(
      `${loginFailures.length} students could not authenticate (first: ${loginFailures[0].studentId}). ` +
        'Existing accounts without the deterministic password point at a partial earlier run — use a new K6_RUN_ID.',
    )
  }
  console.log(`  rotated ${rotatedCount} passwords, recorded ${consentedCount} consents`)
})

// ── Phase 3: professors ──────────────────────────────────────────────────────

const professors = await phase('professors', async () => {
  let created = 0
  let existing = 0
  const result = await mapLimit(topology.professors, Math.min(6, concurrency), async (professor) => {
    const response = await requestJson('/users/teachers', {
      body: {
        fullName: professor.fullName,
        email: professor.email,
        password: professor.password,
        department: professor.department,
      },
      token: admin.token,
      allowStatus: [409],
      // A retry after a committed 500 lands on 409 (unique email) and falls
      // through to the login below, which is the desired end state.
      idempotent: true,
    })
    if (response.status === 409) existing += 1
    else created += 1

    const login = await requestJson('/auth/mobile/login/faculty', {
      body: { email: professor.email, password: professor.password },
      idempotent: true,
    })
    if (login.user?.mustChangePassword) {
      throw new Error(`Professor ${professor.email} still requires a password change; delete it and rerun`)
    }
    return { ...professor, userId: login.user.id, fullName: login.user.fullName, token: login.token }
  })
  console.log(`  created ${created} professors, reused ${existing}`)
  return result
})

// ── Phase 4: subjects ────────────────────────────────────────────────────────

const subjects = await phase('subjects', async () => {
  let created = 0
  const result = await mapLimit(topology.subjects, Math.min(6, concurrency), async (subject) => {
    const professor = professors[subject.professorIndex]
    const findSubject = async () => {
      const list = await requestJson('/subjects', { token: professor.token, idempotent: true })
      return Array.isArray(list) ? list.find((entry) => entry.name === subject.name) : null
    }

    const found = await findSubject()
    if (found) return { ...subject, id: found.id, code: found.code }

    try {
      const fresh = await requestJson('/subjects', {
        body: { name: subject.name, code: subject.code, description: subject.description },
        token: professor.token,
      })
      created += 1
      return { ...subject, id: fresh.id, code: fresh.code }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 0
      if (status !== 409 && status !== 500) throw error
      const recovered = await findSubject()
      if (recovered) return { ...subject, id: recovered.id, code: recovered.code }
      throw error
    }
  })
  console.log(`  created ${created} subjects, reused ${result.length - created}`)
  return result
})

// ── Phase 5: sections ────────────────────────────────────────────────────────

const sections = await phase('sections', async () => {
  let created = 0
  const result = await mapLimit(topology.sections, Math.min(6, concurrency), async (section) => {
    const professor = professors[section.professorIndex]
    const subject = subjects[section.subjectIndex]
    const findSection = async () => {
      const list = await requestJson('/sections', { token: professor.token, idempotent: true })
      return Array.isArray(list)
        ? list.find((entry) => entry.section === section.name && entry.subjectId === subject.id)
        : null
    }

    const found = await findSection()
    if (found) {
      return { ...section, sectionId: found.id, subjectId: subject.id, professor }
    }

    try {
      const fresh = await requestJson('/sections', {
        body: {
          subjectId: subject.id,
          section: section.name,
          course: 'BSIT',
          room: 'Load test only',
          semester: SEMESTER,
          schedule: [{ day: 'Mon', startTime: SESSION_START, endTime: SESSION_END }],
        },
        token: professor.token,
      })
      created += 1
      return { ...section, sectionId: fresh.id, subjectId: subject.id, professor }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 0
      if (status !== 409 && status !== 500) throw error
      const recovered = await findSection()
      if (recovered) return { ...section, sectionId: recovered.id, subjectId: subject.id, professor }
      throw error
    }
  })
  console.log(`  created ${created} sections, reused ${result.length - created}`)
  return result
})

// ── Phase 6: enrollment import (Flow B) ──────────────────────────────────────

await phase('enrollments', async () => {
  let enrolledSections = 0
  let enrolledRows = 0
  let completed = 0

  await mapLimit(sections, Math.min(6, concurrency), async (section) => {
    const studentIndexes = topology.studentsBySection[section.index]
    const sectionRows = studentIndexes.map((studentIndex, offset) => ({
      rowNumber: offset + 2,
      studentId: identities[studentIndex].studentId,
    }))

    for (const [chunkIndex, chunkRows] of chunk(sectionRows, importChunkSize).entries()) {
      const validated = await requestJson(`/sections/${section.sectionId}/enrollments/import`, {
        body: { mode: 'validate', rows: chunkRows },
        token: section.professor.token,
        idempotent: true,
      })
      const summary = validated.summary ?? {}
      if ((summary.invalid ?? 0) !== 0) {
        throw new Error(
          `section ${section.name} chunk ${chunkIndex + 1}: ${summary.invalid} invalid rows: ` +
            JSON.stringify((validated.issues ?? []).slice(0, 5)),
        )
      }
      if ((summary.enrollable ?? 0) > 0) {
        // Re-executing is safe: enrollments dedupe on (section, student) and the
        // importer reconciles the cached studentCount in the same transaction.
        await requestJson(`/sections/${section.sectionId}/enrollments/import`, {
          body: { mode: 'execute', rows: chunkRows, rowChecksum: validated.rowChecksum },
          token: section.professor.token,
          headers: { 'Idempotency-Key': `load-${runId}-enroll-${section.index}-${chunkIndex}` },
          idempotent: true,
        })
        enrolledRows += summary.enrollable
        enrolledSections += 1
      }
    }

    const fresh = await requestJson(`/sections/${section.sectionId}`, { token: section.professor.token, idempotent: true })
    if (fresh.studentCount !== section.capacity) {
      throw new Error(`section ${section.name}: studentCount ${fresh.studentCount}, expected ${section.capacity}`)
    }

    completed += 1
    if (completed % 5 === 0 || completed === sections.length) console.log(`  verified ${completed}/${sections.length} sections`)
  })

  console.log(`  enrolled ${enrolledRows} rows into ${enrolledSections} sections; every section studentCount matches`)
})

// ── Phase 7: QAC section roles (proof upload authorization) ──────────────────

const qacStudentIndexes = new Set()

await phase('qac roles', async () => {
  const targets = sections.slice(0, Math.min(20, sections.length)).map((section) => ({
    section,
    studentIndex: topology.studentsBySection[section.index][0],
  }))

  await mapLimit(targets, Math.min(6, concurrency), async ({ section, studentIndex }) => {
    const userId = studentUserIds[studentIndex]
    if (!userId) throw new Error(`student #${studentIndex + 1} has no user id; cannot grant the qac role`)
    await requestJson('/section-roles', {
      body: { sectionId: section.sectionId, studentId: userId, role: 'qac' },
      token: section.professor.token,
      idempotent: true,
    })
    qacStudentIndexes.add(studentIndex)
  })

  console.log(`  granted qac in ${targets.length} sections (${qacStudentIndexes.size} students)`)
})

// ── Phase 8: signing keys ────────────────────────────────────────────────────

const secrets = await phase('signing keys', async () => {
  const result = await mapLimit(professors, Math.min(6, concurrency), async (professor) => {
    // Deterministic seeds keep a rerun with the same K6_RUN_ID from invalidating
    // the tokens it already issued (the public key stays identical).
    const seed = new Uint8Array(
      createHash('sha256').update(`polycheck-load-signing:${runId}:${professor.index}`).digest(),
    )
    const pair = createSigningKeyPair(seed)
    await requestJson('/auth/provision-key', {
      body: { publicKey: pair.publicKey },
      token: professor.token,
      idempotent: true,
    })
    return { index: professor.index, secretKey: pair.secretKey }
  })
  console.log(`  provisioned ${result.length} signing keys`)
  return result
})

// ── Phase 8: sessions ────────────────────────────────────────────────────────

const countSessions = (list, sectionId, date) =>
  (Array.isArray(list) ? list : []).find(
    (entry) => entry.sectionId === sectionId && entry.date === date && entry.startTime === SESSION_START && entry.endTime === SESSION_END,
  )

/**
 * A 500 can mean the session row was committed before the response failed, and
 * a 409 means a concurrent duplicate landed first. Both resolve by re-reading
 * the section's sessions and reusing the row that exists.
 */
const createSessionRow = async (section, professor, date) => {
  try {
    return await requestJson('/sessions', {
      body: {
        sectionId: section.sectionId,
        subjectName: subjects[section.subjectIndex].name,
        mode: 'in_person',
        date,
        startTime: SESSION_START,
        endTime: SESSION_END,
        geofence: GEO,
        qrValidityMinutes: QR_VALIDITY_MINUTES,
        gracePeriodMinutes: GRACE_PERIOD_MINUTES,
      },
      token: professor.token,
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 0
    if (status !== 409 && status !== 500) throw error
    const list = await requestJson(`/sessions?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: professor.token,
      idempotent: true,
    })
    const found = countSessions(list, section.sectionId, date)
    if (found) return found
    throw error
  }
}

/**
 * Activation is not retry-safe by itself (a committed activation answers 409 on
 * a repeat), so a 409/500 is resolved by re-reading the session and accepting an
 * already-active row.
 */
const activateSession = async (section, professor, sessionId, qrToken) => {
  try {
    const activated = await requestJson(`/sessions/${sessionId}/activate`, {
      body: {
        validityMinutes: QR_VALIDITY_MINUTES,
        gracePeriodMinutes: GRACE_PERIOD_MINUTES,
        token: qrToken,
      },
      token: professor.token,
    })
    if (activated.isActive !== true) {
      throw new Error(`section ${section.name}: session ${sessionId} did not activate (${activated.endedAt ?? 'no end'})`)
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 0
    if (status !== 409 && status !== 500) throw error
    const list = await requestJson(`/sessions?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: professor.token,
      idempotent: true,
    })
    const found = (Array.isArray(list) ? list : []).find((entry) => entry.id === sessionId)
    if (found?.isActive) return
    throw error
  }
}

const sessions = await phase('sessions', async () => {
  let createdSessions = 0
  let reusedSessions = 0

  const result = await mapLimit(sections, Math.min(6, concurrency), async (section) => {
    const professor = section.professor
    const secretKey = secrets[professor.index].secretKey
    const issuedAt = await serverNow()
    const date = manilaDate(issuedAt)

    const existingList = await requestJson(`/sessions?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: professor.token,
      idempotent: true,
    })
    const existing = countSessions(existingList, section.sectionId, date)

    if (existing?.isActive && existing.qrToken) {
      reusedSessions += 1
      return { ...section, sessionId: existing.id, qrToken: existing.qrToken }
    }
    if (existing && (existing.isActive || existing.endedAt || existing.qrToken)) {
      throw new Error(
        `section ${section.name} already has a finished session for ${date}; ` +
          'rerun with a new K6_RUN_ID (or end it and retry)',
      )
    }

    const session = existing ?? (await createSessionRow(section, professor, date))

    const qrToken = signQRToken(
      {
        version: 1,
        sessionId: session.id,
        sectionId: section.sectionId,
        teacherId: professor.userId,
        teacherName: professor.fullName,
        issuedAt: await serverNow(),
        validityMinutes: QR_VALIDITY_MINUTES,
        gracePeriodMinutes: GRACE_PERIOD_MINUTES,
      },
      secretKey,
    )
    await activateSession(section, professor, session.id, qrToken)
    createdSessions += 1
    return { ...section, sessionId: session.id, qrToken }
  })

  console.log(`  activated ${createdSessions} sessions, reused ${reusedSessions}`)
  return result
})

// ── Fixture ──────────────────────────────────────────────────────────────────

const fixture = {
  BASE_URL: k6Base.origin,
  K6_RUN_ID: runId,
  LATITUDE: GEO.latitude,
  LONGITUDE: GEO.longitude,
  ACCURACY_METERS,
  ADMIN_TOKEN: admin.token,
  students: identities.map((identity, index) => ({
    studentId: identity.studentId,
    userId: studentUserIds[index],
    password: identity.password,
    token: studentTokens[index],
    sectionIndex: topology.studentSectionIndexes[index],
    ...(qacStudentIndexes.has(index) ? { qac: true } : {}),
  })),
  sections: sessions.map((section) => ({
    sectionId: section.sectionId,
    subjectId: section.subjectId,
    subjectName: subjects[section.subjectIndex].name,
    teacherId: section.professor.userId,
    teacherName: section.professor.fullName,
    teacherToken: section.professor.token,
    // Same secret used to sign this section's qrToken: the k6 session_lifecycle
    // flow re-signs a throwaway token with it (k6 has no Ed25519 in WebCrypto).
    signingKey: secrets[section.professor.index].secretKey,
    sessionId: section.sessionId,
    qrToken: section.qrToken,
  })),
}

await phase('fixture write', async () => {
  if (fixture.students.some((student) => !student.token)) {
    throw new Error('refusing to write a fixture with missing student tokens')
  }
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, { mode: 0o600 })
  await chmod(fixturePath, 0o600)
  console.log(`  wrote ${fixturePath}`)
})

// ── Assertions + summary ─────────────────────────────────────────────────────

const distinctStudentTokens = new Set(fixture.students.map((student) => student.token)).size
const distinctSections = new Set(fixture.sections.map((section) => section.sectionId)).size
const distinctSessions = new Set(fixture.sections.map((section) => section.sessionId)).size
const distinctQrTokens = new Set(fixture.sections.map((section) => section.qrToken)).size
const distinctTeachers = new Set(fixture.sections.map((section) => section.teacherId)).size
const sectionsPerSubject = new Map()
for (const section of fixture.sections) {
  sectionsPerSubject.set(section.subjectId, (sectionsPerSubject.get(section.subjectId) ?? 0) + 1)
}
const threeSectionSubjects = [...sectionsPerSubject.values()].filter((value) => value === 3).length

const problems = []
const distinctStudentIds = new Set(fixture.students.map((student) => student.studentId)).size
const perSectionCounts = new Map()
for (const student of fixture.students) {
  perSectionCounts.set(student.sectionIndex, (perSectionCounts.get(student.sectionIndex) ?? 0) + 1)
}
const missingUserIds = fixture.students.filter((student) => !student.userId).length
const qacCount = fixture.students.filter((student) => student.qac).length
const expectedQac = Math.min(20, fixture.sections.length)
const badSigningKeys = fixture.sections.filter((section) => typeof section.signingKey !== 'string' || section.signingKey.length < 80).length
if (distinctStudentIds !== count) problems.push(`${distinctStudentIds} distinct studentIds, expected ${count}`)
if (perSectionCounts.size !== TOPOLOGY.sectionCount) {
  problems.push(`${perSectionCounts.size} section indexes used, expected ${TOPOLOGY.sectionCount}`)
}
for (const section of topology.sections) {
  const actual = perSectionCounts.get(section.index) ?? 0
  if (actual !== section.capacity) {
    problems.push(`sectionIndex ${section.index} has ${actual} students, expected ${section.capacity}`)
  }
}
if (missingUserIds > 0) problems.push(`${missingUserIds} students without a userId`)
if (qacCount !== expectedQac) problems.push(`${qacCount} qac students, expected ${expectedQac}`)
if (badSigningKeys > 0) problems.push(`${badSigningKeys} sections without a base64url signingKey`)
if (fixture.students.length !== count) problems.push(`${fixture.students.length} students, expected ${count}`)
if (distinctStudentTokens !== count) problems.push(`${distinctStudentTokens} distinct student tokens, expected ${count}`)
if (distinctSections !== TOPOLOGY.sectionCount) problems.push(`${distinctSections} sections, expected ${TOPOLOGY.sectionCount}`)
if (distinctSessions !== TOPOLOGY.sectionCount) problems.push(`${distinctSessions} sessions, expected ${TOPOLOGY.sectionCount}`)
if (distinctQrTokens !== TOPOLOGY.sectionCount) problems.push(`${distinctQrTokens} QR tokens, expected ${TOPOLOGY.sectionCount}`)
if (distinctTeachers !== TOPOLOGY.professorCount) {
  problems.push(`${distinctTeachers} professors, expected ${TOPOLOGY.professorCount}`)
}
if (sectionsPerSubject.size !== TOPOLOGY.subjectCount) {
  problems.push(`${sectionsPerSubject.size} subjects with sections, expected ${TOPOLOGY.subjectCount}`)
}
if (threeSectionSubjects !== 11) problems.push(`${threeSectionSubjects} subjects with 3 sections, expected 11`)
if (problems.length > 0) throw new Error(`fixture assertions failed: ${problems.join('; ')}`)

const totalMs = Date.now() - startedAt
console.log('')
console.log('Local fixture ready (tokens and passwords were not printed):')
console.log(`  K6_FIXTURE_FILE=${fixturePath}`)
console.log(`  K6_RUN_ID=${runId}`)
console.log(`  students=${fixture.students.length} sections=${fixture.sections.length} sessions=${distinctSessions}`)
console.log(`  professors=${distinctTeachers} subjects=${sectionsPerSubject.size} (3 sections: ${threeSectionSubjects})`)
console.log(`  base=${fixture.BASE_URL}  wall-clock=${formatDuration(totalMs)}`)
console.log('  phase timings:')
for (const timing of timings) console.log(`    ${timing.name}: ${formatDuration(timing.ms)}`)
