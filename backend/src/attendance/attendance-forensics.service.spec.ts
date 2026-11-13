import { NotFoundException } from '@nestjs/common'
import { AttendanceForensicsService } from './attendance-forensics.service'
import type { RequestUser } from '../auth/authenticated-principal'

jest.mock('@polycheck/shared', () => ({
  decodeTokenPayload: jest.fn(),
}))

jest.mock('@polycheck/shared/token-node', () => ({
  verifyQRTokenNative: jest.fn(),
}))

import { decodeTokenPayload } from '@polycheck/shared'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'

const mockedDecode = decodeTokenPayload as jest.MockedFunction<typeof decodeTokenPayload>
const mockedVerify = verifyQRTokenNative as jest.MockedFunction<typeof verifyQRTokenNative>

const T0 = Date.parse('2026-07-14T01:00:00.000Z')
const BASE_PAYLOAD = {
  version: 1,
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  issuedAt: T0,
  validityMinutes: 10,
  gracePeriodMinutes: 5,
  teacherName: 'T',
  mode: 'in_person',
  pinRequired: false,
}

function makeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    clientAttemptId: 'attempt-1',
    sessionId: 'sess-1',
    studentId: 'stu-1',
    timestamp: new Date(T0 + 60_000),
    clientScannedAt: new Date(T0 + 60_000),
    receivedAt: new Date(T0 + 60_000),
    locationCapturedAt: null,
    latitude: 14.6,
    longitude: 121,
    accuracyMeters: 10,
    mocked: false,
    inputChannel: 'camera',
    checkpoint: null,
    pinVerified: null,
    deviceId: 'device-4f2a',
    offline: false,
    distanceMeters: 12,
    geofenceRadiusMeters: 50,
    riskSignals: [],
    outcome: 'present',
    reason: null,
    message: null,
    tokenHash: 'x'.repeat(64),
    createdAt: new Date(T0 + 60_100),
    ...overrides,
  }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Jane Doe',
    timestamp: new Date(T0 + 60_000),
    status: 'present',
    latitude: 14.6,
    longitude: 121,
    checkInTime: null,
    checkInStatus: null,
    checkOutTime: null,
    checkOutStatus: null,
    checkInToken: null,
    checkOutToken: null,
    deviceId: 'device-4f2a',
    tokenSnapshot: 'valid-token',
    isSynced: true,
    syncedAt: new Date(T0 + 60_100),
    disputeReason: null,
    disputeDescription: null,
    disputeResolved: false,
    manuallySet: false,
    createdAt: new Date(T0 + 60_100),
    updatedAt: new Date(T0 + 60_100),
    acceptedScanAttemptId: 'attempt-1',
    acceptedScanAttempt: makeAttempt({ outcome: 'present' }),
    checkInAttemptId: null,
    checkInAttempt: null,
    checkOutAttemptId: null,
    checkOutAttempt: null,
    session: {
      id: 'sess-1',
      teacherId: 'teacher-1',
      mode: 'in_person',
      date: '2026-07-14',
      startTime: '10:00',
      endTime: '11:00',
      qrGeneratedAt: new Date(T0),
      startQrGeneratedAt: null,
      endQrGeneratedAt: null,
      geofenceRadiusMeters: 50,
    },
    ...overrides,
  }
}

const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }

function makeHarness(
  options: {
    record?: ReturnType<typeof makeRecord> | null
    attempts?: ReturnType<typeof makeAttempt>[]
    teacherKey?: unknown
  } = {},
) {
  const record = options.record !== undefined ? options.record : makeRecord()
  const attempts = options.attempts ?? [makeAttempt({ outcome: 'present' })]
  const prisma = {
    attendanceRecord: { findFirst: jest.fn().mockResolvedValue(record) },
    scanAttempt: { findMany: jest.fn().mockResolvedValue(attempts) },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.teacherKey !== undefined ? options.teacherKey : { teacherPublicKey: 'pk' }),
    },
  }
  const scope = { recordScope: jest.fn().mockResolvedValue({}) }
  return { service: new AttendanceForensicsService(prisma as never, scope as never), prisma, scope, record }
}

beforeEach(() => {
  mockedDecode.mockReset().mockReturnValue(BASE_PAYLOAD as never)
  mockedVerify.mockReset().mockReturnValue({ ...BASE_PAYLOAD, issuedAt: T0 } as never)
})

