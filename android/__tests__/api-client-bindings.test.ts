/**
 * Behavioral tests for the ApiClient bindings and error/offline branches in
 * services/api-client.ts that the sync-engine suite (api-client.test.ts) does
 * not reach: the REST bindings, response error parsing, login error typing,
 * session restore/rotation, QR generation (online + offline), hybrid online
 * scan branches, sync-drain edge cases, exports/search, assistant downloads
 * and screenshot streaming.
 *
 * Harness mirrors api-client.test.ts: URL-suffix -> handler routing over a
 * mocked global fetch, with the offline store, crypto, signing key and device
 * id modules mocked. QR tokens are hand-crafted as
 * `${base64url(JSON payload)}.fake-signature` because the shared mock only
 * decodes the unsigned payload segment.
 */

import * as SecureStore from 'expo-secure-store'
import type {
  AttendanceRecord,
  Section,
  Session,
  Subject,
  User,
} from '@polycheck/shared'
import {
  api,
  ApiRequestError,
  isOwnLoginInFlight,
  subscribeToAuthChanges,
} from '../services/api-client'
import * as offlineStore from '../services/offline-store'
import { clearMaintenance, getMaintenanceSnapshot } from '../lib/maintenance'

jest.mock('../services/api-config', () => ({ API_BASE: 'http://test/api' }))
jest.mock('../services/offline-store', () => ({
  initializeOfflineStore: jest.fn().mockResolvedValue(undefined),
  cacheAttendanceRecords: jest.fn().mockResolvedValue(undefined),
  cacheSections: jest.fn().mockResolvedValue(undefined),
  cacheSessions: jest.fn().mockResolvedValue(undefined),
  cacheSubjects: jest.fn().mockResolvedValue(undefined),
  drainOfflineQueue: jest.fn().mockResolvedValue(undefined),
  enqueueOfflineOperation: jest.fn().mockResolvedValue(undefined),
  getCachedAttendanceRecords: jest.fn().mockResolvedValue([]),
  getCachedSection: jest.fn().mockResolvedValue(null),
  getCachedSections: jest.fn().mockResolvedValue([]),
  getCachedSession: jest.fn().mockResolvedValue(null),
  getCachedSessions: jest.fn().mockResolvedValue([]),
  getCachedSubject: jest.fn().mockResolvedValue(null),
  getCachedSubjects: jest.fn().mockResolvedValue([]),
  getPendingSyncCount: jest.fn().mockResolvedValue(0),
  getServerClockOffset: jest.fn().mockResolvedValue(null),
  removeCachedAttendanceAttempt: jest.fn().mockResolvedValue(undefined),
  replaceCachedAttendanceForStudent: jest.fn().mockResolvedValue(undefined),
  replaceCachedSections: jest.fn().mockResolvedValue(undefined),
  replaceCachedSubjects: jest.fn().mockResolvedValue(undefined),
  setOfflineOwner: jest.fn().mockResolvedValue(undefined),
  setServerClockOffset: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../services/offline-crypto', () => ({
  encryptOfflineValue: jest.fn(async (value: unknown) => JSON.stringify(value)),
  decryptOfflineValue: jest.fn(async (value: string) => JSON.parse(value)),
}))
jest.mock('../services/signing-key', () => ({
  getOrCreateTeacherSigningKey: jest.fn().mockResolvedValue({
    publicKey: 'mocked-public-key',
    secretKey: 'mocked-secret-key',
  }),
}))
jest.mock('../services/device-id', () => ({
  getOrCreateInstallationId: jest.fn().mockResolvedValue('mobile-test-installation'),
}))
// Factory mock (not the bare automock) so the in-memory store actually round
//-trips values: restoreSession/changePassword/401 paths read and write it.
const mockSecureStoreState: Record<string, string> = {}
let mockSecureStoreBroken = false
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => {
    if (mockSecureStoreBroken) throw new Error('secure store unavailable')
    return mockSecureStoreState[key] ?? null
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (mockSecureStoreBroken) throw new Error('secure store unavailable')
    mockSecureStoreState[key] = value
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    if (mockSecureStoreBroken) throw new Error('secure store unavailable')
    delete mockSecureStoreState[key]
  }),
}))
jest.mock('react-native')

const resetSecureStore = (): void => {
  for (const key of Object.keys(mockSecureStoreState)) delete mockSecureStoreState[key]
}

// downloadAssistantFile lazily requires these modules; virtual mocks let the
// tests drive every branch (happy path, download failure, share unavailable).
const mockFileSystem = {
  cacheDirectory: '/cache/' as string | null,
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}
jest.mock('expo-file-system/legacy', () => mockFileSystem, { virtual: true })

const mockSharing = {
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}
jest.mock('expo-sharing', () => mockSharing, { virtual: true })

const storeMock = offlineStore as unknown as {
  initializeOfflineStore: jest.Mock
  cacheAttendanceRecords: jest.Mock
  cacheSections: jest.Mock
  cacheSessions: jest.Mock
  cacheSubjects: jest.Mock
  drainOfflineQueue: jest.Mock
  enqueueOfflineOperation: jest.Mock
  getCachedAttendanceRecords: jest.Mock
  getCachedSection: jest.Mock
  getCachedSections: jest.Mock
  getCachedSession: jest.Mock
  getCachedSessions: jest.Mock
  getCachedSubject: jest.Mock
  getCachedSubjects: jest.Mock
  getPendingSyncCount: jest.Mock
  getServerClockOffset: jest.Mock
  removeCachedAttendanceAttempt: jest.Mock
  replaceCachedAttendanceForStudent: jest.Mock
  replaceCachedSections: jest.Mock
  replaceCachedSubjects: jest.Mock
  setOfflineOwner: jest.Mock
  setServerClockOffset: jest.Mock
}

const secureStore = SecureStore as unknown as {
  getItemAsync: (key: string) => Promise<string | null>
  setItemAsync: (key: string, value: string) => Promise<void>
}

const API_BASE = 'http://test/api'

// ── fixtures ──

const studentUser: User = {
  id: 'student-1',
  studentId: 'STU-001',
  fullName: 'Student One',
  role: 'student',
  program: 'BSCS',
  yearLevel: 2,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const teacherUser: User = {
  id: 'teacher-1',
  fullName: 'Prof Test',
  email: 'teacher@polycheck.dev',
  role: 'teacher',
  department: 'CS',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const serverRecord: AttendanceRecord = {
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  studentName: 'Student One',
  timestamp: '2026-08-02T10:00:00.000Z',
  status: 'present',
  coordinates: { latitude: 14.5995, longitude: 120.9842 },
  deviceId: 'dev-1',
  isSynced: true,
}

const cachedSession: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Data Structures',
  mode: 'in_person',
  date: '2026-08-02',
  startTime: '09:30',
  endTime: '12:00',
  geofence: { latitude: 14.5995, longitude: 120.9842, radiusMeters: 200 },
  isActive: true,
  isRescheduled: false,
  qrValidityMinutes: 10,
  gracePeriodMinutes: 5,
  teacherPublicKey: 'teacher-public-key',
  teacherId: 'teacher-1',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const subject: Subject = {
  id: 'subj-1',
  name: 'Data Structures',
  code: 'DCIT 21',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const makeSection = (id: string, section: string, room: string, semester: string, subjectId: string): Section => ({
  id,
  subjectId,
  section,
  room,
  schedule: [],
  semester,
  teacherId: 'teacher-1',
  teacherName: 'Prof Test',
  studentCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

// ── QR tokens ──

const makeToken = (payload: unknown): string =>
  `${Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}.fake-signature`

const issuedAt = Date.UTC(2026, 7, 2, 9, 59, 30)
const tokenPayload = {
  version: 1 as const,
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  teacherName: 'Prof Test',
  issuedAt,
  validityMinutes: 10,
  gracePeriodMinutes: 5,
}
const qrToken = makeToken(tokenPayload)

// Online checkpoint token issued shortly before the test run so the offline
// window checks (issuedAt - 30s .. graceEnd) accept "now" as the scan time.
const onlineIssuedAt = Date.now() - 10_000
const onlineStartPayload = {
  version: 1 as const,
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  teacherName: 'Prof Test',
  issuedAt: onlineIssuedAt,
  validityMinutes: 2,
  gracePeriodMinutes: 5,
  mode: 'online' as const,
  checkpoint: 'start' as const,
  pinRequired: false,
  validitySeconds: 120,
}
const onlineSession: Session = { ...cachedSession, mode: 'online', geofence: undefined }

// ── fetch harness ──

type Handler = (init?: RequestInit) => Response | Promise<Response>
const handlers = new Map<string, Handler>()
// Prefix routes for endpoints whose query string embeds dynamic campus dates.
const prefixHandlers = new Map<string, Handler>()

const jsonResponse = (data: unknown, status = 200, statusText?: string) => {
  const body = JSON.stringify(data)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusText ?? (status >= 400 ? 'Error' : 'OK'),
    text: jest.fn().mockResolvedValue(body),
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response
}

// A response whose body is not JSON (handleResponse falls back to
// `{ message: text }`; throwLoginError falls back to the default message).
const rawResponse = (status: number, body: string, statusText = 'Error') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  text: jest.fn().mockResolvedValue(body),
  json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
}) as unknown as Response

// A response with an empty body (handleResponse resolves `{}`).
const emptyResponse = (status = 200, statusText = 'OK') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  text: jest.fn().mockResolvedValue(''),
  json: jest.fn().mockRejectedValue(new Error('no body')),
}) as unknown as Response

const binaryResponse = (bytes: number[], contentType: string, status = 200) => {
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: jest.fn().mockResolvedValue(buffer),
    text: jest.fn().mockResolvedValue(''),
    json: jest.fn(),
  } as unknown as Response
}

const fetchMock = jest.fn(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.url
  for (const [suffix, handler] of handlers) {
    if (url.endsWith(suffix)) return handler(init)
  }
  for (const [prefix, handler] of prefixHandlers) {
    if (url.startsWith(`${API_BASE}${prefix}`)) return handler(init)
  }
  throw new TypeError('Network request failed')
})

const originalFetch = globalThis.fetch

beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true })
})

afterAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true })
})

beforeEach(() => {
  handlers.clear()
  prefixHandlers.clear()
  jest.clearAllMocks()
  storeMock.getCachedSession.mockResolvedValue(null)
  storeMock.getCachedSessions.mockResolvedValue([])
  storeMock.getCachedSections.mockResolvedValue([])
  storeMock.getCachedSection.mockResolvedValue(null)
  storeMock.getCachedSubjects.mockResolvedValue([])
  storeMock.getCachedSubject.mockResolvedValue(null)
  storeMock.getCachedAttendanceRecords.mockResolvedValue([])
  storeMock.getServerClockOffset.mockResolvedValue(5000)
  storeMock.drainOfflineQueue.mockResolvedValue(undefined)
  clearMaintenance()
})

