/**
 * Polycheck — student / professor / admin service matrix.
 *
 * Every user-facing service the web and mobile clients call, exercised once per
 * iteration and reported under its own `flow` tag. The AI assistant is
 * deliberately excluded.
 *
 * Unlike `mixed-load.js` (which samples 7 services at a blended rate) this
 * script runs one dedicated scenario per service, so the professor's QR
 * lifecycle, the section/subject composers, the document exports and the
 * governance routes all get real sample counts instead of token ones.
 *
 * ── Invocation matrix ─────────────────────────────────────────────────────
 *   K6_FIXTURE_FILE        required
 *   K6_SHAPE               burst | arrival (default burst — one pass per service)
 *   K6_SVC_ITERATIONS      iterations per read/list service (default 12)
 *   K6_QR_ITERATIONS       iterations for the QR/session composers (default 20)
 *   K6_SVC_ONLY            optional comma list of flow names to run
 *   K6_PROFILE             smoke | full | burst (threshold set only)
 *   K6_SUMMARY_EXPORT      path for k6's native summary JSON
 */
import exec from 'k6/execution'
import { signQRTokenPayload } from './lib/ed25519.js'
import { loadFixture } from './lib/fixture.js'
import { measureClockOffset, pickStudent } from './lib/flows.js'
import { request, jsonOf, isOk } from './lib/http.js'
import { recordFlow, shapeOf, profileOf } from './lib/metrics.js'
import { fixedScenario } from './lib/scenarios.js'
import { buildThresholds } from './lib/thresholds.js'
import { summarize } from './lib/summary.js'

const fixture = loadFixture()
const shape = shapeOf()
const profile = profileOf()

const READ_ITERATIONS = intEnv('K6_SVC_ITERATIONS', 12, 1, 500)
const WRITE_ITERATIONS = intEnv('K6_QR_ITERATIONS', 20, 1, 500)

