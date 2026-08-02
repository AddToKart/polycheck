/**
 * Tests for the offline-first sync engine in services/api-client.ts.
 *
 * The @polycheck/shared mock (__mocks__/polycheck-shared.ts) only decodes the
 * unsigned payload segment of a QR token, so tests hand-craft tokens as
 * `${base64url(JSON.stringify(payload))}.fake-signature`.
 */

import type { AttendanceRecord, Session, User } from '@polycheck/shared'
import { api } from '../services/api-client'
import * as offlineStore from '../services/offline-store'

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
jest.mock('expo-secure-store')
jest.mock('react-native')

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

const API_BASE = 'http://test/api'

// QR token issued at 2026-08-02T09:59:30.000Z with 10 min validity + 5 min grace.
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

// Hand-crafts a QR token whose payload segment the shared mock can decode.
const makeToken = (payload: unknown): string =>
  `${Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}.fake-signature`

const qrToken = makeToken(tokenPayload)

const cachedSession: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Data Structures',
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

// ── fetch harness ──
// URL-suffix -> handler routing. A URL with no registered handler rejects with a
// TypeError, which isNetworkError() treats as a plain network failure.
const handlers = new Map<string, (init?: RequestInit) => Response | Promise<Response>>()

const jsonResponse = (data: unknown, status = 200) => {
  const body = JSON.stringify(data)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    text: jest.fn().mockResolvedValue(body),
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response
}

const fetchMock = jest.fn(
  async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url
    for (const [suffix, handler] of handlers) {
      if (url.endsWith(suffix)) return handler(init)
    }
    throw new TypeError('Network request failed')
  },
)

const originalFetch = globalThis.fetch

beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true })
})

afterAll(() => {
  Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true })
})

