import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord, Session } from '@polycheck/shared'
import type { QRTokenPayload } from '@polycheck/shared'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared/utils'

vi.mock('../api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))

// Server clock reference for every token/scan below.
const SERVER_NOW = Date.parse('2026-11-12T04:00:00.000Z')
const MINUTE = 60_000

const signingKeys = createSigningKeyPair(new Uint8Array(32).fill(11))

const student = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
}

const session: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  mode: 'in_person',
  date: '2026-11-12',
  startTime: '12:00',
  endTime: '13:00',
  qrValidityMinutes: 5,
  gracePeriodMinutes: 10,
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
  isActive: true,
  teacherId: 'teacher-1',
  teacherPublicKey: signingKeys.publicKey,
  createdAt: '2026-11-12T00:00:00.000Z',
}

function signedToken(overrides: Partial<QRTokenPayload> = {}): string {
  return signQRToken(
    {
      version: 1,
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      teacherName: 'Prof. Test',
      issuedAt: SERVER_NOW,
      validityMinutes: 5,
      gracePeriodMinutes: 10,
      mode: 'in_person',
      pinRequired: false,
      ...overrides,
    },
    signingKeys.secretKey,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function prepare(options: { offsetMs?: number; cacheSession?: boolean } = {}) {
  localStorage.setItem('polycheck-user', JSON.stringify(student))
  vi.resetModules()
  const [{ api }, store] = await Promise.all([
    import('../api-client'),
    import('./store'),
  ])
  await store.wipeOfflineStore()
  await store.initializeOfflineStore(student.id)
  if (options.cacheSession !== false) await store.cacheSessions([session])
  if (options.offsetMs !== undefined) {
    await store.setServerClockOffset(options.offsetMs)
  }
  return { api, store }
}

function scanEvidence(deviceNow: number, extra: Record<string, unknown> = {}) {
  return {
    clientAttemptId: crypto.randomUUID(),
    accuracyMeters: 10,
    locationCapturedAt: new Date(deviceNow).toISOString(),
    inputChannel: 'camera' as const,
    ...extra,
  }
}

function errorOf(result: AttendanceRecord | { error: string }): string {
  return 'error' in result ? result.error : ''
}

describe('offline scan window (trusted clock)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('accepts a +5 min drifted device on an online checkpoint', async () => {
    const { api } = await prepare({ offsetMs: -5 * MINUTE })
    const deviceNow = SERVER_NOW + 5 * MINUTE
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      null,
      null,
      'web-device-1',
      signedToken({
        mode: 'online',
        checkpoint: 'start',
        validitySeconds: 120,
        gracePeriodMinutes: 0,
      }),
      new Date(deviceNow).toISOString(),
      scanEvidence(deviceNow),
    )

    // The raw device clock is 3 minutes past the 120 s grace window: only the
    // cached `/health` offset makes this a valid scan.
    expect(errorOf(result)).toBe('')
    expect('error' in result).toBe(false)
  })

  it('classifies a -4 min drifted device as present from the trusted clock', async () => {
    const { api } = await prepare({ offsetMs: 5 * MINUTE })
    const deviceNow = SERVER_NOW - 4 * MINUTE
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken({ validityMinutes: 1, gracePeriodMinutes: 10 }),
      new Date(deviceNow).toISOString(),
      scanEvidence(deviceNow),
    )

    // Trusted time lands exactly on validityEnd, so the leg is present while the
    // raw clock (4 minutes before issuedAt) would have expired the window.
    expect(errorOf(result)).toBe('')
    expect('error' in result ? null : result.status).toBe('present')
  })

  it('classifies a drifted device past validityEnd as late, never as expired', async () => {
    const { api } = await prepare({ offsetMs: 5 * MINUTE })
    const deviceNow = SERVER_NOW - 3 * MINUTE
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken({ validityMinutes: 1, gracePeriodMinutes: 10 }),
      new Date(deviceNow).toISOString(),
      scanEvidence(deviceNow),
    )

    expect(errorOf(result)).toBe('')
    expect('error' in result ? null : result.status).toBe('late')
  })

  it('applies the cached offset in checkAttendance too', async () => {
    const { api } = await prepare({ offsetMs: -5 * MINUTE })
    const deviceNow = SERVER_NOW + 5 * MINUTE
    const result = await api.checkAttendance(
      session.id,
      student.id,
      null,
      null,
      signedToken({
        mode: 'online',
        checkpoint: 'start',
        validitySeconds: 120,
        gracePeriodMinutes: 0,
      }),
      new Date(deviceNow).toISOString(),
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe('present')
  })

  it('fails closed with the not-synced message when no clock offset is cached', async () => {
    const { api } = await prepare()
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken(),
      new Date(SERVER_NOW).toISOString(),
      scanEvidence(SERVER_NOW),
    )

    expect(errorOf(result)).toMatch(/Sync before class/)
    expect(errorOf(result)).not.toMatch(/signature/i)
  })

  it('reports not-synced instead of an invalid signature for an unprepared student', async () => {
    const { api } = await prepare({ offsetMs: 0, cacheSession: false })
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken(),
      new Date(SERVER_NOW).toISOString(),
      scanEvidence(SERVER_NOW),
    )

    expect(errorOf(result)).toMatch(/Sync before class/)
    expect(errorOf(result)).not.toMatch(/signature/i)
  })
})

