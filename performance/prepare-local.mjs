#!/usr/bin/env node
/**
 * Local-only load fixture preparation (LT3).
 *
 * Creates disposable students through the real bulk-import pipeline, rotates
 * their temporary passwords, enrolls them through the teacher master-list
 * import, then creates + activates a disposable session with a signed QR token.
 *
 * Requirements:
 *   - Local backend on http://127.0.0.1:4000 (never remote)
 *   - LOAD_TEST_AUTHORIZATION=DISPOSABLE_LOCAL_ONLY
 *   - Seeded admin + teacher credentials (defaults are the documented local seed)
 *
 * Environment:
 *   K6_USER_COUNT (default 200)
 *   K6_USER_START (default derived from the clock; five-digit sequence offset)
 *   K6_MODE=online|offline (default online; use a new run ID per mode)
 *   K6_RUN_ID (default timestamp)
 *   K6_FIXTURE_FILE (absolute path; default performance/.local-fixture-<runId>.json)
 *   PREP_BASE_URL (default http://127.0.0.1:4000)
 *   K6_BASE_URL (fixture URL for k6, default http://host.docker.internal:4000)
 *   LOAD_ADMIN_EMAIL / LOAD_ADMIN_PASSWORD (defaults: seeded super admin)
 *   LOAD_TEACHER_EMAIL / LOAD_TEACHER_PASSWORD (defaults: seeded teacher)
 */
import { writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { createSigningKeyPair, signQRToken } from '../shared/dist/index.mjs'

if (process.env.LOAD_TEST_AUTHORIZATION !== 'DISPOSABLE_LOCAL_ONLY') {
  throw new Error('Set LOAD_TEST_AUTHORIZATION=DISPOSABLE_LOCAL_ONLY to acknowledge disposable local data')
}

const prepBase = new URL(process.env.PREP_BASE_URL || 'http://127.0.0.1:4000')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(prepBase.hostname)) {
  throw new Error('prepare-local only runs against a local backend (127.0.0.1/localhost)')
}
const k6Base = new URL(process.env.K6_BASE_URL || 'http://host.docker.internal:4000')
const count = Number(process.env.K6_USER_COUNT ?? 200)
if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error('K6_USER_COUNT must be 1-5000')
const runId = process.env.K6_RUN_ID || `local-${Date.now()}`
if (!/^[A-Za-z0-9._-]{1,64}$/.test(runId)) throw new Error('K6_RUN_ID must be 1-64 safe characters')
const mode = process.env.K6_MODE || 'online'
if (!['online', 'offline'].includes(mode)) throw new Error('K6_MODE must be online or offline')
const requestedStart = Number(process.env.K6_USER_START ?? 10000 + (Date.now() % 80000))
if (!Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart + count > 100000) {
  throw new Error('K6_USER_START is invalid')
}
const fixturePath = process.env.K6_FIXTURE_FILE || join('performance', `.local-fixture-${runId}.json`)
if (!isAbsolute(fixturePath)) throw new Error('K6_FIXTURE_FILE must be an absolute path')
const concurrency = Math.min(32, Math.max(1, Number(process.env.K6_PREP_CONCURRENCY ?? 12)))

const adminEmail = process.env.LOAD_ADMIN_EMAIL || 'mcreyes@pup.edu.ph'
const adminPassword = process.env.LOAD_ADMIN_PASSWORD || 'PolycheckLocal1!'
const teacherEmail = process.env.LOAD_TEACHER_EMAIL || 'jmdelacruz@pup.edu.ph'
const teacherPassword = process.env.LOAD_TEACHER_PASSWORD || 'PolycheckLocal1!'

const request = async (path, body, token, extraHeaders = {}) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(new URL(`/api${path}`, prepBase), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.K6_PREP_TIMEOUT_MS ?? 120_000)),
      redirect: 'error',
    })
    if (response.status === 429 && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)))
      continue
    }
    if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
    return response.json()
  }
  throw new Error(`${path}: rate limit did not recover`)
}

const mapLimit = async (items, limit, worker) => {
  const results = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }))
  return results
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

console.log(`Preparing ${count} students for ${mode} run ${runId} (requested sequence ${requestedStart})`)

// 1. Provision through Flow A (bulk import) as the seeded super admin.
console.log('  admin login');
const admin = await request('/auth/mobile/login/faculty', { email: adminEmail, password: adminPassword })
const year = new Date().getFullYear()

// Find a block of student numbers that is free in this local database (E2E and
// previous load runs leave random student IDs behind).
const existingSequences = new Set()
for (let offset = 0; offset < 20000; offset += 100) {
  const page = await request(`/users?limit=100&offset=${offset}`, undefined, admin.token)
  const rows = Array.isArray(page.data) ? page.data : []
  for (const row of rows) {
    const match = typeof row.studentId === 'string' ? row.studentId.match(/^(\d{4})-(\d{5})-[A-Z]{2}-\d$/) : null
    if (match && Number(match[1]) === year) existingSequences.add(Number(match[2]))
  }
  if (!page.hasMore || rows.length === 0) break
}
let start
for (const base of [requestedStart, 10000]) {
  for (let attempt = 0; attempt < 100 && !start; attempt += 1) {
    const candidate = base + attempt * count
    if (candidate + count > 100000) break
    let free = true
    for (let index = 0; index < count; index += 1) {
      if (existingSequences.has(candidate + index)) { free = false; break }
    }
    if (free) start = candidate
  }
  if (start !== undefined) break
}
if (start === undefined) throw new Error(`No free ${count}-student block for ${year}`)
if (start !== requestedStart) console.log(`  student sequence ${requestedStart} was occupied; using ${start}`)