describe('AttendanceForensicsService.buildTimeline', () => {
  it('assembles events from activation, signature, attempt, queue and sync sources in order', async () => {
    const record = makeRecord({
      syncedAt: new Date(T0 + 30 * 60_000),
      createdAt: new Date(T0 + 30 * 60_000),
    })
    const { service } = makeHarness({
      record,
      attempts: [
        makeAttempt({
          offline: true,
          clientScannedAt: new Date(T0 + 60_000),
          receivedAt: new Date(T0 + 30 * 60_000),
        }),
      ],
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    const kinds = timeline.events.map((event) => event.kind)
    expect(kinds).toEqual(['activation', 'signature', 'scan', 'queue', 'network', 'sync'])
    const signature = timeline.events.find((event) => event.kind === 'signature')
    expect(signature?.at).toBe(new Date(T0).toISOString())
    expect(signature?.label).toBe('Local ED25519 signature generated')
    const queue = timeline.events.find((event) => event.kind === 'queue')
    expect(queue?.detail?.receiptId).toBe('attempt-')
    const scanEvent = timeline.events.find((event) => event.kind === 'scan')
    expect(scanEvent?.detail?.deviceIdMasked).toBe('…4f2a')
  })

  it('emits separate online checkpoint activations and neutralises coordinate detail', async () => {
    const record = makeRecord({
      session: {
        ...makeRecord().session,
        mode: 'online',
        qrGeneratedAt: null,
        startQrGeneratedAt: new Date(T0),
        endQrGeneratedAt: new Date(T0 + 45 * 60_000),
      },
      latitude: null,
      longitude: null,
      acceptedScanAttempt: null,
      acceptedScanAttemptId: null,
      checkInAttemptId: 'attempt-1',
      checkInAttempt: makeAttempt({
        checkpoint: 'start',
        pinVerified: true,
        distanceMeters: null,
        geofenceRadiusMeters: null,
      }),
      tokenSnapshot: null,
    })
    const { service } = makeHarness({
      record,
      attempts: [
        makeAttempt({ checkpoint: 'start', pinVerified: true, distanceMeters: null, geofenceRadiusMeters: null }),
      ],
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    const activations = timeline.events.filter((event) => event.kind === 'activation')
    expect(activations.map((event) => event.label)).toEqual([
      'Check-in checkpoint armed (zero-GPS window)',
      'Check-out checkpoint armed (zero-GPS window)',
    ])
    const scan = timeline.events.find((event) => event.kind === 'scan')
    expect(scan?.detail?.pinVerified).toBe(true)
    expect(scan?.detail?.insideGeofence).toBeUndefined()
  })

  it('sorts by ascending time and drops identical (at, kind) events', async () => {
    const { service } = makeHarness({
      attempts: [
        makeAttempt({ timestamp: new Date(T0 + 60_000), clientScannedAt: new Date(T0 + 60_000) }),
        makeAttempt({ id: 'attempt-2', timestamp: new Date(T0 + 60_000), clientScannedAt: new Date(T0 + 60_000) }),
      ],
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    const scanEvents = timeline.events.filter((event) => event.kind === 'scan')
    expect(scanEvents).toHaveLength(1)
    for (let index = 1; index < timeline.events.length; index += 1) {
      expect(new Date(timeline.events[index].at).getTime()).toBeGreaterThanOrEqual(
        new Date(timeline.events[index - 1].at).getTime(),
      )
    }
  })

  it('caps the timeline at 200 events', async () => {
    const attempts = Array.from({ length: 260 }, (_, index) =>
      makeAttempt({
        id: `attempt-${index}`,
        clientAttemptId: `attempt-${index}`,
        offline: true,
        timestamp: new Date(T0 + index * 1000),
        clientScannedAt: new Date(T0 + index * 1000),
      }),
    )
    const { service } = makeHarness({ attempts })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.events).toHaveLength(200)
  })

  it('denies records outside the caller scope and unknown records', async () => {
    const scope = { recordScope: jest.fn().mockResolvedValue({ id: { in: [] } }) }
    const prisma = {
      attendanceRecord: { findFirst: jest.fn().mockResolvedValue(null) },
      scanAttempt: { findMany: jest.fn() },
      user: { findUnique: jest.fn() },
    }
    const service = new AttendanceForensicsService(prisma as never, scope as never)

    await expect(service.buildTimeline(teacherUser, 'rec-other')).rejects.toThrow(NotFoundException)
    expect(prisma.attendanceRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ id: 'rec-other' }, { id: { in: [] } }] } }),
    )
    expect(prisma.scanAttempt.findMany).not.toHaveBeenCalled()
  })
})