async function loginAsStudent(): Promise<void> {
  handlers.set('/auth/mobile/login/student', () => jsonResponse({ user: studentUser, token: 'test-token' }))
  await api.loginStudent('STU-001')
}

async function loginAsTeacher(): Promise<void> {
  handlers.set('/auth/mobile/login/faculty', () => jsonResponse({ user: teacherUser, token: 'test-token' }))
  handlers.set('/auth/provision-key', () => jsonResponse({}))
  await api.loginFaculty('teacher@polycheck.dev')
}

/**
 * Logs in as a teacher with a distinct account id. The api client remembers
 * provisioned signing keys per teacher for the whole app session, so a fresh
 * id is the only way to reach the first-time provisioning branches more than
 * once per test file.
 */
async function loginAsTeacherId(id: string): Promise<void> {
  const teacher: User = { ...teacherUser, id, email: `${id}@polycheck.dev` }
  handlers.set('/auth/mobile/login/faculty', () => jsonResponse({ user: teacher, token: 'test-token' }))
  handlers.set('/auth/provision-key', () => jsonResponse({}))
  await api.loginFaculty(teacher.email ?? `${id}@polycheck.dev`)
}

/** Asserts a binding issues the expected method/URL and resolves the payload. */
async function expectRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  payload: unknown,
  invoke: () => Promise<unknown>,
  extra?: { body?: unknown; headers?: Record<string, string> },
): Promise<void> {
  handlers.set(path, () => jsonResponse(payload))
  await expect(invoke()).resolves.toEqual(payload)
  // Tests may invoke the same endpoint twice with different bodies — the
  // assertion always targets the call this invocation produced (the last one).
  const matching = fetchMock.mock.calls.filter(([input]) => String(input) === `${API_BASE}${path}`)
  expect(matching.length).toBeGreaterThan(0)
  const init = (matching[matching.length - 1]?.[1] ?? {}) as Record<string, unknown>
  // get() sends no method property; any non-GET verb is asserted explicitly.
  if (method === 'GET') expect(init.method).toBeUndefined()
  else expect(init.method).toBe(method)
  if (extra?.body !== undefined) expect(init.body).toBe(JSON.stringify(extra.body))
  if (extra?.headers) {
    for (const [key, value] of Object.entries(extra.headers)) {
      expect((init.headers as Record<string, unknown>)?.[key]).toBe(value)
    }
  }
}

const calledUrl = (prefix: string): string | undefined => {
  const call = fetchMock.mock.calls.find(([input]) => String(input).startsWith(`${API_BASE}${prefix}`))
  return call ? String(call[0]) : undefined
}

// ── read bindings ──