function intEnv(name, fallback, min, max) {
  const raw = __ENV[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}], got ${raw}`)
  }
  return value
}

const pad2 = (value) => String(value).padStart(2, '0')

function localParts(ms) {
  const date = new Date(ms)
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  }
}

/* ------------------------------------------------------------------ helpers */

const sectionAt = (index) => fixture.sections[index % fixture.sections.length]
const studentAt = (index) => pickStudent(fixture, index)

/** `/calendar/events` requires an explicit date window. */
function calendarPath() {
  const start = localParts(Date.now() - 7 * 24 * 60 * 60 * 1000).date
  const end = localParts(Date.now() + 30 * 24 * 60 * 60 * 1000).date
  return `/calendar/events?startDate=${start}&endDate=${end}`
}

const idCache = new Map()
/** `/auth/me` is needed for student-scoped routes; one call per VU per identity. */
function meId(student) {
  const cached = idCache.get(student.studentId)
  if (cached) return cached
  const response = request(fixture, 'GET', '/auth/me', { token: student.token, operation: 'me' })
  const body = jsonOf(response)
  if (body && typeof body.id === 'string') {
    idCache.set(student.studentId, body.id)
    return body.id
  }
  return null
}

/**
 * Runs several requests as one workflow: every step must succeed, and the flow
 * is recorded once with the total wall time so p95 reflects the service, not a
 * single hop inside it.
 */
function series(flow, steps) {
  const startedAt = Date.now()
  let failing = null
  let last = null
  for (const step of steps) {
    last = request(fixture, step.method || 'GET', step.path, {
      token: step.token,
      operation: flow,
      body: step.body,
    })
    if (!isOk(last)) {
      failing = last
      break
    }
    if (step.after) step.after(last)
  }
  recordFlow(flow, shape, failing || last, !failing, { durationMs: Date.now() - startedAt })
  return failing ? null : last
}

function ok(flow, response) {
  recordFlow(flow, shape, response, isOk(response))
  return isOk(response)
}

function createSession(flow, section, { online = false, offsetMinutes = 5 } = {}) {
  // A (section, date, startTime) slot is unique, so concurrent iterations collide.
  // Shift the slot on 409 exactly like lib/flows.js#runSessionLifecycle does.
  const baseOffset = offsetMinutes + Math.floor(Math.random() * 240)
  let lastResponse = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const offsetMs = Date.now() + (baseOffset + attempt * 17) * 60 * 1000
    const { date, time: startTime } = localParts(offsetMs)
    const endTime = localParts(offsetMs + 60 * 60 * 1000).time
    const body = {
      sectionId: section.sectionId,
      subjectName: section.subjectName || `Load test ${fixture.runId}`,
      mode: online ? 'online' : 'in_person',
      date,
      startTime,
      endTime,
      qrValidityMinutes: 15,
      gracePeriodMinutes: 0,
    }
    if (online) {
      body.startQrValiditySeconds = 120
      body.endQrValiditySeconds = 120
    } else {
      body.geofence = { latitude: fixture.latitude, longitude: fixture.longitude, radiusMeters: 100 }
    }
    lastResponse = request(fixture, 'POST', '/sessions', {
      token: section.teacherToken,
      operation: flow,
      body,
    })
    const created = jsonOf(lastResponse)
    if (isOk(lastResponse) && created && typeof created.id === 'string') {
      return { response: lastResponse, session: created }
    }
    if (lastResponse.status !== 409) return { response: lastResponse, session: null }
  }
  return { response: lastResponse, session: null }
}

function signToken(section, session, clockOffsetMs, extra = {}) {
  return signQRTokenPayload(
    {
      version: 1,
      sessionId: session.id,
      sectionId: section.sectionId,
      issuedAt: Date.now() + clockOffsetMs,
      validityMinutes: 15,
      gracePeriodMinutes: 0,
      teacherId: section.teacherId,
      teacherName: section.teacherName || 'Load Test Professor',
      mode: session.mode || 'in_person',
      pinRequired: false,
      ...extra,
    },
    section.signingKey,
  )
}

/* ------------------------------------------------------------------- flows */

/** Student: the authenticated session bootstrap the app runs on every launch. */
function authSession(index) {
  const student = studentAt(index)
  return series('auth_session', [
    { path: '/auth/me', token: student.token },
    { path: '/auth/privacy-notice', token: student.token },
  ])
}

/** Student: schedule surfaces (session list, section list, calendar). */
function studentSchedule(index) {
  const student = studentAt(index)
  const section = sectionAt(student.sectionIndex)
  return series('student_schedule', [
    { path: '/sessions', token: student.token },
    { path: '/sections', token: student.token },
    { path: calendarPath(), token: student.token },
    { path: `/sections/${encodeURIComponent(section.sectionId)}`, token: student.token },
  ])
}

/** Student: attendance history + summaries for one section. */
function studentHistory(index) {
  const student = studentAt(index)
  const section = sectionAt(student.sectionIndex)
  const id = meId(student)
  if (!id) {
    recordFlow('student_history', shape, null, false, { tags: { reason: 'missing_me' } })
    return
  }
  return series('student_history', [
    { path: `/attendance/student/${encodeURIComponent(id)}`, token: student.token },
    { path: `/sessions/${encodeURIComponent(section.sessionId)}`, token: student.token },
  ])
}

/** Student: the deterministic standing evaluator behind the dashboard banner. */
function studentStanding(index) {
  return ok('student_standing', request(fixture, 'GET', '/me/standing', { token: studentAt(index).token, operation: 'student_standing' }))
}

/** Student: notification centre (list, badge, mark-read). */
function notifications(index) {
  const student = studentAt(index)
  return series('notifications', [
    { path: '/notifications', token: student.token },
    { path: '/notifications/unread-count', token: student.token },
    { path: '/notifications/read', method: 'POST', token: student.token, body: { ids: [] } },
  ])
}

/** Student: subject catalogue browse. */
function subjectBrowse(index) {
  const student = studentAt(index)
  return series('subject_browse', [
    { path: '/subjects', token: student.token },
    { path: '/sections', token: student.token },
  ])
}

/** Student: file a system report, then read the "my reports" panel. */
function systemReports(index) {
  const student = studentAt(index)
  return series('system_reports', [
    {
      method: 'POST',
      path: '/reports',
      token: student.token,
      body: {
        category: 'scanner_camera',
        severity: 'low',
        title: `Load test ${fixture.runId} report ${index}`,
        description: `Automated load-test report ${fixture.runId} index ${index}; no action required.`,
      },
    },
    { path: '/reports/my', token: student.token },
  ])
}

/** Student: record lookup + forensic timeline (the dispute review rail). */
function attendanceTimeline(index) {
  const student = studentAt(index)
  const section = sectionAt(student.sectionIndex)
  const list = request(fixture, 'GET', `/attendance?sessionId=${encodeURIComponent(section.sessionId)}`, {
    token: section.teacherToken,
    operation: 'attendance_timeline',
  })
  const rows = jsonOf(list)
  const recordId = Array.isArray(rows) && rows[0] && rows[0].id ? rows[0].id : null
  if (!recordId) {
    recordFlow('attendance_timeline', shape, list, false, { tags: { reason: 'no_record' } })
    return
  }
  return ok(
    'attendance_timeline',
    request(fixture, 'GET', `/attendance/records/${encodeURIComponent(recordId)}/timeline`, {
      token: section.teacherToken,
      operation: 'attendance_timeline',
    }),
  )
}

/**
 * Professor: the full QR lifecycle — create the session, sign the token locally,
 * arm the checkpoint, regenerate it, then end the class. This is the flow that
 * was previously exercised 3 times total.
 */
function qrActivate(index, clockOffsetMs) {
  const section = sectionAt(index)
  if (!section.signingKey) {
    recordFlow('qr_activate', shape, null, false, { tags: { reason: 'missing_signing_key' } })
    return
  }
  const startedAt = Date.now()
  const { response: createResponse, session } = createSession('qr_activate', section)
  if (!session) {
    recordFlow('qr_activate', shape, createResponse, false, { tags: { phase: 'create' }, durationMs: Date.now() - startedAt })
    return
  }
  let token
  try {
    token = signToken(section, session, clockOffsetMs)
  } catch {
    recordFlow('qr_activate', shape, createResponse, false, { tags: { phase: 'sign' }, durationMs: Date.now() - startedAt })
    return
  }
  const steps = [
    {
      method: 'POST',
      path: `/sessions/${encodeURIComponent(session.id)}/activate`,
      token: section.teacherToken,
      body: { validityMinutes: 15, gracePeriodMinutes: 0, token },
      phase: 'activate',
    },
    {
      method: 'POST',
      path: `/sessions/${encodeURIComponent(session.id)}/end`,
      token: section.teacherToken,
      body: {},
      phase: 'end',
    },
  ]
  for (const step of steps) {
    const response = request(fixture, step.method, step.path, {
      token: step.token,
      operation: 'qr_activate',
      body: step.body,
    })
    if (!isOk(response)) {
      recordFlow('qr_activate', shape, response, false, { tags: { phase: step.phase }, durationMs: Date.now() - startedAt })
      return
    }
  }
  recordFlow('qr_activate', shape, createResponse, true, { durationMs: Date.now() - startedAt })
}

/**
 * Professor: hybrid/online session with both checkpoints (the zero-GPS path —
 * no geofence, seconds-based validity, start then end checkpoint).
 */
function qrOnlineCheckpoints(index, clockOffsetMs) {
  const section = sectionAt(index)
  if (!section.signingKey) {
    recordFlow('qr_online_checkpoints', shape, null, false, { tags: { reason: 'missing_signing_key' } })
    return
  }
  const startedAt = Date.now()
  const { response: createResponse, session } = createSession('qr_online_checkpoints', section, { online: true })
  if (!session) {
    recordFlow('qr_online_checkpoints', shape, createResponse, false, { tags: { phase: 'create' }, durationMs: Date.now() - startedAt })
    return
  }
  for (const checkpoint of ['start', 'end']) {
    let token
    try {
      token = signToken(section, session, clockOffsetMs, { checkpoint, validitySeconds: 120 })
    } catch {
      recordFlow('qr_online_checkpoints', shape, createResponse, false, { tags: { phase: `sign_${checkpoint}` }, durationMs: Date.now() - startedAt })
      return
    }
    const response = request(fixture, 'POST', `/sessions/${encodeURIComponent(session.id)}/activate`, {
      token: section.teacherToken,
      operation: 'qr_online_checkpoints',
      body: { checkpoint, validitySeconds: 120, token },
    })
    if (!isOk(response)) {
      recordFlow('qr_online_checkpoints', shape, response, false, { tags: { phase: checkpoint }, durationMs: Date.now() - startedAt })
      return
    }
  }
  const endResponse = request(fixture, 'POST', `/sessions/${encodeURIComponent(session.id)}/end`, {
    token: section.teacherToken,
    operation: 'qr_online_checkpoints',
    body: {},
  })
  recordFlow('qr_online_checkpoints', shape, endResponse, isOk(endResponse), {
    tags: { phase: 'end' },
    durationMs: Date.now() - startedAt,
  })
}

/** Professor: recurring-session composer (slot-aware bulk). */
function sessionBulk(index) {
  const section = sectionAt(index)
  // Each run claims its own month-scale window so a re-run does not collide with
  // sessions a previous run created. A residual 409 means the target date already
  // had a session — that is the documented conflict behaviour, not a failure.
  const dayOffset = 10 + (Date.now() % 700) + index * 45
  const start = Date.now() + dayOffset * 24 * 60 * 60 * 1000
  const end = start + 7 * 24 * 60 * 60 * 1000
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][index % 5]
  const response = request(fixture, 'POST', '/sessions/bulk', {
    token: section.teacherToken,
    operation: 'session_bulk',
    body: {
      sectionId: section.sectionId,
      subjectName: section.subjectName || `Load test ${fixture.runId}`,
      mode: 'online',
      startDate: localParts(start).date,
      endDate: localParts(end).date,
      slots: [{ day, startTime: '09:00', endTime: '10:00' }],
    },
  })
  recordFlow('session_bulk', shape, response, isOk(response) || response.status === 409, {
    tags: response.status === 409 ? { phase: 'date_taken' } : {},
  })
}

/** Professor: session directory + detail reads. */
function sessionReads(index) {
  const section = sectionAt(index)
  return series('session_reads', [
    { path: '/sessions', token: section.teacherToken },
    { path: '/sessions/page?limit=20&page=1', token: section.teacherToken },
    { path: `/sessions/${encodeURIComponent(section.sessionId)}`, token: section.teacherToken },
  ])
}

/** Professor: dashboard overview + global search. */
function teacherDashboard(index) {
  const section = sectionAt(index)
  return series('teacher_dashboard', [
    { path: '/dashboard/overview', token: section.teacherToken },
    { path: '/search?q=Load', token: section.teacherToken },
  ])
}

/** Professor: attendance report (the analytics page). */
function attendanceReport(index) {
  const section = sectionAt(index)
  return ok(
    'attendance_report',
    request(fixture, 'GET', `/attendance/report?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: section.teacherToken,
      operation: 'attendance_report',
    }),
  )
}