describe('AttendanceForensicsService recommendation matrix', () => {
  it('recommends accept on a clean cryptographic proof (in-person)', async () => {
    const { service } = makeHarness()

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation).toEqual({
      verdict: 'accept',
      rationale: 'Cryptographic proof confirms student presence at 01:01:00',
    })
  })

  it('recommends accept for a verified online zero-GPS check-in with the PIN verified', async () => {
    mockedDecode.mockReturnValue({
      ...BASE_PAYLOAD,
      mode: 'online',
      checkpoint: 'start',
      validitySeconds: 120,
      gracePeriodMinutes: 0,
      pinRequired: true,
    } as never)
    mockedVerify.mockReturnValue({ ...BASE_PAYLOAD, issuedAt: T0 } as never)
    const legAttempt = makeAttempt({
      checkpoint: 'start',
      pinVerified: true,
      distanceMeters: null,
      geofenceRadiusMeters: null,
    })
    const { service } = makeHarness({
      attempts: [legAttempt],
      record: makeRecord({
        status: 'pending',
        latitude: null,
        longitude: null,
        checkInToken: 'valid-token',
        session: { ...makeRecord().session, mode: 'online', geofenceRadiusMeters: null },
        acceptedScanAttempt: null,
        acceptedScanAttemptId: null,
        checkInAttemptId: 'attempt-1',
        checkInAttempt: legAttempt,
        tokenSnapshot: null,
      }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation).toEqual({
      verdict: 'accept',
      rationale: 'Cryptographic proof confirms student presence at 01:01:00',
    })
  })

  it('rejects on mocked GPS evidence', async () => {
    const { service } = makeHarness({
      attempts: [makeAttempt({ mocked: true, outcome: 'flagged' })],
      record: makeRecord({
        acceptedScanAttempt: makeAttempt({ mocked: true, outcome: 'flagged' }),
        status: 'disputed',
      }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('reject')
    expect(timeline.recommendation.rationale).toContain('Mocked GPS evidence')
  })

  it('rejects on the concurrent-session conflict reason', async () => {
    const { service } = makeHarness({
      record: makeRecord({ disputeReason: 'concurrent_session_conflict' }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('reject')
    expect(timeline.recommendation.rationale).toContain('concurrent session')
  })

  it('reviews accepted scans that sit outside the geofence', async () => {
    const { service } = makeHarness({
      attempts: [makeAttempt({ distanceMeters: 80, geofenceRadiusMeters: 50, outcome: 'present' })],
      record: makeRecord({ acceptedScanAttempt: makeAttempt({ distanceMeters: 80, geofenceRadiusMeters: 50 }) }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('80m outside the 50m geofence')
  })

  it('reviews accepted scans with no stored geofence distance', async () => {
    const { service } = makeHarness({
      attempts: [makeAttempt({ distanceMeters: null })],
      record: makeRecord({ acceptedScanAttempt: makeAttempt({ distanceMeters: null }) }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('Geofence distance is unavailable')
  })

  it('reviews weak GPS accuracy even when the scan was accepted', async () => {
    const { service } = makeHarness({
      attempts: [makeAttempt({ accuracyMeters: 140, distanceMeters: null })],
      record: makeRecord({ acceptedScanAttempt: makeAttempt({ accuracyMeters: 140, distanceMeters: null }) }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('GPS accuracy of 140m')
  })

  it('reviews stale offline evidence that arrived long after the scan', async () => {
    const { service } = makeHarness({
      attempts: [
        makeAttempt({ offline: true, clientScannedAt: new Date(T0 + 60_000), receivedAt: new Date(T0 + 45 * 60_000) }),
      ],
      record: makeRecord({
        acceptedScanAttempt: makeAttempt({
          offline: true,
          clientScannedAt: new Date(T0 + 60_000),
          receivedAt: new Date(T0 + 45 * 60_000),
        }),
      }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('44 minutes after the scan')
  })

  it('reviews records without any accepted scan attempt', async () => {
    const { service } = makeHarness({
      attempts: [],
      record: makeRecord({ acceptedScanAttempt: null, acceptedScanAttemptId: null }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('No accepted scan attempt')
  })

  it('reviews manually set records that carry no scan evidence', async () => {
    const { service } = makeHarness({
      attempts: [],
      record: makeRecord({
        acceptedScanAttempt: null,
        acceptedScanAttemptId: null,
        manuallySet: true,
        tokenSnapshot: null,
      }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('set manually')
  })

  it('reviews records with no signed token', async () => {
    mockedDecode.mockReturnValue(null)
    const { service } = makeHarness({ record: makeRecord({ tokenSnapshot: null }) })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('No signed QR token')
  })

  it('reviews records whose signature fails against the teacher key', async () => {
    mockedVerify.mockReturnValue(null)
    const { service } = makeHarness()

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('failed verification')
  })

  it('reviews tokens that do not belong to the record session', async () => {
    mockedDecode.mockReturnValue({ ...BASE_PAYLOAD, sessionId: 'sess-other' } as never)
    const { service } = makeHarness()

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('does not belong to this session')
  })

  it('reviews when the teacher signing key is unavailable', async () => {
    const { service } = makeHarness({ teacherKey: null })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('signing key is unavailable')
  })

  it('reviews scans that fell outside the signed validity window', async () => {
    const { service } = makeHarness({
      attempts: [makeAttempt({ timestamp: new Date(T0 + 20 * 60_000) })],
      record: makeRecord({ acceptedScanAttempt: makeAttempt({ timestamp: new Date(T0 + 20 * 60_000) }) }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('validity window')
  })

  it('reviews other persisted dispute reasons instead of rubber-stamping', async () => {
    const { service } = makeHarness({
      record: makeRecord({ disputeReason: 'suspicious_coordinates', status: 'disputed' }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
    expect(timeline.recommendation.rationale).toContain('suspicious_coordinates')
  })

  it('falls back to review when nothing conclusive but nothing conflicting exists', async () => {
    const { service } = makeHarness({
      attempts: [],
      record: makeRecord({
        acceptedScanAttempt: null,
        acceptedScanAttemptId: null,
        tokenSnapshot: null as unknown as string,
      }),
    })

    const timeline = await service.buildTimeline(teacherUser, 'rec-1')

    expect(timeline.recommendation.verdict).toBe('review')
  })
})