describe('read bindings', () => {
  beforeEach(async () => {
    await loginAsStudent()
  })

  it('fetches the privacy notice', async () => {
    await expectRequest('GET', '/auth/privacy-notice', { version: '2', url: 'https://x', summary: 's' }, () =>
      api.getPrivacyNotice(),
    )
  })

  it('lists scan attempts for a session', async () => {
    await expectRequest('GET', '/attendance/attempts?sessionId=sess-1', [], () => api.getScanAttempts('sess-1'))
  })

  it('lists all scan attempts without a session filter', async () => {
    await expectRequest('GET', '/attendance/attempts', [], () => api.getScanAttempts())
  })

  it('fetches a record timeline with an encoded record id', async () => {
    const timeline = { recordId: 'rec/1', events: [], recommendation: { verdict: 'review', rationale: 'r' } }
    await expectRequest('GET', '/attendance/records/rec%2F1/timeline', timeline, () => api.getRecordTimeline('rec/1'))
  })

  it('verifies the attendance ledger without a request body', async () => {
    const result = { verified: true, recordsChecked: 3, sessionsChecked: 1 }
    handlers.set('/audit-logs/ledger/verify', () => jsonResponse(result))
    await expect(api.verifyLedger()).resolves.toEqual(result)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/audit-logs/ledger/verify`,
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
  })

  it('lists at-risk students with filters', async () => {
    await expectRequest('GET', '/attendance/at-risk?sectionId=sec-1&limit=5', [], () =>
      api.getAtRiskStudents({ sectionId: 'sec-1', limit: 5 }),
    )
  })

  it('lists at-risk referrals with filters', async () => {
    await expectRequest('GET', '/attendance/at-risk/referrals?status=generated&sectionId=sec-1', [], () =>
      api.getAtRiskReferrals({ status: 'generated', sectionId: 'sec-1' }),
    )
  })

  it('fetches the privacy center snapshot', async () => {
    const snapshot = {
      retentionDays: 30,
      consent: { covered: 1, totalActive: 2, version: '2' },
      ephemeral: { lastRunAt: null, recordsShredded: null, attemptsShredded: null },
      dataInventory: [],
      breaches: [],
    }
    await expectRequest('GET', '/settings/privacy-center', snapshot, () => api.getPrivacyCenter())
  })

  it('fetches the student standing evaluation', async () => {
    await expectRequest('GET', '/me/standing', [], () => api.getMyStanding())
  })

  it('fetches AI capabilities and threads', async () => {
    await expectRequest('GET', '/ai/capabilities', { available: true }, () => api.getAiCapabilities())
    await expectRequest('GET', '/ai/threads', [], () => api.listAiThreads())
  })

  it('fetches a single AI thread with an encoded id', async () => {
    const thread = { id: 'thread/1', messages: [] }
    await expectRequest('GET', '/ai/threads/thread%2F1', thread, () => api.getAiThread('thread/1'))
  })

  it('resolves an empty body to an empty object', async () => {
    handlers.set('/notifications/unread-count', () => emptyResponse())
    await expect(api.getUnreadNotificationCount()).resolves.toEqual({})
  })

  it('serializes notification filters', async () => {
    await expectRequest('GET', '/notifications?unreadOnly=true&limit=5', [], () =>
      api.getNotifications({ unreadOnly: true, limit: 5 }),
    )
  })

  it('keeps the bare notifications path without filters', async () => {
    await expectRequest('GET', '/notifications', [], () => api.getNotifications())
  })

  it('lists students and teachers', async () => {
    await expectRequest('GET', '/users/students', [studentUser], () => api.getStudents())
    await expectRequest('GET', '/users/teachers', [teacherUser], () => api.getTeachers())
  })

  it('fetches a single user by id', async () => {
    await expectRequest('GET', '/users/user-9', teacherUser, () => api.getStudent('user-9'))
  })

  it('fetches system report stats and the own-reports list', async () => {
    await expectRequest('GET', '/reports/stats', { total: 0 }, () => api.getSystemReportStats())
    await expectRequest('GET', '/reports/my', [], () => api.getMySystemReports())
  })

  it('fetches a single system report', async () => {
    await expectRequest('GET', '/reports/rep-1', { id: 'rep-1' }, () => api.getSystemReport('rep-1'))
  })

  it('serializes system report filters and skips empty values', async () => {
    await expectRequest('GET', '/reports?category=scanner_camera&limit=10', { data: [] }, () =>
      api.getSystemReports({ category: 'scanner_camera', limit: 10 }),
    )
  })

  it('keeps the bare reports path without filters', async () => {
    await expectRequest('GET', '/reports', { data: [] }, () => api.getSystemReports())
  })

  it('serializes audit log filters', async () => {
    await expectRequest('GET', '/audit-logs?page=2&pageSize=10', { data: [] }, () =>
      api.getAuditLogs({ page: 2, pageSize: 10 }),
    )
  })

  it('fetches institution settings', async () => {
    await expectRequest('GET', '/settings', [], () => api.getSettings())
  })

  it('lists section roles and session permissions', async () => {
    await expectRequest('GET', '/section-roles/sec-1', [], () => api.getSectionRoles('sec-1'))
    await expectRequest('GET', '/session-permissions/sec-1', [], () => api.getActiveSessionPermissions('sec-1'))
  })

  it('checks a session permission', async () => {
    await expectRequest('GET', '/session-permissions/check/sec-1/student-1', true, () =>
      api.checkSessionPermission('sec-1', 'student-1'),
    )
  })

  it('lists proofs of class for a session', async () => {
    await expectRequest('GET', '/proofs/sess-1', [], () => api.getProofsOfClass('sess-1'))
  })

  it('fetches calendar events for a date range', async () => {
    await expectRequest('GET', '/calendar/events?startDate=2026-01-01&endDate=2026-01-31', [], () =>
      api.getCalendarEvents('student-1', '2026-01-01', '2026-01-31'),
    )
  })

  it('lists my subjects from the subjects endpoint', async () => {
    await expectRequest('GET', '/subjects', [subject], () => api.getMySubjects('student-1'))
  })

  it('fetches attendance for a student and for a student-section pair', async () => {
    await expectRequest('GET', '/attendance/student/student-1', [serverRecord], () =>
      api.getAttendanceForStudent('student-1'),
    )
    await expectRequest('GET', '/attendance/student/student-1?sectionId=sec-1', [serverRecord], () =>
      api.getStudentAttendanceForSection('student-1', 'sec-1'),
    )
  })

  it('scopes attendance records by session', async () => {
    await expectRequest('GET', '/attendance?sessionId=sess-1&limit=1000', [serverRecord], () =>
      api.getAttendanceRecords('sess-1'),
    )
  })

  it('scopes attendance records by an explicit date range', async () => {
    await expectRequest('GET', '/attendance?startDate=2026-01-01&endDate=2026-01-31&limit=1000', [], () =>
      api.getAttendanceRecords(undefined, '2026-01-01', '2026-01-31'),
    )
  })

  it('falls back to the recent campus date range', async () => {
    prefixHandlers.set('/attendance?', () => jsonResponse([]))
    await api.getAttendanceRecords()
    expect(calledUrl('/attendance?')).toMatch(
      /^http:\/\/test\/api\/attendance\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}&limit=1000$/,
    )
  })

  it('scopes attendance summaries by teacher after the campus date range', async () => {
    prefixHandlers.set('/attendance/summaries?', () => jsonResponse([]))
    await api.getAttendanceSummaries('teacher-1')
    expect(calledUrl('/attendance/summaries?')).toMatch(
      /^http:\/\/test\/api\/attendance\/summaries\?startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}&teacherId=teacher-1$/,
    )
  })

  it('scopes the attendance report by section after the campus date range', async () => {
    prefixHandlers.set('/attendance/report?', () => jsonResponse({ totals: {} }))
    await api.getAttendanceReport({ sectionId: 'sec-1' })
    expect(calledUrl('/attendance/report?')).toMatch(/&sectionId=sec-1$/)
  })

  it('fetches the dashboard overview with and without filters', async () => {
    await expectRequest('GET', '/dashboard/overview', { totals: {} }, () => api.getDashboardOverview())
    await expectRequest(
      'GET',
      '/dashboard/overview?startDate=2026-01-01&endDate=2026-01-31',
      { totals: {} },
      () => api.getDashboardOverview({ startDate: '2026-01-01', endDate: '2026-01-31' }),
    )
  })

  it('lists enrollments for a section and globally', async () => {
    await expectRequest('GET', '/sections/sec-1/enrollments', [], () => api.getEnrollments('sec-1'))
    await expectRequest('GET', '/enrollments', [], () => api.getEnrollments())
  })

  it('fetches an import job with an encoded id', async () => {
    await expectRequest('GET', '/users/students/import/jobs/job%2F1', { state: 'done' }, () =>
      api.getStudentImportJob('job/1'),
    )
  })

  it('lists disputed records without filters', async () => {
    await expectRequest('GET', '/disputes', [serverRecord], () => api.getDisputedRecords())
  })

  it('serializes dispute filters and omits the "all" status', async () => {
    await expectRequest('GET', '/disputes?sessionId=sess-1&status=pending&search=john', [serverRecord], () =>
      api.getDisputedRecords('sess-1', { status: 'pending', search: 'john' }),
    )
    await expectRequest('GET', '/disputes?sessionId=sess-1&search=john', [serverRecord], () =>
      api.getDisputedRecords('sess-1', { status: 'all', search: 'john' }),
    )
  })

  it('lists excuses with filters', async () => {
    await expectRequest('GET', '/attendance/excuses?status=requested&sectionId=sec-1', [], () =>
      api.listExcuses({ status: 'requested', sectionId: 'sec-1' }),
    )
  })
})

// ── write bindings ──

describe('write bindings', () => {
  beforeEach(async () => {
    await loginAsStudent()
  })

  it('accepts privacy consent and adopts the returned profile', async () => {
    const updated = { ...studentUser, privacyConsentVersion: '2' }
    handlers.set('/auth/privacy-consent', () => jsonResponse(updated))
    await expect(api.acceptPrivacyConsent('2')).resolves.toEqual(updated)
    expect(api.getCurrentUser()).toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/privacy-consent`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: '2' }) }),
    )
  })

  it('creates subjects and sections', async () => {
    await expectRequest('POST', '/subjects', subject, () =>
      api.createSubject({ name: 'Data Structures', code: 'DCIT 21' }),
    )
    await expectRequest('POST', '/sections', { id: 'sec-1' }, () =>
      api.createSection({ subjectId: 'subj-1', section: 'A-1', room: 'L201', schedule: [], semester: '1S' }),
    )
  })

  it('creates a session without leaking teacherId into the body', async () => {
    const input = {
      sectionId: 'sec-1',
      subjectName: 'Data Structures',
      date: '2026-08-02',
      startTime: '09:30',
      endTime: '12:00',
      teacherId: 'teacher-1',
    }
    await expectRequest('POST', '/sessions', { id: 'sess-1' }, () => api.createSession(input), {
      body: { sectionId: 'sec-1', subjectName: 'Data Structures', date: '2026-08-02', startTime: '09:30', endTime: '12:00' },
    })
  })

  it('creates bulk sessions without leaking teacherId into the body', async () => {
    const input = {
      sectionId: 'sec-1',
      subjectName: 'Data Structures',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      daysOfWeek: ['Mon', 'Wed'],
      startTime: '09:30',
      endTime: '12:00',
      teacherId: 'teacher-1',
    }
    await expectRequest('POST', '/sessions/bulk', [], () => api.createBulkSessions(input), {
      body: {
        sectionId: 'sec-1',
        subjectName: 'Data Structures',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        daysOfWeek: ['Mon', 'Wed'],
        startTime: '09:30',
        endTime: '12:00',
      },
    })
  })

  it('enrolls by code', async () => {
    await expectRequest('POST', '/sections/enroll-by-code', { id: 'e-1' }, () => api.enrollByCode('ABC123'), {
      body: { enrollmentCode: 'ABC123' },
    })
  })

  it('disables the enrollment code', async () => {
    // Empty JSON bodies resolve to `{}` (handleResponse normalizes null data).
    await expectRequest('POST', '/sections/sec-1/enrollment-code/disable', {}, () =>
      api.disableEnrollmentCode('sec-1'),
    )
  })

  it('removes a student from a section', async () => {
    await expectRequest('DELETE', '/sections/sec-1/students/student-1', true, () =>
      api.removeStudentFromSection('sec-1', 'student-1'),
    )
  })

  it('resolves a dispute with the resolution payload', async () => {
    await expectRequest('POST', '/disputes/rec-1/resolve', serverRecord, () =>
      api.resolveDispute('rec-1', 'override', 'late'),
      { body: { resolution: 'override', newStatus: 'late' } },
    )
  })

  it('submits a dispute', async () => {
    await expectRequest('POST', '/disputes', serverRecord, () =>
      api.submitDispute({ recordId: 'rec-1', reason: 'outside_geofence', description: 'I was inside' }),
      { body: { recordId: 'rec-1', reason: 'outside_geofence', description: 'I was inside' } },
    )
  })

  it('requests an excuse with an encoded record id', async () => {
    await expectRequest('POST', '/attendance/records/rec%2F1/excuse', serverRecord, () =>
      api.requestExcuse('rec/1', { reason: 'medical', description: 'Doctor visit' }),
      { body: { reason: 'medical', description: 'Doctor visit' } },
    )
  })

  it('decides an excuse with the decision payload', async () => {
    await expectRequest('POST', '/attendance/records/rec-1/excuse/decision', serverRecord, () =>
      api.decideExcuse('rec-1', 'approve', 'Get well'),
      { body: { decision: 'approve', note: 'Get well' } },
    )
  })

  it('generates an at-risk referral', async () => {
    const referral = { id: 'ref-1', status: 'generated' }
    await expectRequest('POST', '/attendance/at-risk/referrals', referral, () =>
      api.generateAtRiskReferral({ studentId: 'student-1', sectionId: 'sec-1', note: 'Please check on them' }),
      { body: { studentId: 'student-1', sectionId: 'sec-1', note: 'Please check on them' } },
    )
  })

  it('updates an at-risk referral with an encoded id', async () => {
    const referral = { id: 'ref/1', status: 'acknowledged' }
    await expectRequest('PATCH', '/attendance/at-risk/referrals/ref%2F1', referral, () =>
      api.updateAtRiskReferral('ref/1', { status: 'acknowledged', note: 'Counseling Friday' }),
      { body: { status: 'acknowledged', note: 'Counseling Friday' } },
    )
  })

  it('marks notifications read with the default and explicit payloads', async () => {
    await expectRequest('POST', '/notifications/read', 2, () => api.markNotificationsRead(), {
      body: { all: true },
    })
    await expectRequest('POST', '/notifications/read', 1, () => api.markNotificationsRead({ ids: ['n-1'] }), {
      body: { ids: ['n-1'] },
    })
  })

  it('registers a push token', async () => {
    await expectRequest('POST', '/notifications/push-token', true, () =>
      api.registerPushToken({ token: 'expo-token', platform: 'expo' }),
      { body: { token: 'expo-token', platform: 'expo' } },
    )
  })

  it('creates teachers and students', async () => {
    await expectRequest('POST', '/users/teachers', { user: teacherUser }, () =>
      api.createTeacher({ fullName: 'Prof Test', email: 'teacher@polycheck.dev', department: 'CS' }),
    )
    await expectRequest('POST', '/users/students', { user: studentUser }, () =>
      api.createStudent({
        fullName: 'Student One',
        studentId: 'STU-001',
        program: 'BSCS',
        yearLevel: 2,
        department: 'CS',
      }),
    )
  })

  it('resets a password with and without an explicit password', async () => {
    await expectRequest('PATCH', '/users/user-9/password', { temporaryPassword: 'x' }, () =>
      api.resetUserPassword('user-9'),
      { body: {} },
    )
    await expectRequest('PATCH', '/users/user-9/password', { temporaryPassword: 'x' }, () =>
      api.resetUserPassword('user-9', 'new-secret'),
      { body: { password: 'new-secret' } },
    )
  })

  it('toggles account status', async () => {
    await expectRequest('PATCH', '/users/user-9/status', teacherUser, () => api.setUserStatus('user-9', false), {
      body: { isActive: false },
    })
  })

  it('posts the delegated student password reset', async () => {
    await expectRequest('POST', '/users/students/student-1/teacher-reset-password', { temporaryPassword: 'x' }, () =>
      api.teacherResetStudentPassword('student-1', 'sec-1'),
      { body: { sectionId: 'sec-1' } },
    )
  })

  it('posts the emergency device release', async () => {
    await expectRequest('POST', '/users/students/student-1/device-release', { user: studentUser }, () =>
      api.emergencyReleaseDevice('student-1', { sectionId: 'sec-1', reason: 'lost_or_damaged' }),
      { body: { sectionId: 'sec-1', reason: 'lost_or_damaged' } },
    )
  })

  it('unregisters the current device', async () => {
    await expectRequest('POST', '/users/me/device/unregister', { user: studentUser }, () =>
      api.unregisterDevice('mobile-test-installation'),
      { body: { deviceId: 'mobile-test-installation' } },
    )
  })

  it('updates contacts and refreshes the cached profile', async () => {
    handlers.set('/users/me/contacts', () => jsonResponse({ contactEmail: 'new@pup.edu.ph' }))
    await expect(api.updateContacts({ contactEmail: 'new@pup.edu.ph' })).resolves.toEqual({
      contactEmail: 'new@pup.edu.ph',
    })
    expect(api.getCurrentUser()).toMatchObject({ id: 'student-1', contactEmail: 'new@pup.edu.ph' })
    const stored = JSON.parse((await secureStore.getItemAsync('polycheck-user')) ?? '{}')
    expect(stored.contactEmail).toBe('new@pup.edu.ph')
  })

  it('creates a system report', async () => {
    const report = { id: 'rep-1', status: 'open' }
    await expectRequest('POST', '/reports', report, () =>
      api.createSystemReport({
        category: 'scanner_camera',
        severity: 'high',
        title: 'Camera fails',
        description: 'The scanner shows a black frame',
      }),
      { body: { category: 'scanner_camera', severity: 'high', title: 'Camera fails', description: 'The scanner shows a black frame' } },
    )
  })

  it('updates a system report status', async () => {
    await expectRequest('PATCH', '/reports/rep-1/status', { id: 'rep-1', status: 'resolved' }, () =>
      api.updateSystemReportStatus('rep-1', { status: 'resolved', adminNotes: 'Fixed' }),
      { body: { status: 'resolved', adminNotes: 'Fixed' } },
    )
  })

  it('imports students with the idempotency key header', async () => {
    const request = {
      mode: 'execute' as const,
      conflictMode: 'update_existing' as const,
      rows: [{ rowNumber: 1, studentId: 'STU-001', fullName: 'Student One' }],
      idempotencyKey: 'idem-1',
      rowChecksum: 'abc',
    }
    await expectRequest('POST', '/users/students/import', { created: 1 }, () => api.importStudents(request), {
      body: request,
      headers: { 'Idempotency-Key': 'idem-1' },
    })
  })

  it('imports section enrollments with the idempotency key header', async () => {
    const request = {
      mode: 'execute' as const,
      rows: [{ rowNumber: 1, studentId: 'STU-001' }],
      idempotencyKey: 'idem-2',
      rowChecksum: 'def',
    }
    await expectRequest('POST', '/sections/sec-1/enrollments/import', { created: 1 }, () =>
      api.importSectionEnrollments('sec-1', request),
      { body: request, headers: { 'Idempotency-Key': 'idem-2' } },
    )
  })

  it('previews enrollment imports in validate mode', async () => {
    const rows = [{ rowNumber: 1, studentId: 'STU-001' }]
    await expectRequest('POST', '/sections/sec-1/enrollments/import', { valid: 1 }, () =>
      api.previewEnrollImport('sec-1', rows),
      { body: { mode: 'validate', rows } },
    )
  })

  it('saves a setting with the PUT verb and encoded key', async () => {
    await expectRequest('PUT', '/settings/maintenance_mode_enabled', { key: 'maintenance_mode_enabled' }, () =>
      api.setSetting('maintenance_mode_enabled', 'true'),
      { body: { value: 'true' } },
    )
  })

  it('assigns and removes section roles', async () => {
    await expectRequest('POST', '/section-roles', { id: 'role-1' }, () =>
      api.assignSectionRole('sec-1', 'student-1', 'president'),
      { body: { sectionId: 'sec-1', studentId: 'student-1', role: 'president' } },
    )
    await expectRequest('DELETE', '/section-roles/sec-1/student-1/president', true, () =>
      api.removeSectionRole('sec-1', 'student-1', 'president'),
    )
  })

  it('grants and revokes session permissions', async () => {
    await expectRequest('POST', '/session-permissions', { id: 'perm-1' }, () =>
      api.grantSessionPermission('sec-1', 'student-1'),
      { body: { sectionId: 'sec-1', studentId: 'student-1' } },
    )
    await expectRequest('DELETE', '/session-permissions/sec-1/student-1', true, () =>
      api.revokeSessionPermission('sec-1', 'student-1'),
    )
  })

  it('uploads proof of class without leaking uploader identity fields', async () => {
    const proof = { id: 'proof-1' }
    await expectRequest('POST', '/proofs', proof, () =>
      api.uploadProofOfClass({
        sectionId: 'sec-1',
        sessionId: 'sess-1',
        photoData: 'data:image/jpeg;base64,abc',
        description: 'Whiteboard',
        uploadedBy: 'student-1',
        uploadedByStudentName: 'Student One',
      }),
      {
        body: {
          sectionId: 'sec-1',
          sessionId: 'sess-1',
          photoData: 'data:image/jpeg;base64,abc',
          description: 'Whiteboard',
        },
      },
    )
  })

  it('deletes a proof of class and handles a 204 response', async () => {
    await expectRequest('DELETE', '/proofs/proof-1', true, () => api.deleteProofOfClass('proof-1'))
    handlers.set('/proofs/proof-2', () => jsonResponse(undefined, 204))
    await expect(api.deleteProofOfClass('proof-2')).resolves.toBeUndefined()
  })

  it('sends an AI chat message', async () => {
    await expectRequest('POST', '/ai/chat', { threadId: 't-1' }, () =>
      api.sendAiChatMessage({ message: 'Summarize my attendance' } as never),
      { body: { message: 'Summarize my attendance' } },
    )
  })

  it('deletes an AI thread with an encoded id', async () => {
    await expectRequest('DELETE', '/ai/threads/thread%2F1', true, () => api.deleteAiThread('thread/1'))
  })

  it('adds an attendance record with only the DTO fields', async () => {
    await expectRequest('POST', '/attendance', serverRecord, () => api.addAttendanceRecord(serverRecord), {
      body: { sessionId: 'sess-1', sectionId: 'sec-1', studentId: 'student-1', status: 'present' },
    })
  })

  it('updates an attendance status', async () => {
    await expectRequest('PATCH', '/attendance/rec-1/status', serverRecord, () =>
      api.updateAttendanceStatus('rec-1', 'late'),
      { body: { status: 'late' } },
    )
  })
})