beforeEach(() => {
  handlers.clear()
  jest.clearAllMocks()
  storeMock.getCachedSession.mockResolvedValue(null)
  storeMock.getServerClockOffset.mockResolvedValue(5000)
  storeMock.drainOfflineQueue.mockResolvedValue(undefined)
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

describe('api-client offline sync engine', () => {
  describe('submitScan', () => {
    it('posts the scan online and caches the returned record', async () => {
      const evidence = {
        clientAttemptId: 'attempt-1',
        accuracyMeters: 12,
        locationCapturedAt: '2026-08-02T10:00:00.000Z',
        mocked: false,
        inputChannel: 'camera' as const,
      }
      handlers.set('/attendance/scan', () => jsonResponse(serverRecord))

      const result = await api.submitScan(
        'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
        qrToken, '2026-08-02T10:00:00.000Z', evidence,
      )

      expect(result).toEqual(serverRecord)
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/attendance/scan`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'sess-1',
            lat: 14.5995,
            lon: 120.9842,
            deviceId: 'dev-1',
            qrToken,
            scannedAt: '2026-08-02T10:00:00.000Z',
            ...evidence,
          }),
        }),
      )
      expect(storeMock.cacheAttendanceRecords).toHaveBeenCalledWith([serverRecord])
    })

    it('returns a server-side error object without caching it', async () => {
      handlers.set('/attendance/scan', () => jsonResponse({ error: 'Already submitted for this session' }))

      const result = await api.submitScan(
        'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
        qrToken, '2026-08-02T10:00:00.000Z',
      )

      expect(result).toEqual({ error: 'Already submitted for this session' })
      expect(storeMock.cacheAttendanceRecords).not.toHaveBeenCalled()
    })

    it('rethrows non-network errors', async () => {
      handlers.set('/attendance/scan', () => jsonResponse({ message: 'boom' }, 400))

      await expect(
        api.submitScan('sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1', qrToken, '2026-08-02T10:00:00.000Z'),
      ).rejects.toThrow('boom')
    })

    describe('offline fallback', () => {
      // The handlers map is empty in these tests, so every fetch rejects with a
      // TypeError, which isNetworkError() treats as a network failure.
      it('returns a local record, enqueues the scan and caches it when offline', async () => {
        storeMock.getCachedSession.mockResolvedValue(cachedSession)
        const scannedAt = '2026-08-02T10:00:00.000Z'
        const evidence = {
          clientAttemptId: 'attempt-1',
          accuracyMeters: 12,
          locationCapturedAt: scannedAt,
          mocked: false,
          inputChannel: 'camera' as const,
        }

        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, scannedAt, evidence,
        )

        expect(result).toEqual({
          id: 'offline:sess-1:student-1',
          sessionId: 'sess-1',
          sectionId: 'sec-1',
          studentId: 'student-1',
          studentName: 'Student One',
          timestamp: scannedAt,
          status: 'present',
          coordinates: { latitude: 14.5995, longitude: 120.9842 },
          deviceId: 'dev-1',
          tokenSnapshot: qrToken,
          isSynced: false,
        })
        expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('attendance_scan', {
          sessionId: 'sess-1',
          lat: 14.5995,
          lon: 120.9842,
          deviceId: 'dev-1',
          qrToken,
          scannedAt,
          ...evidence,
        })
        expect(storeMock.cacheAttendanceRecords).toHaveBeenCalledWith([
          expect.objectContaining({ id: 'offline:sess-1:student-1', status: 'present', isSynced: false }),
        ])
      })

      it('marks scans inside the validity window as present', async () => {
        storeMock.getCachedSession.mockResolvedValue(cachedSession)

        await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
        )

        expect(storeMock.cacheAttendanceRecords).toHaveBeenCalledWith([
          expect.objectContaining({ status: 'present' }),
        ])
      })

      it('marks scans after validity but within grace as late', async () => {
        storeMock.getCachedSession.mockResolvedValue(cachedSession)
        const scannedAt = new Date(issuedAt + 660_000).toISOString() // 11 min after issue

        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, scannedAt,
        )

        expect(result).toMatchObject({ status: 'late' })
        expect(storeMock.cacheAttendanceRecords).toHaveBeenCalledWith([
          expect.objectContaining({ status: 'late' }),
        ])
      })

      it('rejects mocked evidence', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
          { clientAttemptId: 'a-1', locationCapturedAt: '2026-08-02T10:00:00.000Z', mocked: true, inputChannel: 'camera' },
        )
        expect(result).toEqual({ error: 'Mocked locations are not accepted' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
        expect(storeMock.cacheAttendanceRecords).not.toHaveBeenCalled()
      })

      it('rejects low-accuracy evidence', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
          { clientAttemptId: 'a-1', accuracyMeters: 60, locationCapturedAt: '2026-08-02T10:00:00.000Z', mocked: false, inputChannel: 'camera' },
        )
        expect(result).toEqual({ error: 'Location accuracy is too poor to verify attendance' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('rejects stale location evidence', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
          { clientAttemptId: 'a-1', accuracyMeters: 12, locationCapturedAt: '2026-08-02T09:57:00.000Z', mocked: false, inputChannel: 'camera' },
        )
        expect(result).toEqual({ error: 'Location fix is stale. Acquire a fresh location and try again.' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('rejects scans outside the session geofence', async () => {
        storeMock.getCachedSession.mockResolvedValue(cachedSession)

        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.9, 121.3, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
        )

        expect(result).toEqual({ error: 'You are outside the session geofence' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('rejects scans when no cached session is available', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          qrToken, '2026-08-02T10:00:00.000Z',
        )
        expect(result).toEqual({ error: 'You are outside the session geofence' })
      })

      it('rejects scans outside the QR validity window', async () => {
        storeMock.getCachedSession.mockResolvedValue(cachedSession)
        const expiredToken = makeToken({ ...tokenPayload, issuedAt: Date.UTC(2026, 7, 2, 9, 0, 0) })

        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          expiredToken, '2026-08-02T10:00:00.000Z',
        )

        expect(result).toEqual({ error: 'The QR attendance window has expired' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('rejects malformed QR tokens', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          'not-a-real-token', '2026-08-02T10:00:00.000Z',
        )
        expect(result).toEqual({ error: 'QR token signature is invalid' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('requires a QR token', async () => {
        const result = await api.submitScan(
          'sess-1', 'student-1', 'Student One', 14.5995, 120.9842, 'dev-1',
          '', '2026-08-02T10:00:00.000Z',
        )
        expect(result).toEqual({ error: 'QR token is required' })
      })
    })
  })

  describe('checkAttendance', () => {
    beforeEach(() => {
      storeMock.getCachedSession.mockResolvedValue(cachedSession)
    })

    it('returns the server response when online', async () => {
      handlers.set('/attendance/check', () => jsonResponse({ success: true, status: 'present', message: 'ok' }))

      const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, '2026-08-02T10:00:00.000Z')

      expect(result).toEqual({ success: true, status: 'present', message: 'ok' })
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/attendance/check`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'sess-1', lat: 14.5995, lon: 120.9842, qrToken, scannedAt: '2026-08-02T10:00:00.000Z' }),
        }),
      )
    })

    describe('offline fallback', () => {
      it('reports not_synced when no session is cached', async () => {
        storeMock.getCachedSession.mockResolvedValue(null)
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'not_synced' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports not_synced when no QR token is provided', async () => {
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842)
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'not_synced' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports not_synced when the session has no teacher public key', async () => {
        storeMock.getCachedSession.mockResolvedValue({ ...cachedSession, teacherPublicKey: undefined })
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'not_synced' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports not_synced when the server clock offset is unknown', async () => {
        storeMock.getServerClockOffset.mockResolvedValue(null)
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'not_synced' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports invalid_signature for a malformed token', async () => {
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, 'garbage-token', '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'disputed', reason: 'invalid_signature' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports invalid_signature when the token does not match the session', async () => {
        const result = await api.checkAttendance(
          'sess-1', 'student-1', 14.5995, 120.9842,
          makeToken({ ...tokenPayload, sessionId: 'other-session' }), '2026-08-02T10:00:00.000Z',
        )
        expect(result).toMatchObject({ success: false, status: 'disputed', reason: 'invalid_signature' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports outside_geofence when outside the session geofence', async () => {
        const result = await api.checkAttendance('sess-1', 'student-1', 14.9, 121.3, qrToken, '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'outside_geofence' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports session_inactive after the session ended', async () => {
        storeMock.getCachedSession.mockResolvedValue({ ...cachedSession, endedAt: '2026-08-02T09:00:00.000Z' })
        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, '2026-08-02T10:00:00.000Z')
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'session_inactive' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('reports qr_expired outside the QR validity window', async () => {
        const result = await api.checkAttendance(
          'sess-1', 'student-1', 14.5995, 120.9842,
          makeToken({ ...tokenPayload, issuedAt: Date.UTC(2026, 7, 2, 9, 0, 0) }), '2026-08-02T10:00:00.000Z',
        )
        expect(result).toMatchObject({ success: false, status: 'absent', reason: 'qr_expired' })
        expect(storeMock.enqueueOfflineOperation).not.toHaveBeenCalled()
      })

      it('records a present check-in and enqueues a scan_attempt', async () => {
        const scannedAt = '2026-08-02T10:00:00.000Z'

        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, scannedAt)

        expect(result).toEqual({ success: true, status: 'present', message: 'Check-in saved offline and queued for sync.' })
        expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith('scan_attempt', {
          sessionId: 'sess-1',
          lat: 14.5995,
          lon: 120.9842,
          deviceId: 'device-mobile',
          qrToken,
          scannedAt,
        })
      })

      it('records a late check-in within grace', async () => {
        const scannedAt = new Date(issuedAt + 660_000).toISOString()

        const result = await api.checkAttendance('sess-1', 'student-1', 14.5995, 120.9842, qrToken, scannedAt)

        expect(result).toEqual({ success: true, status: 'late', message: 'Late check-in saved offline and queued for sync.' })
        expect(storeMock.enqueueOfflineOperation).toHaveBeenCalledWith(
          'scan_attempt',
          expect.objectContaining({ qrToken, scannedAt, deviceId: 'device-mobile' }),
        )
      })
    })
  })

  describe('syncOfflineQueue', () => {
    let drainSend: ((kind: string, payload: Record<string, unknown>) => Promise<unknown>) | undefined

    beforeEach(async () => {
      await loginAsStudent()
      storeMock.drainOfflineQueue.mockImplementation(async (send: (kind: string, payload: Record<string, unknown>) => Promise<unknown>) => {
        drainSend = send
      })
      await api.syncOfflineQueue()
    })

    it('drains the queue for the signed-in user', () => {
      expect(storeMock.initializeOfflineStore).toHaveBeenCalledWith('student-1')
      expect(storeMock.drainOfflineQueue).toHaveBeenCalledTimes(1)
    })

    it('does nothing when no user is signed in', async () => {
      await api.logout()
      storeMock.drainOfflineQueue.mockClear()

      await api.syncOfflineQueue()

      expect(storeMock.drainOfflineQueue).not.toHaveBeenCalled()
    })

    it('syncs an attendance_scan and marks the cached record synced', async () => {
      handlers.set('/sync/attendance', () => jsonResponse({ queued: false, results: [serverRecord] }))
      const payload = { sessionId: 'sess-1', studentId: 'student-1', clientAttemptId: 'attempt-1' }

      const result = await drainSend!('attendance_scan', payload)

      expect(result).toEqual({ outcome: 'synced' })
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/sync/attendance`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ records: [payload] }) }),
      )
      expect(storeMock.removeCachedAttendanceAttempt).toHaveBeenCalledWith('sess-1', 'student-1')
      expect(storeMock.cacheAttendanceRecords).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'rec-1', isSynced: true }),
      ])
    })

    it('routes terminal attendance sync errors through classifyAttendanceSyncError', async () => {
      handlers.set('/sync/attendance', () => jsonResponse({ queued: false, results: [{ error: 'Signature is invalid' }] }))

      const result = await drainSend!('attendance_scan', { sessionId: 'sess-1', studentId: 'student-1' })

      expect(result).toEqual({ outcome: 'terminal', error: 'Signature is invalid' })
      expect(storeMock.removeCachedAttendanceAttempt).not.toHaveBeenCalled()
      expect(storeMock.cacheAttendanceRecords).not.toHaveBeenCalled()
    })

    it('routes retryable attendance sync errors through classifyAttendanceSyncError', async () => {
      handlers.set('/sync/attendance', () => jsonResponse({ queued: false, results: [{ error: 'Network request failed' }] }))

      const result = await drainSend!('attendance_scan', { sessionId: 'sess-1', studentId: 'student-1' })

      expect(result).toEqual({ outcome: 'retryable', error: 'Network request failed' })
      expect(storeMock.removeCachedAttendanceAttempt).not.toHaveBeenCalled()
      expect(storeMock.cacheAttendanceRecords).not.toHaveBeenCalled()
    })

    it('keeps the attempt queued when the sync response has no result', async () => {
      handlers.set('/sync/attendance', () => jsonResponse({ queued: false, results: [] }))

      const result = await drainSend!('attendance_scan', { sessionId: 'sess-1', studentId: 'student-1' })

      expect(result).toEqual({ outcome: 'retryable', error: 'Attendance sync returned no result' })
    })

    it('posts scan_attempt operations to /attendance/check', async () => {
      handlers.set('/attendance/check', () => jsonResponse({ success: true, status: 'present' }))
      const payload = {
        sessionId: 'sess-1',
        lat: 14.5995,
        lon: 120.9842,
        deviceId: 'device-mobile',
        qrToken,
        scannedAt: '2026-08-02T10:00:00.000Z',
      }

      const result = await drainSend!('scan_attempt', payload)

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/attendance/check`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
      )
    })

    it('posts session_activation operations to /sessions/:id/activate', async () => {
      handlers.set('/sessions/sess-2/activate', () => jsonResponse({}))

      const result = await drainSend!('session_activation', {
        sessionId: 'sess-2',
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        token: 'signed-token',
      })

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/sessions/sess-2/activate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ validityMinutes: 10, gracePeriodMinutes: 5, token: 'signed-token' }),
        }),
      )
    })

    it('posts unknown kinds to /sessions/:id/end', async () => {
      handlers.set('/sessions/sess-3/end', () => jsonResponse({}))

      const result = await drainSend!('session_end', { sessionId: 'sess-3' })

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/sessions/sess-3/end`,
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('preSyncOfflineData', () => {
    it('does nothing when no user is signed in', async () => {
      await api.logout()
      fetchMock.mockClear()

      await api.preSyncOfflineData()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(storeMock.setServerClockOffset).not.toHaveBeenCalled()
      expect(storeMock.drainOfflineQueue).not.toHaveBeenCalled()
    })

    it('computes the server clock offset from the /health RTT midpoint', async () => {
      handlers.set('/health', () => jsonResponse({ timestamp: '2026-08-02T10:00:00.000Z' }))
      handlers.set('/subjects', () => jsonResponse([]))
      handlers.set('/sections', () => jsonResponse([]))
      handlers.set('/sessions', () => jsonResponse([]))
      await loginAsStudent()

      const serverTime = new Date('2026-08-02T10:00:00.000Z').getTime()
      const nowSpy = jest.spyOn(Date, 'now')
      nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(2_000)
      try {
        await api.preSyncOfflineData()
      } finally {
        nowSpy.mockRestore()
      }

      // offset = serverTime - (startedAt + completedAt) / 2 = serverTime - 1500
      expect(storeMock.setServerClockOffset).toHaveBeenCalledTimes(1)
      expect(storeMock.setServerClockOffset).toHaveBeenCalledWith(serverTime - 1_500)
    })

    it('syncs the queue and warms subject, section and session caches', async () => {
      handlers.set('/health', () => jsonResponse({ timestamp: '2026-08-02T10:00:00.000Z' }))
      handlers.set('/subjects', () => jsonResponse([]))
      handlers.set('/sections', () => jsonResponse([]))
      handlers.set('/sessions', () => jsonResponse([]))
      await loginAsStudent()

      await api.preSyncOfflineData()

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/health`, expect.anything())
      expect(storeMock.drainOfflineQueue).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/subjects`, expect.anything())
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/sections`, expect.anything())
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/sessions`, expect.anything())
      expect(storeMock.replaceCachedSubjects).toHaveBeenCalledWith([])
      expect(storeMock.replaceCachedSections).toHaveBeenCalledWith([])
      expect(storeMock.cacheSessions).toHaveBeenCalledWith([])
    })

    it('additionally warms attendance for student accounts', async () => {
      handlers.set('/health', () => jsonResponse({ timestamp: '2026-08-02T10:00:00.000Z' }))
      handlers.set('/subjects', () => jsonResponse([]))
      handlers.set('/sections', () => jsonResponse([]))
      handlers.set('/sessions', () => jsonResponse([]))
      handlers.set('/attendance/student/student-1', () => jsonResponse([]))
      await loginAsStudent()

      await api.preSyncOfflineData()

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/attendance/student/student-1`, expect.anything())
      expect(storeMock.replaceCachedAttendanceForStudent).toHaveBeenCalledWith('student-1', [])
      expect(storeMock.getCachedAttendanceRecords).toHaveBeenCalledWith('student-1')
    })

    it('skips attendance warming for teacher accounts', async () => {
      handlers.set('/health', () => jsonResponse({ timestamp: '2026-08-02T10:00:00.000Z' }))
      handlers.set('/subjects', () => jsonResponse([]))
      handlers.set('/sections', () => jsonResponse([]))
      handlers.set('/sessions', () => jsonResponse([]))
      await loginAsTeacher()

      await api.preSyncOfflineData()

      const attendanceCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/attendance/student/'))
      expect(attendanceCalls).toHaveLength(0)
    })

    it('swallows network errors', async () => {
      await loginAsStudent()
      handlers.clear() // every fetch now rejects with a TypeError

      await expect(api.preSyncOfflineData()).resolves.toBeUndefined()

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/health`, expect.anything())
      expect(storeMock.setServerClockOffset).not.toHaveBeenCalled()
      expect(storeMock.drainOfflineQueue).not.toHaveBeenCalled()
    })

    it('rethrows non-network errors', async () => {
      handlers.set('/health', () => jsonResponse({ message: 'boom' }, 400))
      await loginAsStudent()

      await expect(api.preSyncOfflineData()).rejects.toThrow('boom')
    })
  })
})
