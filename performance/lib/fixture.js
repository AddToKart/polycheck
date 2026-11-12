/**
 * Fixture loader for the local 2000-student topology produced by
 * `performance/prepare-local.mjs`.
 *
 * Required shape (performance/.local-fixture-<runId>.json, mode 0600):
 * {
 *   BASE_URL, K6_RUN_ID, LATITUDE, LONGITUDE, ACCURACY_METERS, ADMIN_TOKEN,
 *   students: [{ studentId, password, token, sectionIndex, userId?, qac? }],
 *   sections: [{
 *     sectionId, subjectId, subjectName, teacherId, teacherName, teacherToken,
 *     sessionId, qrToken, signingKey?
 *   }]
 * }
 *
 * `signingKey` (base64url Ed25519 secret key, 64 bytes) is needed by the
 * `session_lifecycle` flow to sign a throwaway session's activation token.
 * `userId`/`qac` are optional accelerators; without them the proof flow
 * discovers eligibility with GET /auth/me + GET /section-roles/student/:id.
 */
import { SharedArray } from 'k6/data'

const MAX_STUDENT_SAMPLE = 20000

function fail(message) {
  throw new Error(`[fixture] ${message}`)
}

export function loadFixture() {
  const path = __ENV.K6_FIXTURE_FILE
  if (!path) {
    fail('K6_FIXTURE_FILE is required (produced by performance/prepare-local.mjs); pass it with -e K6_FIXTURE_FILE=...')
  }
  // k6 v2.3.0 resolves open() relative to the script directory (performance/)
  // and does not always propagate process env to __ENV, so accept a repo-root
  // relative path too. An absolute path is the most robust form.
  const candidates = [path]
  if (!/^([A-Za-z]:[\\/]|[\\/])/.test(path)) candidates.push(`../${path}`)
  let raw
  let lastError
  for (const candidate of candidates) {
    try {
      raw = JSON.parse(open(candidate))
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!raw) {
    fail(`could not read ${path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }

  if (!raw || typeof raw !== 'object') fail('fixture must be a JSON object')
  if (typeof raw.BASE_URL !== 'string' || !/^https?:\/\//.test(raw.BASE_URL)) fail('BASE_URL must be an http(s) URL')
  if (typeof raw.K6_RUN_ID !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(raw.K6_RUN_ID))
    fail('K6_RUN_ID must be 1-64 safe characters')
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) fail('sections[] is required and must not be empty')
  if (!Array.isArray(raw.students) || raw.students.length === 0) fail('students[] is required and must not be empty')
  if (raw.students.length > MAX_STUDENT_SAMPLE) fail(`students[] exceeds ${MAX_STUDENT_SAMPLE} entries`)

  raw.sections.forEach((section, index) => {
    for (const key of ['sectionId', 'teacherId', 'teacherToken', 'sessionId', 'qrToken']) {
      if (typeof section[key] !== 'string' || section[key].length === 0) fail(`sections[${index}].${key} is required`)
    }
  })

  raw.students.forEach((student, index) => {
    for (const key of ['studentId', 'password', 'token']) {
      if (typeof student[key] !== 'string' || student[key].length === 0) fail(`students[${index}].${key} is required`)
    }
    const sectionIndex = student.sectionIndex
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex >= raw.sections.length) {
      fail(`students[${index}].sectionIndex must be an integer in [0, ${raw.sections.length - 1}]`)
    }
  })

  const capRaw = __ENV.K6_USER_COUNT ?? __ENV.K6_MAX_STUDENTS
  const requested = capRaw === undefined || capRaw === '' ? raw.students.length : Number(capRaw)
  if (!Number.isInteger(requested) || requested < 1) fail('K6_USER_COUNT/K6_MAX_STUDENTS must be a positive integer')
  const studentCount = Math.min(requested, raw.students.length)

  return {
    baseUrl: raw.BASE_URL.replace(/\/+$/, ''),
    runId: raw.K6_RUN_ID,
    latitude: typeof raw.LATITUDE === 'number' ? raw.LATITUDE : 14.5995,
    longitude: typeof raw.LONGITUDE === 'number' ? raw.LONGITUDE : 120.9842,
    accuracyMeters: typeof raw.ACCURACY_METERS === 'number' ? raw.ACCURACY_METERS : 5,
    adminToken: raw.ADMIN_TOKEN,
    studentCount,
    students: new SharedArray('polycheck students', () => raw.students),
    sections: new SharedArray('polycheck sections', () => raw.sections),
  }
}