// ── response error parsing ──

describe('response error parsing', () => {
  it('clears the session and notifies listeners on 401', async () => {
    await loginAsStudent()
    const listener = jest.fn()
    const unsubscribe = subscribeToAuthChanges(listener)
    listener.mockClear()
    handlers.set('/users/students', () => jsonResponse({ message: 'Session expired' }, 401))
    await expect(api.getStudents()).rejects.toMatchObject({ status: 401 })
    expect(api.getCurrentUser()).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
    unsubscribe()
  })

  it('flags the cached profile when rotation is enforced mid-session', async () => {
    await loginAsStudent()
    handlers.set('/users/students', () =>
      jsonResponse({ code: 'password_change_required', message: 'Rotate your password' }, 403),
    )
    await expect(api.getStudents()).rejects.toMatchObject({ status: 403, code: 'password_change_required' })
    expect(api.getCurrentUser()?.mustChangePassword).toBe(true)
  })

  it('publishes maintenance state from a 503 with an estimated end', async () => {
    handlers.set('/users/students', () =>
      jsonResponse(
        { code: 'system_maintenance', message: 'Down for backups', estimatedEnd: '2026-08-02T12:00:00.000Z' },
        503,
      ),
    )
    const error = await api.getStudents().catch((e: unknown) => e as ApiRequestError)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 503, code: 'system_maintenance', estimatedEnd: '2026-08-02T12:00:00.000Z' })
    expect(getMaintenanceSnapshot()).toEqual({ message: 'Down for backups', estimatedEnd: '2026-08-02T12:00:00.000Z' })
  })

  it('joins validation error arrays into one message', async () => {
    handlers.set('/users/students', () => jsonResponse({ message: ['Name is required', 'Program is required'] }, 400))
    await expect(api.getStudents()).rejects.toThrow('Name is required. Program is required')
  })

  it('treats a non-JSON error body as the message', async () => {
    handlers.set('/users/students', () => rawResponse(500, 'Gateway down', 'Bad Gateway'))
    await expect(api.getStudents()).rejects.toThrow('Gateway down')
  })

  it('carries geofence override evidence on the error', async () => {
    handlers.set('/disputes/rec-1/resolve', () =>
      jsonResponse(
        {
          message: 'Teacher location is outside the geofence',
          distanceMeters: 250,
          allowedDistanceMeters: 150,
          canRequestOverride: true,
        },
        409,
      ),
    )
    const error = await api.resolveDispute('rec-1', 'accept').catch((e: unknown) => e as ApiRequestError)
    expect(error).toMatchObject({
      status: 409,
      distanceMeters: 250,
      allowedDistanceMeters: 150,
      canRequestOverride: true,
    })
  })

  it('carries the cooldown remaining minutes on the error', async () => {
    handlers.set('/users/students', () =>
      jsonResponse({ code: 'device_cooldown_active', message: 'Cooldown active', remainingMinutes: 42 }, 403),
    )
    await expect(api.getStudents()).rejects.toMatchObject({
      status: 403,
      code: 'device_cooldown_active',
      remainingMinutes: 42,
    })
  })
})

// ── login error typing ──

describe('login error typing', () => {
  it('surfaces the device cooldown code and remaining minutes', async () => {
    handlers.set('/auth/mobile/login/student', () =>
      jsonResponse({ code: 'device_cooldown_active', message: 'Device cooldown active', remainingMinutes: 90 }, 403),
    )
    const error = await api.loginStudent('STU-001').catch((e: unknown) => e as ApiRequestError)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({
      status: 403,
      code: 'device_cooldown_active',
      remainingMinutes: 90,
      message: 'Device cooldown active',
    })
  })

  it('publishes maintenance state from a 503 login with an estimated end', async () => {
    handlers.set('/auth/mobile/login/student', () =>
      jsonResponse(
        { code: 'system_maintenance', message: 'Under maintenance', estimatedEnd: '2026-08-02T12:00:00.000Z' },
        503,
      ),
    )
    await expect(api.loginStudent('STU-001')).rejects.toMatchObject({
      status: 503,
      code: 'system_maintenance',
      estimatedEnd: '2026-08-02T12:00:00.000Z',
    })
    expect(getMaintenanceSnapshot()).toEqual({
      message: 'Under maintenance',
      estimatedEnd: '2026-08-02T12:00:00.000Z',
    })
  })

  it('joins validation arrays on faculty login failures', async () => {
    handlers.set('/auth/mobile/login/faculty', () => jsonResponse({ message: ['Invalid', 'credentials'] }, 400))
    await expect(api.loginFaculty('teacher@polycheck.dev')).rejects.toThrow('Invalid. credentials')
  })

  it('falls back to the default message when the body is not JSON', async () => {
    handlers.set('/auth/mobile/login/student', () => rawResponse(401, 'nope', 'Unauthorized'))
    await expect(api.loginStudent('STU-001')).rejects.toThrow('Login failed')
  })

  it('falls back to the default message for non-string messages', async () => {
    handlers.set('/auth/mobile/login/student', () => jsonResponse({ message: 42 }, 400))
    await expect(api.loginStudent('STU-001')).rejects.toThrow('Login failed')
  })
})

// ── session lifecycle ──

