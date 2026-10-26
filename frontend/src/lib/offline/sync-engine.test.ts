import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord, Session, Student } from '@polycheck/shared'

const student: Student = {
  id: 'student-1',
  fullName: 'Juan Dela Cruz',
  studentId: '2024-00001-MN-0',
  role: 'student',
  program: 'BSIT',
  yearLevel: 3,
  department: 'CCIS',
  enrolledSectionIds: ['sec-1'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const syncedRecord: AttendanceRecord = {
  id: 'record-server-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  studentName: 'Juan Dela Cruz',
  timestamp: '2026-10-26T01:00:00.000Z',
  status: 'present',
  coordinates: { latitude: 14.8697, longitude: 120.9991 },
  deviceId: 'web-device',
  isSynced: true,
}

const session: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  date: '2026-10-26',
  startTime: '09:00',
  endTime: '10:00',
  qrValidityMinutes: 5,
  gracePeriodMinutes: 10,
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
  isActive: true,
  qrToken: 'signed-token',
  teacherId: 'teacher-1',
  createdAt: '2026-10-26T00:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function loadModules() {
  vi.resetModules()
  const [apiModule, storeModule] = await Promise.all([
    import('../api-client'),
    import('./store'),
  ])
  return { api: apiModule.api, store: storeModule }
}

const scanPayload = {
  sessionId: 'sess-1',
  lat: 14.8697,
  lon: 120.9991,
  deviceId: 'web-device',
  qrToken: 'x'.repeat(90),
  scannedAt: '2026-10-26T01:00:00.000Z',
  clientAttemptId: 'attempt-1',
}

describe('syncOfflineQueue', () => {
  beforeEach(() => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('drains a queued scan from an inline batch result and replaces the optimistic record', async () => {
    const { api, store } = await loadModules()
    await store.initializeOfflineStore(student.id)
    await store.enqueueOfflineOperation('attendance_scan', scanPayload)
    await store.cacheAttendanceRecords([
      {
        ...syncedRecord,
        id: 'offline:sess-1:student-1',
        isSynced: false,
      },
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ queued: false, results: [syncedRecord] }, 202),
      ),
    )

    await api.syncOfflineQueue()

    expect(await store.getPendingSyncCount()).toBe(0)
    const cached = await store.getCachedAttendanceRecords(student.id)
    expect(cached).toHaveLength(1)
    expect(cached[0].id).toBe('record-server-1')
    expect(cached[0].isSynced).toBe(true)
  })

  it('polls a queued receipt until the server reports completion', async () => {
    const { api, store } = await loadModules()
    await store.initializeOfflineStore(student.id)
    await store.enqueueOfflineOperation('attendance_scan', {
      ...scanPayload,
      clientAttemptId: 'attempt-2',
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/sync/attendance/batches')) {
        return jsonResponse({ queued: true, receiptId: 'a'.repeat(64) }, 202)
      }
      if (url.endsWith(`/sync/attendance/batches/${'a'.repeat(64)}`)) {
        return jsonResponse({ state: 'completed', results: [syncedRecord] })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.syncOfflineQueue()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await store.getPendingSyncCount()).toBe(0)
  })

  it('reconciles a 409 activation when the server already committed the same token', async () => {
    const { api, store } = await loadModules()
    await store.initializeOfflineStore(student.id)
    await store.enqueueOfflineOperation('session_activation', {
      sessionId: 'sess-1',
      validityMinutes: 5,
      gracePeriodMinutes: 10,
      token: 'signed-token',
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/sessions/sess-1/activate')) {
        expect(init?.method).toBe('POST')
        return jsonResponse({ message: 'Session is already active' }, 409)
      }
      if (url.endsWith('/sessions/sess-1')) {
        return jsonResponse(session)
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.syncOfflineQueue()

    expect(await store.getPendingSyncCount()).toBe(0)
    await expect(store.getCachedSession('sess-1')).resolves.toMatchObject({ qrToken: 'signed-token' })
  })

  it('keeps retryable terminal evidence queued when the server rejects the token', async () => {
    const { api, store } = await loadModules()
    await store.initializeOfflineStore(student.id)
    await store.enqueueOfflineOperation('attendance_scan', {
      ...scanPayload,
      clientAttemptId: 'attempt-3',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { queued: false, results: [{ error: 'QR token signature is invalid' }] },
          202,
        ),
      ),
    )

    await api.syncOfflineQueue()

    // Terminal evidence is retained for review but no longer counts as pending.
    expect(await store.getPendingSyncCount()).toBe(0)
    const issues = await store.getOfflineQueueIssues()
    expect(issues).toHaveLength(1)
    expect(issues[0].failed).toBe(true)
    expect(issues[0].error).toBe('QR token signature is invalid')
  })
})