/** Professor: the attendance/excuse/at-risk/attempt list surfaces. */
function attendanceLists(index) {
  const section = sectionAt(index)
  const q = `sectionId=${encodeURIComponent(section.sectionId)}`
  return series('attendance_lists', [
    { path: `/attendance?sessionId=${encodeURIComponent(section.sessionId)}`, token: section.teacherToken },
    { path: `/attendance/page?${q}&limit=20&offset=0`, token: section.teacherToken },
    { path: `/attendance/summaries?${q}`, token: section.teacherToken },
    { path: `/attendance/excuses?${q}`, token: section.teacherToken },
    { path: `/attendance/at-risk?${q}`, token: section.teacherToken },
    { path: `/attendance/attempts?${q}`, token: section.teacherToken },
  ])
}

/** Professor: manual override of a student's status (the cockpit tap-to-cycle). */
function manualAttendance(index) {
  const section = sectionAt(index)
  const list = request(fixture, 'GET', `/attendance?sessionId=${encodeURIComponent(section.sessionId)}`, {
    token: section.teacherToken,
    operation: 'manual_attendance',
  })
  const rows = jsonOf(list)
  const record = Array.isArray(rows) ? rows[index % Math.max(1, rows.length)] : null
  if (!record || !record.id) {
    recordFlow('manual_attendance', shape, list, false, { tags: { reason: 'no_record' } })
    return
  }
  const status = ['present', 'late', 'absent', 'disputed', 'incomplete'][index % 5]
  return ok(
    'manual_attendance',
    request(fixture, 'PATCH', `/attendance/${encodeURIComponent(record.id)}/status`, {
      token: section.teacherToken,
      operation: 'manual_attendance',
      body: { status },
    }),
  )
}