describe('session lifecycle', () => {
  it('delegates login() to the student flow', async () => {
    handlers.set('/auth/mobile/login/student', () => jsonResponse({ user: studentUser, token: 'test-token' }))
    await expect(api.login('STU-001')).resolves.toMatchObject({ id: 'student-1' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/auth/mobile/login/student`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('flags the in-flight window only while a login is pending', async () => {
    let resolveLogin!: (res: Response) => void
    handlers.set('/auth/mobile/login/student', () => new Promise<Response>((resolve) => { resolveLogin = resolve }))
    const pending = api.loginStudent('STU-001')
    // Flush microtasks so the login request is actually on the wire.
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(isOwnLoginInFlight()).toBe(true)
    resolveLogin(jsonResponse({ user: studentUser, token: 'tok' }))
    await pending
    expect(isOwnLoginInFlight()).toBe(false)
  })

  it('notifies subscribers immediately and on auth changes', async () => {
    await api.logout()
    const listener = jest.fn()
    const unsubscribe = subscribeToAuthChanges(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith(null)
    await loginAsStudent()
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'student-1' }))
    unsubscribe()
    const callsBefore = listener.mock.calls.length
    await api.logout()
    expect(listener).toHaveBeenCalledTimes(callsBefore)
  })

  it('applies the cached server clock offset to trusted timestamps', async () => {
    const before = Date.now()
    const stamp = await api.getTrustedTimestamp()
    const parsed = new Date(stamp).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before + 4900)
    expect(parsed).toBeLessThan(before + 5600)
  })

  describe('restoreSession', () => {
    it('returns the verified profile and refreshes the cache', async () => {
      await loginAsStudent()
      const profile = { ...studentUser, fullName: 'Student Verified' }
      handlers.set('/auth/me', () => jsonResponse(profile))
      await expect(api.restoreSession()).resolves.toEqual(profile)
      expect(api.getCurrentUser()).toEqual(profile)
    })

    it('keeps the cached profile when the network is unreachable', async () => {
      await loginAsStudent()
      handlers.clear()
      await expect(api.restoreSession()).resolves.toEqual(studentUser)
      expect(api.getCurrentUser()).toMatchObject({ id: 'student-1' })
    })

    it('keeps a flagged profile when rotation is required', async () => {
      await loginAsStudent()
      handlers.set('/auth/me', () => jsonResponse({ code: 'password_change_required', message: 'Rotate' }, 403))
      await expect(api.restoreSession()).resolves.toMatchObject({ id: 'student-1', mustChangePassword: true })
      expect(api.getCurrentUser()?.mustChangePassword).toBe(true)
    })

    it('clears the session when the token is rejected', async () => {
      await loginAsStudent()
      handlers.set('/auth/me', () => jsonResponse({ message: 'expired' }, 401))
      await expect(api.restoreSession()).resolves.toBeNull()
      expect(api.getCurrentUser()).toBeNull()
    })

    it('returns null when nothing is cached', async () => {
      await api.logout()
      resetSecureStore()
      await expect(api.restoreSession()).resolves.toBeNull()
      expect(storeMock.setOfflineOwner).toHaveBeenCalledWith(null)
    })

    it('returns null when only the profile is cached and the token is gone', async () => {
      await api.logout()
      await secureStore.setItemAsync('polycheck-user', JSON.stringify(studentUser))
      await expect(api.restoreSession()).resolves.toBeNull()
      expect(api.getCurrentUser()).toBeNull()
    })
  })

  describe('changePassword', () => {
    it('adopts a full profile result', async () => {
      await loginAsStudent()
      const updated = { ...studentUser, fullName: 'Student Renamed' }
      handlers.set('/auth/change-password', () => jsonResponse(updated))
      await expect(api.changePassword('old', 'new')).resolves.toEqual(updated)
      expect(api.getCurrentUser()?.fullName).toBe('Student Renamed')
    })

    it('merges a status-only result into the cached profile', async () => {
      await loginAsStudent()
      handlers.set('/auth/change-password', () => jsonResponse({ mustChangePassword: false }))
      await expect(api.changePassword('old', 'new')).resolves.toMatchObject({
        id: 'student-1',
        mustChangePassword: false,
      })
    })

    it('falls back to /auth/me when no profile is cached', async () => {
      await api.logout()
      resetSecureStore()
      handlers.set('/auth/change-password', () => jsonResponse({ mustChangePassword: false }))
      handlers.set('/auth/me', () => jsonResponse(studentUser))
      await expect(api.changePassword(undefined, 'new')).resolves.toEqual(studentUser)
    })

    it('surfaces the server message when rotation is still required', async () => {
      await loginAsStudent()
      handlers.set('/auth/change-password', () =>
        jsonResponse({ code: 'password_change_required', message: 'Current password is wrong' }, 403),
      )
      await expect(api.changePassword('old', 'new')).rejects.toThrow('Current password is wrong')
    })

    it('uses the rotation prompt when the server only says Forbidden', async () => {
      await loginAsStudent()
      handlers.set('/auth/change-password', () =>
        jsonResponse({ code: 'password_change_required', message: 'Forbidden' }, 403),
      )
      await expect(api.changePassword('old', 'new')).rejects.toThrow(
        'You must change your temporary password before continuing.',
      )
    })

    it('rethrows unrelated server errors untouched', async () => {
      await loginAsStudent()
      handlers.set('/auth/change-password', () => jsonResponse({ message: 'Server exploded' }, 500))
      await expect(api.changePassword('old', 'new')).rejects.toMatchObject({ status: 500 })
    })
  })

  it('returns null when the secure store cannot be read', async () => {
    mockSecureStoreBroken = true
    try {
      await expect(api.restoreSession()).resolves.toBeNull()
    } finally {
      mockSecureStoreBroken = false
    }
    expect(storeMock.setOfflineOwner).toHaveBeenCalledWith(null)
  })
})

// ── offline fallbacks ──

describe('offline fallbacks', () => {
  beforeEach(async () => {
    await loginAsStudent()
    handlers.clear() // every fetch now rejects with a TypeError
  })

  it('returns cached subjects when offline', async () => {
    storeMock.getCachedSubjects.mockResolvedValue([subject])
    await expect(api.getSubjects()).resolves.toEqual([subject])
  })

  it('returns a cached subject when offline', async () => {
    storeMock.getCachedSubject.mockResolvedValue(subject)
    await expect(api.getSubject('subj-1')).resolves.toEqual(subject)
  })

  it('fails a cached-subject miss with a sync hint', async () => {
    await expect(api.getSubject('subj-1')).rejects.toThrow(
      'Subject not found locally. Please sync while online first.',
    )
  })

  it('filters cached sections by subject when offline', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    const secB = makeSection('sec-2', 'B-2', 'L301', '2S', 'subj-2')
    storeMock.getCachedSections.mockResolvedValue([secA, secB])
    await expect(api.getSections('subj-1')).resolves.toEqual([secA])
  })

  it('returns all cached sections when offline without a subject filter', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    storeMock.getCachedSections.mockResolvedValue([secA])
    await expect(api.getSections()).resolves.toEqual([secA])
  })

  it('returns a cached section when offline', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    storeMock.getCachedSection.mockResolvedValue(secA)
    await expect(api.getSection('sec-1')).resolves.toEqual(secA)
  })

  it('fails a cached-section miss with a sync hint', async () => {
    await expect(api.getSection('sec-1')).rejects.toThrow(
      'Section not found locally. Please sync while online first.',
    )
  })

  it('returns cached sessions when offline', async () => {
    storeMock.getCachedSessions.mockResolvedValue([cachedSession])
    await expect(api.getSessions('sec-1')).resolves.toEqual([cachedSession])
    expect(storeMock.getCachedSessions).toHaveBeenCalledWith('sec-1')
  })

  it('returns a cached session when offline', async () => {
    storeMock.getCachedSession.mockResolvedValue(cachedSession)
    await expect(api.getSession('sess-1')).resolves.toEqual(cachedSession)
  })

  it('fails a cached-session miss with a sync hint', async () => {
    await expect(api.getSession('sess-1')).rejects.toThrow('Session is not available offline. Sync before class.')
  })

  it('returns cached section sessions when offline', async () => {
    storeMock.getCachedSessions.mockResolvedValue([cachedSession])
    await expect(api.getSectionSessions('sec-1')).resolves.toEqual([cachedSession])
  })

  it('returns empty rosters when the section students request fails offline', async () => {
    await expect(api.getSectionStudents('sec-1')).resolves.toEqual([])
    await expect(api.getStudentsForSection('sec-1')).resolves.toEqual([])
  })

  it('returns cached sections for the student section list when offline', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    storeMock.getCachedSections.mockResolvedValue([secA])
    await expect(api.getStudentSections('student-1')).resolves.toEqual([secA])
  })

  it('rethrows the network error when the offline cache is empty', async () => {
    await expect(api.getSubjects()).rejects.toThrow('Network request failed')
    await expect(api.getSections()).rejects.toThrow('Network request failed')
    await expect(api.getSessions()).rejects.toThrow('Network request failed')
    await expect(api.getSectionSessions('sec-1')).rejects.toThrow('Network request failed')
    await expect(api.getStudentSections('student-1')).rejects.toThrow('Network request failed')
    await expect(api.getMyAttendance('student-1')).rejects.toThrow('Network request failed')
  })

  it('serves a filtered empty result when the cache has rows for other scopes', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    storeMock.getCachedSections.mockResolvedValue([secA])
    await expect(api.getSections('subj-2')).resolves.toEqual([])
  })

  it('refuses to reset the enrollment code while offline', async () => {
    await expect(api.resetEnrollmentCode('sec-1')).rejects.toThrow(
      'Cannot reset enrollment code while offline. Please try again when connected.',
    )
  })

  it('refuses to reset the enrollment code on an empty result', async () => {
    handlers.set('/sections/sec-1/enrollment-code/reset', () => jsonResponse({}))
    await expect(api.resetEnrollmentCode('sec-1')).rejects.toThrow(
      'Cannot reset enrollment code while offline. Please try again when connected.',
    )
  })

  it('returns empty roles when the student roles request fails offline', async () => {
    await expect(api.getStudentRoles('student-1')).resolves.toEqual([])
  })

  it('returns cached attendance when the student list request fails offline', async () => {
    storeMock.getCachedAttendanceRecords.mockResolvedValue([serverRecord])
    await expect(api.getMyAttendance('student-1')).resolves.toEqual([serverRecord])
  })
})

// ── online read-through caching ──

describe('online read-through caching', () => {
  beforeEach(async () => {
    await loginAsStudent()
  })

  it('caches a fetched subject', async () => {
    handlers.set('/subjects/subj-1', () => jsonResponse(subject))
    await expect(api.getSubject('subj-1')).resolves.toEqual(subject)
    expect(storeMock.cacheSubjects).toHaveBeenCalledWith([subject])
  })

  it('caches a fetched section', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    handlers.set('/sections/sec-1', () => jsonResponse(secA))
    await expect(api.getSection('sec-1')).resolves.toEqual(secA)
    expect(storeMock.cacheSections).toHaveBeenCalledWith([secA])
  })

  it('replaces the section cache for the student section list', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    handlers.set('/sections', () => jsonResponse([secA]))
    await expect(api.getStudentSections('student-1')).resolves.toEqual([secA])
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/sections`, expect.anything())
    expect(storeMock.replaceCachedSections).toHaveBeenCalledWith([secA])
  })

  it('caches fetched section sessions', async () => {
    handlers.set('/sessions?sectionId=sec-1', () => jsonResponse([cachedSession]))
    await expect(api.getSectionSessions('sec-1')).resolves.toEqual([cachedSession])
    expect(storeMock.cacheSessions).toHaveBeenCalledWith([cachedSession])
  })

  it('caches fetched sessions scoped by section', async () => {
    handlers.set('/sessions?sectionId=sec-1', () => jsonResponse([cachedSession]))
    await expect(api.getSessions('sec-1')).resolves.toEqual([cachedSession])
    expect(storeMock.cacheSessions).toHaveBeenCalledWith([cachedSession])
  })

  it('caches fetched sections scoped by subject', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    handlers.set('/sections?subjectId=subj-1', () => jsonResponse([secA]))
    await expect(api.getSections('subj-1')).resolves.toEqual([secA])
    expect(storeMock.cacheSections).toHaveBeenCalledWith([secA])
  })
})

