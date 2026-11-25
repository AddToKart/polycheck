import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord, QRTokenPayload } from '@polycheck/shared'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared/utils'

vi.mock('../api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))

const SERVER_NOW = Date.parse('2026-11-12T04:00:00.000Z')
const signingKeys = createSigningKeyPair(new Uint8Array(32).fill(7))

const student = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
}

function signedToken(checkpoint: 'start' | 'end'): string {
  const payload: QRTokenPayload = {
    version: 1,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    teacherName: 'Prof. Test',
    issuedAt: SERVER_NOW,
    validityMinutes: 5,
    gracePeriodMinutes: 10,
    mode: 'online',
    checkpoint,
    pinRequired: false,
  }
  return signQRToken(payload, signingKeys.secretKey)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function serverRecord(id: string): AttendanceRecord {
  return {
    id,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'student-1',
    studentName: 'Test Student',
    timestamp: new Date(SERVER_NOW).toISOString(),
    status: 'present',
    coordinates: { latitude: null, longitude: null },
    deviceId: 'web-device-1',
    isSynced: true,
  }
}

function optimisticLeg(checkpoint: 'start' | 'end'): AttendanceRecord {
  return {
    id: `offline:sess-1:student-1:${checkpoint}`,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'student-1',
    studentName: 'Test Student',
    timestamp: new Date(SERVER_NOW).toISOString(),
    status: 'pending',
    coordinates: { latitude: null, longitude: null },
    deviceId: 'web-device-1',
    isSynced: false,
    ...(checkpoint === 'end'
      ? { checkOutTime: new Date(SERVER_NOW).toISOString(), checkOutStatus: 'present' as const }
      : { checkInTime: new Date(SERVER_NOW).toISOString(), checkInStatus: 'present' as const }),
  }
}

async function prepare() {
  localStorage.setItem('polycheck-user', JSON.stringify(student))
  vi.resetModules()
  const [{ api }, store] = await Promise.all([
    import('../api-client'),
    import('./store'),
  ])
  await store.wipeOfflineStore()
  await store.initializeOfflineStore(student.id)
  return { api, store }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('queued check-in drain endpoint (WEB-02)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('replays a legacy scan_attempt row through POST /attendance/scan with the same body', async () => {
    const { api, store } = await prepare()
    const token = signedToken('start')
    const payload = {
      sessionId: 'sess-1',
      lat: 14.8697,
      lon: 120.9991,
      deviceId: 'web-device-1',
      qrToken: token,
      scannedAt: new Date(SERVER_NOW).toISOString(),
      clientAttemptId: 'attempt-legacy',
    }
    await store.enqueueOfflineOperation('scan_attempt', payload)

    const fetchMock = vi.fn(async () => jsonResponse(serverRecord('record-start')))
    vi.stubGlobal('fetch', fetchMock)

    await api.syncOfflineQueue()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.polycheck.test/api/attendance/scan')
    expect(init.method).toBe('POST')
    // The queued body is the live scan contract, unchanged.
    expect(JSON.parse(String(init.body))).toEqual(payload)
    // The queue row id rides along as the idempotency key, so a replay cannot
    // double-commit.
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'scan_attempt:attempt-legacy',
    )
    await expect(store.getPendingSyncCount()).resolves.toBe(0)
  })

  it('keeps terminal check-in rejections off the queue without crashing', async () => {
    const { api, store } = await prepare()
    await store.enqueueOfflineOperation('scan_attempt', {
      sessionId: 'sess-1',
      qrToken: signedToken('start'),
      scannedAt: new Date(SERVER_NOW).toISOString(),
      clientAttemptId: 'attempt-legacy-2',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'QR token signature is invalid' })),
    )

    await api.syncOfflineQueue()

    expect(await store.getPendingSyncCount()).toBe(0)
    const issues = await store.getOfflineQueueIssues()
    expect(issues).toHaveLength(1)
    expect(issues[0].failed).toBe(true)
  })
})

describe('leg-scoped drain cleanup (WEB-12)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('draining the start leg leaves the queued end leg visible on the roster', async () => {
    const { api, store } = await prepare()
    const startToken = signedToken('start')
    const endToken = signedToken('end')
    await store.cacheAttendanceRecords([optimisticLeg('start'), optimisticLeg('end')])

    await store.enqueueOfflineOperation('scan_attempt', {
      sessionId: 'sess-1',
      qrToken: startToken,
      scannedAt: new Date(SERVER_NOW).toISOString(),
      clientAttemptId: 'leg-start',
    })
    await sleep(5)
    await store.enqueueOfflineOperation('scan_attempt', {
      sessionId: 'sess-1',
      qrToken: endToken,
      scannedAt: new Date(SERVER_NOW).toISOString(),
      clientAttemptId: 'leg-end',
    })

    // Start commits; the end leg's request still fails (e.g. checkpoint not yet
    // armed) and must stay queued AND visible.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { qrToken?: string }
        if (body.qrToken === startToken) return jsonResponse(serverRecord('record-start'))
        throw new TypeError('Failed to fetch')
      }),
    )

    await api.syncOfflineQueue()

    const remaining = await store.getCachedAttendanceForSession('sess-1')
    const ids = remaining.map((entry) => entry.id)
    expect(ids).toContain('offline:sess-1:student-1:end')
    expect(ids).not.toContain('offline:sess-1:student-1:start')
    // The committed start leg is cached from the server response.
    expect(ids).toContain('record-start')
    // The end leg is still retryable evidence.
    expect(await store.getPendingSyncCount()).toBe(1)
  })
})