/** Professor: the dispute review queue. */
function disputeRead(index) {
  const section = sectionAt(index)
  return ok(
    'dispute_read',
    request(fixture, 'GET', '/disputes', {
      token: section.teacherToken,
      operation: 'dispute_read',
    }),
  )
}

/** Professor: proof-of-class gallery + file download. */
function proofRead(index) {
  const section = sectionAt(index)
  return ok(
    'proof_read',
    request(fixture, 'GET', `/proofs/${encodeURIComponent(section.sessionId)}`, {
      token: section.teacherToken,
      operation: 'proof_read',
    }),
  )
}

/** Professor: master list export (the registrar document). */
function docsMasterList(index) {
  const section = sectionAt(index)
  return ok(
    'docs_master_list',
    request(fixture, 'GET', `/docs/master-list/${encodeURIComponent(section.sectionId)}?format=docx`, {
      token: section.teacherToken,
      operation: 'docs_master_list',
    }),
  )
}

/** Professor: class record (A4 landscape grading sheet). */
function docsClassRecord(index) {
  const section = sectionAt(index)
  return ok(
    'docs_class_record',
    request(fixture, 'GET', `/docs/class-record/${encodeURIComponent(section.sectionId)}?format=docx`, {
      token: section.teacherToken,
      operation: 'docs_class_record',
    }),
  )
}