// ── QR generation ──

describe('QR generation', () => {
  const teacherSession: Session = {
    ...cachedSession,
    id: 'sess-9',
    teacherId: 'teacher-1',
    teacherPublicKey: 'server-key',
  }
  const onlineSessionBase: Session = {
    ...cachedSession,
    id: 'sess-online',
    mode: 'online',
    geofence: undefined,
    teacherId: 'teacher-1',
    teacherPublicKey: 'server-key',
  }

  const provisionCalls = () =>
    fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/provision-key')).length

  it('rejects validity outside 1-15 minutes and grace above 60', async () => {
    await expect(api.generateQrCode('sess-9', 0)).rejects.toThrow(
      'QR validity must be 1-15 minutes and grace must be 0-60 minutes',
    )
    await expect(api.generateQrCode('sess-9', 16)).rejects.toThrow(
      'QR validity must be 1-15 minutes and grace must be 0-60 minutes',
    )
    await expect(api.generateQrCode('sess-9', 10, 61)).rejects.toThrow(
      'QR validity must be 1-15 minutes and grace must be 0-60 minutes',
    )
  })

  it('requires a teacher account to sign QR tokens', async () => {
    await loginAsStudent()
    await expect(api.generateQrCode('sess-9', 10)).rejects.toThrow('A teacher account is required to sign QR tokens')
  })

  it('fails closed when the signing key cannot be registered', async () => {
    // An unprovisioned signing key would make every queued scan fail
    // server-side verification, so a failed provision-key request must NOT
    // fall through to local offline activation (the typed 4xx escapes the
    // outer network-failure classification on purpose).
    await loginAsTeacherId('teacher-2')
    handlers.delete('/auth/provision-key')
    handlers.set('/sessions/sess-9', () => jsonResponse(teacherSession))
    await expect(api.generateQrCode('sess-9', 10, 5)).rejects.toThrow(
      'Connect to the internet once to register this device before generating offline QR codes.',
    )
    expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
  })

  it('skips provisioning when the server already knows the cached key', async () => {
    await loginAsTeacherId('teacher-2')
    handlers.set('/sessions/sess-9', () => jsonResponse({ ...teacherSession, teacherPublicKey: 'mocked-public-key' }))
    handlers.set('/sessions/sess-9/activate', () => jsonResponse({ ...teacherSession, isActive: true }))
    const before = provisionCalls()
    await api.generateQrCode('sess-9', 10, 5)
    expect(provisionCalls()).toBe(before)
  })

  it('activates online, provisions the key once and caches the session', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-9', () => jsonResponse(teacherSession))
    handlers.set('/sessions/sess-9/activate', () =>
      jsonResponse({ ...teacherSession, isActive: true, qrToken: 'signed-token-placeholder' }),
    )
    const before = provisionCalls()
    const activated = await api.generateQrCode('sess-9', 10, 5)
    expect(activated).toMatchObject({ id: 'sess-9', isActive: true, qrToken: 'signed-token-placeholder' })
    expect(provisionCalls()).toBe(before + 1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/sessions/sess-9/activate`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ validityMinutes: 10, gracePeriodMinutes: 5, token: 'signed-token-placeholder' }),
      }),
    )
    expect(storeMock.cacheSessions).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'sess-9', isActive: true }),
    ])
  })

  it('carries teacher location evidence on the activation payload', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-9', () => jsonResponse(teacherSession))
    handlers.set('/sessions/sess-9/activate', () => jsonResponse({ ...teacherSession, isActive: true }))
    await api.generateQrCode('sess-9', 10, 5, { latitude: 14.5995, longitude: 120.9842, override: true })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/sessions/sess-9/activate`,
      expect.objectContaining({
        body: JSON.stringify({
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          token: 'signed-token-placeholder',
          latitude: 14.5995,
          longitude: 120.9842,
          overrideTeacherLocation: true,
        }),
      }),
    )
  })

  it('rejects a session whose stored grace is negative', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-9', () => jsonResponse({ ...teacherSession, gracePeriodMinutes: -5 }))
    await expect(api.generateQrCode('sess-9', 10)).rejects.toThrow('QR grace must be 0-60 minutes')
  })

  it('activates locally and queues the operation when offline', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-9', () => jsonResponse(teacherSession))
    handlers.delete('/sessions/sess-9/activate')
    const activated = await api.generateQrCode('sess-9', 10, 5)
    expect(activated).toMatchObject({
      id: 'sess-9',
      isActive: true,
      qrToken: 'signed-token-placeholder',
      teacherPublicKey: 'mocked-public-key',
    })
    expect(activated.qrGeneratedAt).toBeTruthy()
    expect(activated.qrTokenExpiresAt).toBeTruthy()
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('session_activation', {
      sessionId: 'sess-9',
      validityMinutes: 10,
      gracePeriodMinutes: 5,
      token: 'signed-token-placeholder',
    })
    expect(storeMock.cacheSessions).toHaveBeenCalled()
  })

  it('rejects checkpoint validity outside 60-300 seconds', async () => {
    await expect(
      api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 59 }),
    ).rejects.toThrow('Checkpoint QR validity must be 60-300 seconds')
    await expect(
      api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 301 }),
    ).rejects.toThrow('Checkpoint QR validity must be 60-300 seconds')
  })

  it('rejects start grace outside 0-60 minutes', async () => {
    await expect(
      api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120, graceMinutes: 61 }),
    ).rejects.toThrow('Check-in grace must be 0-60 minutes')
  })

  it('requires a teacher account for checkpoint codes', async () => {
    await loginAsStudent()
    await expect(
      api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120 }),
    ).rejects.toThrow('A teacher account is required to sign QR tokens')
  })

  it('refuses checkpoint codes for in-person sessions', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-online', () => jsonResponse({ ...onlineSessionBase, mode: 'in_person' }))
    await expect(
      api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120 }),
    ).rejects.toThrow('Start/end checkpoint QR codes are only available for online sessions')
  })

  it('refuses offline checkpoint activation when the signing key cannot be registered', async () => {
    // Same fail-closed rule as the in-person path: an unprovisioned signing
    // key must never degrade to a queued local activation.
    await loginAsTeacherId('teacher-3')
    handlers.delete('/auth/provision-key')
    handlers.set('/sessions/sess-online', () => jsonResponse({ ...onlineSessionBase, teacherId: 'teacher-3' }))
    await expect(
      api.generateCheckpointQrCode({
        sessionId: 'sess-online',
        checkpoint: 'start',
        validitySeconds: 120,
        graceMinutes: 5,
      }),
    ).rejects.toThrow(
      'Connect to the internet once to register this device before generating offline QR codes.',
    )
    expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
  })

  it('skips provisioning when the server already knows the cached key', async () => {
    await loginAsTeacherId('teacher-4')
    handlers.set('/sessions/sess-online', () => jsonResponse({ ...onlineSessionBase, teacherPublicKey: 'mocked-public-key' }))
    handlers.set('/sessions/sess-online/activate', () => jsonResponse({ ...onlineSessionBase, isActive: true }))
    const before = provisionCalls()
    await api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120 })
    expect(provisionCalls()).toBe(before)
  })

  it('provisions an unknown key before arming a checkpoint online', async () => {
    await loginAsTeacherId('teacher-5')
    handlers.set('/sessions/sess-online', () => jsonResponse(onlineSessionBase))
    handlers.set('/sessions/sess-online/activate', () => jsonResponse({ ...onlineSessionBase, isActive: true }))
    const before = provisionCalls()
    await api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120 })
    expect(provisionCalls()).toBe(before + 1)
  })

  it('arms the start checkpoint online with grace', async () => {
    await loginAsTeacher()
    handlers.set('/sessions/sess-online', () => jsonResponse(onlineSessionBase))
    handlers.set('/sessions/sess-online/activate', () => jsonResponse({ ...onlineSessionBase, isActive: true }))
    await api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'start', validitySeconds: 120, graceMinutes: 5 })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/sessions/sess-online/activate`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          checkpoint: 'start',
          validitySeconds: 120,
          gracePeriodMinutes: 5,
          token: 'signed-token-placeholder',
        }),
      }),
    )
  })

  it('arms the end checkpoint without grace and supports regeneration', async () => {
    handlers.set('/sessions/sess-online', () => jsonResponse(onlineSessionBase))
    handlers.set('/sessions/sess-online/activate', () => jsonResponse({ ...onlineSessionBase, isActive: true }))
    await api.generateCheckpointQrCode({ sessionId: 'sess-online', checkpoint: 'end', validitySeconds: 90, regenerate: true })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/sessions/sess-online/activate`,
      expect.objectContaining({
        body: JSON.stringify({
          checkpoint: 'end',
          validitySeconds: 90,
          regenerate: true,
          token: 'signed-token-placeholder',
        }),
      }),
    )
  })

  it('arms checkpoints locally and queues the operation when offline', async () => {
    handlers.set('/sessions/sess-online', () => jsonResponse(onlineSessionBase))
    handlers.delete('/sessions/sess-online/activate')
    const activated = await api.generateCheckpointQrCode({
      sessionId: 'sess-online',
      checkpoint: 'start',
      validitySeconds: 120,
      graceMinutes: 5,
    })
    expect(activated).toMatchObject({
      id: 'sess-online',
      isActive: true,
      startQrToken: 'signed-token-placeholder',
      startQrValiditySeconds: 120,
      startGraceMinutes: 5,
    })
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('session_activation', {
      sessionId: 'sess-online',
      checkpoint: 'start',
      validitySeconds: 120,
      gracePeriodMinutes: 5,
      regenerate: false,
      token: 'signed-token-placeholder',
    })
  })

  it('recovers and re-provisions when the server rejects an invalid signature', async () => {
    const teacherId = 'teacher-recover'
    await loginAsTeacherId(teacherId)
    handlers.set(`/sessions/sess-recover`, () =>
      jsonResponse({
        ...teacherSession,
        id: 'sess-recover',
        teacherId,
        teacherPublicKey: 'mocked-public-key',
      }),
    )
    let activateAttempts = 0
    handlers.set('/sessions/sess-recover/activate', () => {
      activateAttempts += 1
      if (activateAttempts === 1) {
        return jsonResponse({ message: 'QR token signature is invalid' }, 400)
      }
      return jsonResponse({ ...teacherSession, id: 'sess-recover', teacherId, isActive: true })
    })
    const provisionsBefore = provisionCalls()

    const activated = await api.generateQrCode('sess-recover', 10, 5)

    expect(activated).toMatchObject({ id: 'sess-recover', isActive: true })
    expect(activateAttempts).toBe(2)
    expect(provisionCalls()).toBe(provisionsBefore + 1)
  })

  it('recovers checkpoint activation after an invalid signature', async () => {
    const teacherId = 'teacher-recover-online'
    await loginAsTeacherId(teacherId)
    handlers.set('/sessions/sess-recover-online', () =>
      jsonResponse({
        ...onlineSessionBase,
        id: 'sess-recover-online',
        teacherId,
        teacherPublicKey: 'mocked-public-key',
      }),
    )
    let activateAttempts = 0
    handlers.set('/sessions/sess-recover-online/activate', () => {
      activateAttempts += 1
      if (activateAttempts === 1) {
        return jsonResponse({ message: 'Teacher signing key is not provisioned' }, 400)
      }
      return jsonResponse({ ...onlineSessionBase, id: 'sess-recover-online', teacherId, isActive: true })
    })
    const provisionsBefore = provisionCalls()

    const activated = await api.generateCheckpointQrCode({
      sessionId: 'sess-recover-online',
      checkpoint: 'start',
      validitySeconds: 120,
    })

    expect(activated).toMatchObject({ id: 'sess-recover-online', isActive: true })
    expect(activateAttempts).toBe(2)
    expect(provisionCalls()).toBe(provisionsBefore + 1)
  })

  it('ends the session online and caches the result', async () => {
    handlers.set('/sessions/sess-1/end', () =>
      jsonResponse({ ...cachedSession, isActive: false, endedAt: '2026-08-02T12:00:00.000Z' }),
    )
    const ended = await api.endSession('sess-1')
    expect(ended).toMatchObject({ id: 'sess-1', isActive: false, endedAt: '2026-08-02T12:00:00.000Z' })
    expect(storeMock.cacheSessions).toHaveBeenCalled()
  })

  it('ends locally and queues the operation when offline', async () => {
    storeMock.getCachedSession.mockResolvedValue(cachedSession)
    const ended = await api.endSession('sess-1')
    expect(ended).toMatchObject({ id: 'sess-1', isActive: false })
    expect(ended.endedAt).toBeTruthy()
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('session_end', { sessionId: 'sess-1' })
    expect(storeMock.cacheSessions).toHaveBeenCalled()
  })

  it('fails to end offline when the session is not cached', async () => {
    await expect(api.endSession('sess-1')).rejects.toThrow('Session is not available offline')
  })
})

