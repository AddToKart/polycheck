#!/usr/bin/env node
/**
 * Creates a fresh activated session for an existing local load fixture, so the
 * same student tokens can be reused for another run (the server rejects
 * duplicate session+student check-ins, so each run needs its own session).
 *
 * Usage:
 *   K6_FIXTURE_FILE=<abs path> K6_NEW_RUN_ID=<new run id> node performance/new-local-session.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createSigningKeyPair, signQRToken } from '../shared/dist/index.mjs'

const fixturePath = process.env.K6_FIXTURE_FILE
if (!fixturePath) throw new Error('K6_FIXTURE_FILE is required')
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const prepBase = new URL(process.env.PREP_BASE_URL || 'http://127.0.0.1:4000')
const runId = process.env.K6_NEW_RUN_ID || `${fixture.K6_RUN_ID || 'local'}-${Date.now()}`
if (!/^[A-Za-z0-9._-]{1,64}$/.test(runId)) throw new Error('K6_NEW_RUN_ID must be 1-64 safe characters')

const request = async (path, body, token) => {
  const response = await fetch(new URL(`/api${path}`, prepBase), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  return response.json()
}

const teacherToken = fixture.TEACHER_TOKEN
if (!teacherToken) throw new Error('Fixture has no TEACHER_TOKEN')

const { publicKey, secretKey } = createSigningKeyPair()
await request('/auth/provision-key', { publicKey }, teacherToken)
const serverTime = await request('/health')
const issuedAt = new Date(serverTime.timestamp).getTime()
const date = new Date(issuedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

let session
let lastError
for (let minute = Number(process.env.K6_SESSION_START_MINUTE || 1); minute < 55; minute += 1) {
  const startTime = `00:${String(minute).padStart(2, '0')}`
  try {
    session = await request('/sessions', {
      sectionId: fixture.SESSION_SECTION_ID || (await request(`/sessions/${fixture.SESSION_ID}`, undefined, teacherToken)).sectionId,
      subjectName: fixture.SESSION_SUBJECT_NAME || 'Load test',
      date,
      startTime,
      endTime: '23:59',
      geofence: { latitude: fixture.LATITUDE, longitude: fixture.LONGITUDE, radiusMeters: 100 },
      qrValidityMinutes: 15,
      gracePeriodMinutes: 0,
    }, teacherToken)
    break
  } catch (error) {
    lastError = error
  }
}
if (!session) throw lastError || new Error('Could not create a fresh session (no free time slot)')

const qrToken = signQRToken({
  version: 1,
  sessionId: session.id,
  sectionId: session.sectionId,
  teacherId: session.teacherId,
  teacherName: 'Load test',
  issuedAt,
  validityMinutes: 15,
  gracePeriodMinutes: 0,
}, secretKey)
await request(`/sessions/${session.id}/activate`, { validityMinutes: 15, gracePeriodMinutes: 0, token: qrToken }, teacherToken)

fixture.SESSION_ID = session.id
fixture.QR_TOKEN = qrToken
fixture.K6_RUN_ID = runId
await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 })
console.log(`New session ${session.id} activated; fixture updated with run ${runId}`)