describe('offline scan location policy', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('accepts an 80 m fix (server web policy is 500 m)', async () => {
    const { api } = await prepare({ offsetMs: 0 })
    const deviceNow = SERVER_NOW + 10_000
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken(),
      new Date(deviceNow).toISOString(),
      scanEvidence(deviceNow, { accuracyMeters: 80 }),
    )

    expect(errorOf(result)).toBe('')
    expect('error' in result ? null : result.status).toBe('present')
  })

  it('rejects a 600 m fix', async () => {
    const { api } = await prepare({ offsetMs: 0 })
    const deviceNow = SERVER_NOW + 10_000
    const result = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken(),
      new Date(deviceNow).toISOString(),
      scanEvidence(deviceNow, { accuracyMeters: 600 }),
    )

    expect(errorOf(result)).toMatch(/accuracy is too poor/i)
  })
})

describe('terminal sync failure cleanup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('drops the phantom cached row so the checkpoint can be attempted again', async () => {
    const { api, store } = await prepare({ offsetMs: 0 })
    const optimistic: AttendanceRecord = {
      id: `offline:${session.id}:${student.id}`,
      sessionId: session.id,
      sectionId: session.sectionId,
      studentId: student.id,
      studentName: student.fullName,
      timestamp: new Date(SERVER_NOW).toISOString(),
      status: 'present',
      coordinates: {
        latitude: session.geofence!.latitude,
        longitude: session.geofence!.longitude,
      },
      deviceId: 'web-device-1',
      isSynced: false,
    }
    await store.cacheAttendanceRecords([optimistic])
    await store.enqueueOfflineOperation('attendance_scan', {
      sessionId: session.id,
      studentId: student.id,
      qrToken: 'x'.repeat(90),
      scannedAt: optimistic.timestamp,
      clientAttemptId: 'attempt-pin',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            queued: false,
            results: [{ error: 'Incorrect PIN. 4 attempts remaining.', retryable: false }],
          },
          202,
        ),
      ),
    )

    await api.syncOfflineQueue()

    await expect(store.getCachedAttendanceForSession(session.id)).resolves.toEqual([])

    // The "already saved on this device" guard no longer bricks re-entry.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const retry = await api.submitScan(
      session.id,
      student.id,
      student.fullName,
      session.geofence!.latitude,
      session.geofence!.longitude,
      'web-device-1',
      signedToken(),
      new Date(SERVER_NOW + 10_000).toISOString(),
      scanEvidence(SERVER_NOW + 10_000),
    )
    expect(errorOf(retry)).not.toMatch(/already saved/i)
    expect(errorOf(retry)).toBe('')
  })
})