// ── hybrid scan paths ──

describe('hybrid scan paths', () => {
  const scannedAt = new Date().toISOString()

  it('records a pending online check-in without coordinates and queues the scan with the PIN', async () => {
    storeMock.getCachedSession.mockResolvedValue(onlineSession)
    const evidence = {
      clientAttemptId: 'att-1',
      locationCapturedAt: scannedAt,
      mocked: false,
      inputChannel: 'camera' as const,
    }
    const result = await api.submitScan(
      'sess-1', 'student-1', 'Student One', null, null, 'dev-1',
      makeToken(onlineStartPayload), scannedAt, evidence, '1234',
    )
    expect(result).toMatchObject({
      id: 'offline:sess-1:student-1:start',
      status: 'pending',
      coordinates: { latitude: null, longitude: null },
      checkInTime: scannedAt,
      checkInStatus: 'present',
      isSynced: false,
    })
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('attendance_scan', {
      sessionId: 'sess-1',
      deviceId: 'dev-1',
      qrToken: makeToken(onlineStartPayload),
      scannedAt,
      ...evidence,
      pin: '1234',
    })
  })

  it('records an online check-out against the end checkpoint', async () => {
    storeMock.getCachedSession.mockResolvedValue(onlineSession)
    const result = await api.submitScan(
      'sess-1', 'student-1', 'Student One', null, null, 'dev-1',
      makeToken({ ...onlineStartPayload, checkpoint: 'end' }), scannedAt,
    )
    expect(result).toMatchObject({
      id: 'offline:sess-1:student-1:end',
      status: 'pending',
      checkOutTime: scannedAt,
      checkOutStatus: 'present',
    })
  })

  it('flags online scans with device-integrity signals as disputed', async () => {
    storeMock.getCachedSession.mockResolvedValue(onlineSession)
    const result = await api.submitScan(
      'sess-1', 'student-1', 'Student One', null, null, 'dev-1',
      makeToken(onlineStartPayload), scannedAt,
      { clientAttemptId: 'a-1', locationCapturedAt: scannedAt, mocked: false, inputChannel: 'camera', deviceSecurity: { hookDetected: true } },
    )
    expect(result).toMatchObject({ status: 'disputed' })
  })

  it('requires cached session data even for online scans', async () => {
    const result = await api.submitScan(
      'sess-1', 'student-1', 'Student One', null, null, 'dev-1',
      makeToken(onlineStartPayload), scannedAt,
    )
    expect(result).toEqual({ error: 'Session data is not available offline. Sync before class.' })
  })

  it('requires coordinates for in-person scans', async () => {
    storeMock.getCachedSession.mockResolvedValue(cachedSession)
    const result = await api.submitScan(
      'sess-1', 'student-1', 'Student One', null, null, 'dev-1',
      qrToken, scannedAt,
    )
    expect(result).toEqual({ error: 'Location is required for in-person attendance.' })
  })

  it('reports a successful online check-out saved offline', async () => {
    storeMock.getCachedSession.mockResolvedValue({ ...onlineSession, teacherPublicKey: 'teacher-public-key' })
    const endToken = makeToken({ ...onlineStartPayload, checkpoint: 'end' })
    const result = await api.checkAttendance('sess-1', 'student-1', null, null, endToken, scannedAt)
    expect(result).toEqual({ success: true, status: 'present', message: 'Check-out saved offline and queued for sync.' })
    expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith(
      'scan_attempt',
      expect.objectContaining({ sessionId: 'sess-1', qrToken: endToken, deviceId: 'mobile-test-installation' }),
    )
  })

  it('sends the meeting PIN with the check payload', async () => {
    handlers.set('/attendance/check', () => jsonResponse({ success: true, status: 'present', message: 'ok' }))
    const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, scannedAt, '999')
    expect(result).toEqual({ success: true, status: 'present', message: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/attendance/check`,
      expect.objectContaining({
        body: JSON.stringify({ sessionId: 'sess-1', lat: 14.5995, lon: 120.9842, qrToken, scannedAt, pin: '999' }),
      }),
    )
  })
})

// ── sync queue edge cases ──

describe('syncOfflineQueue edge cases', () => {
  type DrainSend = (kind: string, payload: Record<string, unknown>) => Promise<unknown>
  let drainSend: DrainSend | undefined

  beforeEach(async () => {
    await loginAsStudent()
    storeMock.drainOfflineQueue.mockImplementation(async (send: DrainSend) => {
      drainSend = send
    })
    await api.syncOfflineQueue()
  })

  it('marks a failed scan_attempt terminal', async () => {
    handlers.set('/attendance/check', () =>
      jsonResponse({ success: false, status: 'absent', reason: 'qr_expired', message: 'The QR attendance window has expired' }),
    )
    await expect(drainSend!('scan_attempt', { sessionId: 'sess-1', qrToken })).resolves.toEqual({
      outcome: 'terminal',
      error: 'The QR attendance window has expired',
    })
  })

  it('returns terminal for unknown operation kinds', async () => {
    await expect(drainSend!('mystery', { sessionId: 'sess-1' })).resolves.toEqual({
      outcome: 'terminal',
      error: 'Unknown offline operation. Contact support.',
    })
  })

  it('classifies a maintenance 503 as retryable with the preservation message', async () => {
    handlers.set('/sessions/sess-m/end', () =>
      jsonResponse({ code: 'system_maintenance', message: 'Down for backups' }, 503),
    )
    await expect(drainSend!('session_end', { sessionId: 'sess-m' })).resolves.toEqual({
      outcome: 'retryable',
      error: 'Polycheck is under maintenance — safe on this device; sync resumes when servers reopen',
    })
  })

  it('marks 422 validation failures terminal', async () => {
    handlers.set('/sessions/sess-v/end', () => jsonResponse({ message: 'Roster changed' }, 422))
    await expect(drainSend!('session_end', { sessionId: 'sess-v' })).resolves.toEqual({
      outcome: 'terminal',
      error: 'Roster changed',
    })
  })

  it('falls back to retryable when reconciliation also fails', async () => {
    handlers.set('/sessions/sess-r/activate', () => jsonResponse({ message: 'Conflict' }, 409))
    // No handler for GET /sessions/sess-r — the reconciliation read fails too.
    await expect(drainSend!('session_activation', { sessionId: 'sess-r', token: 'signed-token' })).resolves.toEqual({
      outcome: 'retryable',
      error: 'Network request failed',
    })
  })

  it('accepts a start-checkpoint activation replay when the token matches', async () => {
    handlers.set('/sessions/sess-r/activate', () => jsonResponse({ message: 'Conflict' }, 409))
    handlers.set('/sessions/sess-r', () => jsonResponse({ id: 'sess-r', startQrToken: 'signed-token' }))
    await expect(
      drainSend!('session_activation', {
        sessionId: 'sess-r',
        checkpoint: 'start',
        token: 'signed-token',
        validitySeconds: 120,
        gracePeriodMinutes: 5,
      }),
    ).resolves.toEqual({ outcome: 'synced' })
    expect(storeMock.cacheSessions).toHaveBeenCalledWith([expect.objectContaining({ id: 'sess-r' })])
  })

  it('accepts an end-checkpoint activation replay when the token matches', async () => {
    handlers.set('/sessions/sess-r/activate', () => jsonResponse({ message: 'Conflict' }, 409))
    handlers.set('/sessions/sess-r', () => jsonResponse({ id: 'sess-r', endQrToken: 'signed-token' }))
    await expect(
      drainSend!('session_activation', { sessionId: 'sess-r', checkpoint: 'end', token: 'signed-token', validitySeconds: 90 }),
    ).resolves.toEqual({ outcome: 'synced' })
  })

  it('flags an activation whose token changed on the server as terminal', async () => {
    handlers.set('/sessions/sess-r/activate', () => jsonResponse({ message: 'Conflict' }, 409))
    handlers.set('/sessions/sess-r', () => jsonResponse({ id: 'sess-r', qrToken: 'different-token' }))
    await expect(
      drainSend!('session_activation', { sessionId: 'sess-r', token: 'signed-token', validityMinutes: 10 }),
    ).resolves.toEqual({
      outcome: 'terminal',
      error: 'Session changed on the server. Review it with your instructor.',
    })
  })

  it('keeps an unresolved session_end retryable', async () => {
    handlers.set('/sessions/sess-r/end', () => jsonResponse({ message: 'Conflict' }, 409))
    handlers.set('/sessions/sess-r', () => jsonResponse({ id: 'sess-r' }))
    await expect(drainSend!('session_end', { sessionId: 'sess-r' })).resolves.toEqual({
      outcome: 'retryable',
      error: 'Session operation is still in progress',
    })
  })

  it('sends checkpoint activation payloads with checkpoint fields and caches the result', async () => {
    handlers.set('/sessions/sess-r/activate', () => jsonResponse({ id: 'sess-r', isActive: true }))
    await expect(
      drainSend!('session_activation', {
        sessionId: 'sess-r',
        checkpoint: 'start',
        validitySeconds: 120,
        gracePeriodMinutes: 5,
        regenerate: true,
        token: 'signed-token',
      }),
    ).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/sessions/sess-r/activate`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          checkpoint: 'start',
          validitySeconds: 120,
          gracePeriodMinutes: 5,
          regenerate: true,
          token: 'signed-token',
        }),
      }),
    )
    expect(storeMock.cacheSessions).toHaveBeenCalledWith([expect.objectContaining({ id: 'sess-r', isActive: true })])
  })
})