const students = Array.from({ length: count }, (_, index) => {
  const sequence = start + index
  return {
    rowNumber: index + 2,
    studentId: `${year}-${String(sequence).padStart(5, '0')}-MN-0`,
    fullName: `Load Student ${runId} ${sequence}`,
    program: 'BS Information Technology',
    yearLevel: 1,
    department: 'CCIS',
  }
})

const importedCredentials = []
for (const [chunkIndex, rows] of chunk(students, 250).entries()) {
  console.log(`  import chunk ${chunkIndex + 1}: validate ${rows.length} rows`)
  const validated = await request('/users/students/import', { mode: 'validate', conflictMode: 'skip_existing', rows }, admin.token)
  if (validated.summary.new !== rows.length) {
    throw new Error(`import validation expected ${rows.length} new rows, got ${validated.summary.new}: ${JSON.stringify(validated.issues?.slice(0, 5))}`)
  }
  console.log(`  import chunk ${chunkIndex + 1}: execute`)
  const executed = await request('/users/students/import', {
    mode: 'execute',
    conflictMode: 'skip_existing',
    rows,
    rowChecksum: validated.rowChecksum,
  }, admin.token, { 'Idempotency-Key': `local-${runId}-import-${chunkIndex}` })
  if (!executed.credentials || executed.credentials.length !== rows.length) {
    throw new Error(`import execute returned ${executed.credentials?.length ?? 0} credentials for ${rows.length} rows`)
  }
  importedCredentials.push(...executed.credentials)
}
console.log(`Imported ${importedCredentials.length} students; rotating temporary passwords + recording consent`)
console.log(`  rotating ${importedCredentials.length} passwords + consent (concurrency ${concurrency})`)

// 2. Log each student in, rotate the forced temporary password, accept consent.
const notice = await request('/auth/privacy-notice')
const readyStudents = await mapLimit(importedCredentials, concurrency, async (credential, index) => {
  const login = await request('/auth/mobile/login/student', {
    studentId: credential.studentId,
    password: credential.tempPassword,
  })
  const password = `Ld${runId.slice(-6)}${index}Aa1!`
  await request('/auth/change-password', { newPassword: password }, login.token)
  await request('/auth/privacy-consent', { version: notice.version }, login.token)
  return { studentId: credential.studentId, password, token: login.token }
})
console.log(`Prepared ${readyStudents.length} authenticated student sessions`)

// 3. Create a disposable teacher-owned section and enroll via Flow B import.
console.log('  teacher login + section');
const teacher = await request('/auth/mobile/login/faculty', { email: teacherEmail, password: teacherPassword })
const subject = await request('/subjects', {
  name: `Load ${runId}`,
  code: `LOAD-${runId.slice(-12).toUpperCase()}`,
  description: 'Disposable local load-test subject',
}, teacher.token)
const section = await request('/sections', {
  subjectId: subject.id,
  section: `Load ${runId}`,
  room: 'Load test only',
  semester: 'Load test',
  schedule: [{ day: 'Mon', startTime: '00:00', endTime: '23:59' }],
}, teacher.token)
for (const [chunkIndex, rows] of chunk(students.map((student) => ({ rowNumber: student.rowNumber, studentId: student.studentId })), 250).entries()) {
  console.log(`  enroll chunk ${chunkIndex + 1}: ${rows.length} rows`)
  const validated = await request(`/sections/${section.id}/enrollments/import`, { mode: 'validate', rows }, teacher.token)
  if (validated.summary.invalid !== 0) {
    throw new Error(`enrollment validation had ${validated.summary.invalid} invalid rows: ${JSON.stringify(validated.issues?.slice(0, 5))}`)
  }
  await request(`/sections/${section.id}/enrollments/import`, {
    mode: 'execute',
    rows,
    rowChecksum: validated.rowChecksum,
  }, teacher.token, { 'Idempotency-Key': `local-${runId}-enroll-${chunkIndex}` })
}
console.log(`Enrolled ${count} students into section ${section.id}`)

// 4. Provision a signing key, create and activate the disposable session.
const { publicKey, secretKey } = createSigningKeyPair()
await request('/auth/provision-key', { publicKey }, teacher.token)
const serverTime = await request('/health')
const issuedAt = new Date(serverTime.timestamp).getTime()
const session = await request('/sessions', {
  sectionId: section.id,
  subjectName: subject.name,
  date: new Date(issuedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
  startTime: '00:00',
  endTime: '23:59',
  geofence: { latitude: 14.5995, longitude: 120.9842, radiusMeters: 100 },
  qrValidityMinutes: 15,
  gracePeriodMinutes: 0,
}, teacher.token)
const qrToken = signQRToken({
  version: 1,
  sessionId: session.id,
  sectionId: section.id,
  teacherId: teacher.user.id,
  teacherName: teacher.user.fullName,
  issuedAt,
  validityMinutes: 15,
  gracePeriodMinutes: 0,
}, secretKey)
await request(`/sessions/${session.id}/activate`, { validityMinutes: 15, gracePeriodMinutes: 0, token: qrToken }, teacher.token)

await writeFile(fixturePath, JSON.stringify({
  tokens: readyStudents.map(({ token }) => ({ token })),
  BASE_URL: k6Base.origin,
  SESSION_ID: session.id,
  QR_TOKEN: qrToken,
  K6_RUN_ID: runId,
  LATITUDE: 14.5995,
  LONGITUDE: 120.9842,
  TEACHER_TOKEN: teacher.token,
}), { mode: 0o600 })

console.log('')
console.log('Local fixture ready (tokens were not printed):')
console.log(`  K6_FIXTURE_FILE=${fixturePath}`)
console.log(`  K6_RUN_ID=${runId}`)
console.log(`  K6_USER_COUNT=${count}`)
console.log(`  session=${session.id} section=${section.id}`)
console.log(`  base=${k6Base.origin}`)