/** Professor: per-session attendance export. */
function docsSessionAttendance(index) {
  const section = sectionAt(index)
  return ok(
    'docs_session_attendance',
    request(fixture, 'GET', `/docs/session-attendance/${encodeURIComponent(section.sessionId)}?format=csv`, {
      token: section.teacherToken,
      operation: 'docs_session_attendance',
    }),
  )
}

/** Professor: CSV export from the reports page. */
function exportCsv(index) {
  const section = sectionAt(index)
  return ok(
    'export_csv',
    request(fixture, 'GET', `/reports/export?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: section.teacherToken,
      operation: 'export_csv',
    }),
  )
}

/** Professor: the "students to check on" widget. */
function atRisk(index) {
  const section = sectionAt(index)
  return ok(
    'at_risk',
    request(fixture, 'GET', `/attendance/at-risk?sectionId=${encodeURIComponent(section.sectionId)}&limit=10`, {
      token: section.teacherToken,
      operation: 'at_risk',
    }),
  )
}

/** Professor: section directory, detail and roster. */
function sectionReads(index) {
  const section = sectionAt(index)
  return series('section_reads', [
    { path: '/sections', token: section.teacherToken },
    { path: `/sections/${encodeURIComponent(section.sectionId)}`, token: section.teacherToken },
    { path: `/sections/${encodeURIComponent(section.sectionId)}/enrollments`, token: section.teacherToken },
  ])
}

/** Professor: create a subject, then a section under it (the composer). */
function classCompose(index) {
  const startedAt = Date.now()
  const stamp = `${fixture.runId}-${index}-${Date.now()}`
  const subjectResponse = request(fixture, 'POST', '/subjects', {
    token: sectionAt(index).teacherToken,
    operation: 'class_compose',
    body: {
      name: `Load test subject ${stamp}`,
      code: `LT${String(Date.now()).slice(-8)}${index}`.slice(0, 30),
      description: 'Created by the Polycheck service matrix',
    },
  })
  const subject = jsonOf(subjectResponse)
  if (!isOk(subjectResponse) || !subject || typeof subject.id !== 'string') {
    recordFlow('class_compose', shape, subjectResponse, false, { tags: { phase: 'subject' }, durationMs: Date.now() - startedAt })
    return
  }
  const sectionResponse = request(fixture, 'POST', '/sections', {
    token: sectionAt(index).teacherToken,
    operation: 'class_compose',
    body: {
      subjectId: subject.id,
      section: `LT${index}`,
      course: 'BSIT',
      room: 'SM-101',
      semester: '2026-2027 1st',
      schedule: [{ day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][index % 5], startTime: '09:00', endTime: '10:00' }],
    },
  })
  recordFlow('class_compose', shape, sectionResponse, isOk(sectionResponse), {
    tags: { phase: 'section' },
    durationMs: Date.now() - startedAt,
  })
}

/** Professor: section roles (President/QAC) read path. */
function sectionRoles(index) {
  const section = sectionAt(index)
  const student = studentAt(index)
  const id = meId(student)
  const steps = [{ path: `/section-roles/${encodeURIComponent(section.sectionId)}`, token: section.teacherToken }]
  if (id) steps.push({ path: `/section-roles/student/${encodeURIComponent(id)}`, token: section.teacherToken })
  return series('section_roles', steps)
}

/** Professor: per-session permission grants. */
function sessionPermissions(index) {
  const section = sectionAt(index)
  const student = studentAt(index)
  const id = meId(student)
  const steps = [{ path: `/session-permissions/${encodeURIComponent(section.sectionId)}`, token: section.teacherToken }]
  if (id) {
    steps.push({
      path: `/session-permissions/check/${encodeURIComponent(section.sectionId)}/${encodeURIComponent(id)}`,
      token: section.teacherToken,
    })
  }
  return series('session_permissions', steps)
}

/** Super admin: the user directory pages. */
function usersRead(index) {
  if (!fixture.adminToken) {
    recordFlow('users_read', shape, null, false, { tags: { reason: 'missing_admin_token' } })
    return
  }
  const offset = (index % 20) * 20
  return series('users_read', [
    { path: `/users/students?limit=20&offset=${offset}`, token: fixture.adminToken },
    { path: '/users/teachers?limit=20&offset=0', token: fixture.adminToken },
  ])
}

/** Super admin: audit trail + ledger integrity verification. */
function auditRead(index) {
  if (!fixture.adminToken) {
    recordFlow('audit_read', shape, null, false, { tags: { reason: 'missing_admin_token' } })
    return
  }
  const steps = [{ path: '/audit-logs?page=1&pageSize=20', token: fixture.adminToken }]
  // Ledger verification hashes every AttendanceRecord (~29k rows locally, 1.2s
  // standalone). Running it concurrently with itself turns a maintenance action
  // into a self-inflicted timeout, so it is exercised once per run.
  if (index === 0) steps.push({ method: 'POST', path: '/audit-logs/ledger/verify', token: fixture.adminToken, body: {} })
  return series('audit_read', steps)
}

/** Super admin: institution settings read. */
function settingsRead(index) {
  if (!fixture.adminToken) {
    recordFlow('settings_read', shape, null, false, { tags: { reason: 'missing_admin_token' } })
    return
  }
  return ok(
    'settings_read',
    request(fixture, 'GET', '/settings', { token: fixture.adminToken, operation: 'settings_read' }),
  )
}

/** Public: health probes and maintenance status (polled by every client). */
function health(index) {
  const token = index % 2 === 0 ? undefined : fixture.adminToken
  return series('health', [
    { path: '/health' },
    { path: '/health/ready' },
    { path: '/maintenance/status', token },
  ])
}

/* --------------------------------------------------------------- scenarios */

const FLOWS = {
  auth_session: authSession,
  student_schedule: studentSchedule,
  student_history: studentHistory,
  student_standing: studentStanding,
  notifications,
  subject_browse: subjectBrowse,
  system_reports: systemReports,
  attendance_timeline: attendanceTimeline,
  qr_activate: qrActivate,
  qr_online_checkpoints: qrOnlineCheckpoints,
  session_bulk: sessionBulk,
  session_reads: sessionReads,
  teacher_dashboard: teacherDashboard,
  attendance_report: attendanceReport,
  attendance_lists: attendanceLists,
  manual_attendance: manualAttendance,
  dispute_read: disputeRead,
  proof_read: proofRead,
  docs_master_list: docsMasterList,
  docs_class_record: docsClassRecord,
  docs_session_attendance: docsSessionAttendance,
  export_csv: exportCsv,
  at_risk: atRisk,
  section_reads: sectionReads,
  class_compose: classCompose,
  section_roles: sectionRoles,
  session_permissions: sessionPermissions,
  users_read: usersRead,
  audit_read: auditRead,
  settings_read: settingsRead,
  health,
}

const WRITE_FLOWS = new Set([
  'qr_activate',
  'qr_online_checkpoints',
  'session_bulk',
  'class_compose',
  'manual_attendance',
  'system_reports',
  'notifications',
])

const only = (__ENV.K6_SVC_ONLY || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

const selected = Object.keys(FLOWS).filter((name) => only.length === 0 || only.includes(name))
if (selected.length === 0) {
  throw new Error(`K6_SVC_ONLY matched no flows; known: ${Object.keys(FLOWS).join(', ')}`)
}

const scenarios = {}
for (const name of selected) {
  const iterations = WRITE_FLOWS.has(name) ? WRITE_ITERATIONS : READ_ITERATIONS
  scenarios[name] = fixedScenario(name, shape, {
    vus: Math.min(4, iterations),
    iterations,
    maxDuration: '10m',
  }).options
}

export const options = {
  scenarios,
  thresholds: buildThresholds(profile, shape, selected),
  tags: { harness: 'polycheck', script: 'service-matrix' },
}

export function setup() {
  return measureClockOffset(fixture)
}

export default function run(data) {
  const name = exec.scenario.name
  const flow = FLOWS[name]
  if (!flow) throw new Error(`unknown service flow ${name}`)
  flow(exec.scenario.iterationInTest, data.clockOffsetMs)
}

export function handleSummary(data) {
  return {
    stdout: summarize(data, { label: 'service-matrix', profile, shape, fixture }),
  }
}