// ── exports, search and the maintenance probe ──

describe('exports, search and the maintenance probe', () => {
  beforeEach(async () => {
    await loginAsStudent()
  })

  it('returns the export body as text', async () => {
    prefixHandlers.set('/reports/export?', () => jsonResponse('csv,data'))
    await expect(api.exportAttendanceCsv({ sectionId: 'sec-1' })).resolves.toBe(JSON.stringify('csv,data'))
    expect(calledUrl('/reports/export?')).toMatch(/&sectionId=sec-1$/)
  })

  it('surfaces the export error message', async () => {
    prefixHandlers.set('/reports/export?', () => jsonResponse({ message: 'Nope' }, 400))
    await expect(api.exportAttendanceCsv()).rejects.toThrow('Nope')
  })

  it('joins export validation arrays', async () => {
    prefixHandlers.set('/reports/export?', () => jsonResponse({ message: ['A', 'B'] }, 400))
    await expect(api.exportAttendanceCsv()).rejects.toThrow('A. B')
  })

  it('falls back to the status text for a malformed export error', async () => {
    prefixHandlers.set('/reports/export?', () => rawResponse(500, 'oops', 'Server Error'))
    await expect(api.exportAttendanceCsv()).rejects.toThrow('Server Error')
  })

  it('short-circuits searches shorter than two characters', async () => {
    fetchMock.mockClear()
    await expect(api.search('x')).resolves.toEqual({ students: [], sections: [], sessions: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('queries the server search endpoint when online', async () => {
    await expectRequest('GET', '/search?q=prof', { students: [studentUser], sections: [], sessions: [] }, () =>
      api.search('prof'),
    )
  })

  it('filters cached sections and sessions when offline', async () => {
    const secA = makeSection('sec-1', 'A-1', 'L201', '1S', 'subj-1')
    const secB = makeSection('sec-2', 'B-2', 'L301', '2S', 'subj-2')
    const sessA: Session = { ...cachedSession, subjectName: 'Data Structures' }
    const sessB: Session = { ...cachedSession, id: 'sess-2', subjectName: 'Networking', date: '2026-08-03', startTime: '13:00' }
    storeMock.getCachedSections.mockResolvedValue([secA, secB])
    storeMock.getCachedSessions.mockResolvedValue([sessA, sessB])
    await expect(api.search('l201')).resolves.toEqual({ students: [], sections: [secA], sessions: [] })
    await expect(api.search('networking')).resolves.toEqual({ students: [], sections: [], sessions: [sessB] })
  })

  it('returns the maintenance status without touching the snapshot while enabled', async () => {
    handlers.set('/maintenance/status', () => jsonResponse({ enabled: true, message: 'Down' }))
    await expect(api.getMaintenanceStatus()).resolves.toEqual({ enabled: true, message: 'Down' })
    expect(getMaintenanceSnapshot()).toBeNull()
  })

  it('clears the maintenance snapshot when the probe reports disabled', async () => {
    handlers.set('/users/students', () => jsonResponse({ code: 'system_maintenance', message: 'Down' }, 503))
    await expect(api.getStudents()).rejects.toMatchObject({ status: 503 })
    expect(getMaintenanceSnapshot()).not.toBeNull()
    handlers.set('/maintenance/status', () => jsonResponse({ enabled: false }))
    await expect(api.getMaintenanceStatus()).resolves.toEqual({ enabled: false })
    expect(getMaintenanceSnapshot()).toBeNull()
  })

  it('treats a failed probe as no maintenance', async () => {
    await expect(api.getMaintenanceStatus()).resolves.toEqual({ enabled: false })
  })
})

// ── assistant file downloads ──

describe('downloadAssistantFile', () => {
  beforeEach(async () => {
    await loginAsStudent()
    mockFileSystem.cacheDirectory = '/cache/'
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined)
    mockFileSystem.deleteAsync.mockResolvedValue(undefined)
    mockSharing.isAvailableAsync.mockResolvedValue(true)
    mockSharing.shareAsync.mockResolvedValue(undefined)
  })

  it('requires a session token', async () => {
    await api.logout()
    await expect(api.downloadAssistantFile('/docs/master-list/sec-1', 'file.pdf')).rejects.toThrow(
      'Sign in again to download assistant files.',
    )
  })

  it('downloads into a unique cache folder and opens the share sheet', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/Master-List.pdf', status: 200 })
    await api.downloadAssistantFile('/docs/master-list/sec-1', 'Master List.pdf')
    expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('/cache/assistant-downloads/'),
      { intermediates: true },
    )
    expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
      `${API_BASE}/docs/master-list/sec-1`,
      expect.stringContaining('Master-List.pdf'),
      { headers: { Authorization: 'Bearer test-token' } },
    )
    expect(mockSharing.shareAsync).toHaveBeenCalledWith('/cache/x/Master-List.pdf', {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Master List.pdf',
    })
  })

  it('sanitizes unsafe filenames', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/f.pdf', status: 200 })
    await api.downloadAssistantFile('/docs/x', 'my report: final?.pdf')
    expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/my-report-final-\.pdf$/),
      expect.anything(),
    )
  })

  it('falls back to the octet-stream mime type for unknown extensions', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/dataset', status: 200 })
    await api.downloadAssistantFile('/docs/x', 'dataset')
    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      '/cache/x/dataset',
      expect.objectContaining({ mimeType: 'application/octet-stream', UTI: undefined }),
    )
  })

  it('cleans up and rethrows download failures', async () => {
    mockFileSystem.downloadAsync.mockRejectedValue(new Error('socket hung up'))
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow('socket hung up')
    expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(expect.stringContaining('/cache/assistant-downloads/'), {
      idempotent: true,
    })
  })

  it('still rethrows the download failure when cache cleanup also fails', async () => {
    mockFileSystem.downloadAsync.mockRejectedValue(new Error('socket hung up'))
    mockFileSystem.deleteAsync.mockRejectedValue(new Error('cleanup failed'))
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow('socket hung up')
  })

  it('still reports the access failure when cache cleanup also fails', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/f', status: 403 })
    mockFileSystem.deleteAsync.mockRejectedValue(new Error('cleanup failed'))
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'Your session cannot access this file. Sign in again and retry.',
    )
  })

  it('wraps non-Error download failures in a friendly message', async () => {
    mockFileSystem.downloadAsync.mockRejectedValue('boom')
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'The file could not be downloaded. Please try again.',
    )
  })

  it('asks for a fresh session on 401/403 downloads', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/f', status: 401 })
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'Your session cannot access this file. Sign in again and retry.',
    )
    expect(mockFileSystem.deleteAsync).toHaveBeenCalled()
  })

  it('reports a generic failure for other non-2xx downloads', async () => {
    mockFileSystem.downloadAsync.mockResolvedValue({ uri: '/cache/x/f', status: 500 })
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'The file could not be downloaded. Please try again.',
    )
  })

  it('reports an unavailable share sheet', async () => {
    mockSharing.isAvailableAsync.mockResolvedValue(false)
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'The system share sheet is unavailable on this device.',
    )
  })

  it('reports unavailable temporary storage', async () => {
    mockFileSystem.cacheDirectory = null
    await expect(api.downloadAssistantFile('/docs/x', 'file.pdf')).rejects.toThrow(
      'Temporary file storage is unavailable on this device.',
    )
  })
})

// ── screenshot streaming ──

describe('getReportScreenshotDataUrl', () => {
  beforeEach(async () => {
    await loginAsStudent()
  })

  it('streams the screenshot as a data URL', async () => {
    handlers.set('/reports/rep-1/screenshot', () => binaryResponse([104, 105], 'image/png'))
    await expect(api.getReportScreenshotDataUrl('rep-1')).resolves.toBe('data:image/png;base64,aGk=')
  })

  it('returns null for a missing attachment', async () => {
    handlers.set('/reports/rep-1/screenshot', () => jsonResponse({ message: 'Not found' }, 404))
    await expect(api.getReportScreenshotDataUrl('rep-1')).resolves.toBeNull()
  })

  it('returns null when the request fails', async () => {
    await expect(api.getReportScreenshotDataUrl('rep-1')).resolves.toBeNull()
  })
})
