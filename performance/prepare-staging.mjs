import { writeFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { createSigningKeyPair, signQRToken } from '../shared/dist/index.mjs'

// Dedicated, disposable load-test accounts only. This script never creates or
// changes passwords and never emits bearer tokens to stdout or workflow outputs.
const fixture = JSON.parse(process.env.LOAD_FIXTURE_JSON || '{}')
const fixturePath = process.env.K6_FIXTURE_FILE
if (!fixturePath || !isAbsolute(fixturePath)) throw new Error('K6_FIXTURE_FILE must be an absolute path to a restricted temporary file')
const base = new URL(process.env.STAGING_BASE_URL || '')
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('A credential-free HTTPS staging origin is required')
if (process.env.LOAD_TEST_AUTHORIZATION !== 'DISPOSABLE_STAGING_ONLY') throw new Error('Explicit disposable staging configuration is required')
const count = process.env.K6_PROFILE === 'full' ? 1000 : 2
if (!Array.isArray(fixture.students) || fixture.students.length < count) throw new Error(`Provide ${count} dedicated student credentials`)
const students = fixture.students.slice(0, count).map((student) => typeof student === 'string'
  ? { studentId: student, password: fixture.studentPassword }
  : student)
if (students.some((student) => !student.studentId || !student.password)) throw new Error('Every dedicated student needs an ID and password')
if (!fixture.teacher?.email?.startsWith('loadtest-')) throw new Error('Use a dedicated loadtest- teacher account')
if (new Set(students.map((student) => student.studentId)).size !== count) throw new Error('Student fixtures must be distinct')
if (process.env.K6_MODE === 'login') {
  await writeFile(fixturePath, JSON.stringify({ BASE_URL: base.origin, credentials: students.map(({ studentId, password }) => ({ studentId, password })) }), { mode: 0o600, flag: 'wx' })
  console.log(`Prepared ${count} dedicated login fixtures; credentials were not logged.`)
  process.exit(0)
}
const request = async (path, body, token) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(new URL(`/api${path}`, base), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000), redirect: 'error',
    })
    if (response.status === 429 && attempt < 5) { await new Promise((resolve) => setTimeout(resolve, 60_000)); continue }
    if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}`)
    return response.json()
  }
  throw new Error('Rate limit did not recover')
}
const teacher = await request('/auth/mobile/login/faculty', { email: fixture.teacher.email, password: fixture.teacher.password })
const notice = await request('/auth/privacy-notice')
const runId = `${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}-${process.env.K6_MODE || 'online'}`
const subject = await request('/subjects', { name: `Load test ${runId}`, code: `LT-${Date.now()}` }, teacher.token)
const section = await request('/sections', { subjectId: subject.id, section: `Load ${runId}`, room: 'Test only', semester: 'Load test', schedule: [{ day: 'Mon', startTime: '00:00', endTime: '23:59' }] }, teacher.token)
const tokens = []
for (const credentials of students) {
  const student = await request('/auth/mobile/login/student', { studentId: credentials.studentId, password: credentials.password })
  await request('/auth/privacy-consent', { version: notice.version }, student.token)
  await request(`/sections/${section.id}/enroll-student`, { studentId: student.user.id, studentName: student.user.fullName }, teacher.token)
  tokens.push({ token: student.token })
}
const { publicKey, secretKey } = createSigningKeyPair()
await request('/auth/provision-key', { publicKey }, teacher.token)
const serverTime = await request('/health')
const issuedAt = new Date(serverTime.timestamp).getTime()
const session = await request('/sessions', { sectionId: section.id, subjectName: subject.name, date: new Date(issuedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), startTime: '00:00', endTime: '23:59', geofence: { latitude: 14.5995, longitude: 120.9842, radiusMeters: 100 }, qrValidityMinutes: 15, gracePeriodMinutes: 0 }, teacher.token)
const qrToken = signQRToken({ version: 1, sessionId: session.id, sectionId: section.id, teacherId: teacher.user.id, teacherName: teacher.user.fullName, issuedAt, validityMinutes: 15, gracePeriodMinutes: 0 }, secretKey)
await request(`/sessions/${session.id}/activate`, { validityMinutes: 15, gracePeriodMinutes: 0, token: qrToken }, teacher.token)
await writeFile(fixturePath, JSON.stringify({ tokens, BASE_URL: base.origin, SESSION_ID: session.id, QR_TOKEN: qrToken, K6_RUN_ID: runId, LATITUDE: 14.5995, LONGITUDE: 120.9842, TEACHER_TOKEN: teacher.token }), { mode: 0o600, flag: 'wx' })
console.log(`Prepared ${count} students and one disposable session; credentials were not logged.`)
