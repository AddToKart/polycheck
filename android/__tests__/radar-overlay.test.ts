/**
 * F2 (WF-LD4) — pure shaping tests for the Android geofence radar overlay.
 *
 * The manual @polycheck/shared mock does not mirror shared's Haversine
 * helper, so this file extends the mock with the identical formula
 * (shared/src/utils/haversine.ts) to exercise the distance fallback.
 */
import type {
  AttendanceAnomalyEvent,
  AttendanceRecord,
  ScanAttemptView,
  SessionFinaleSummary,
} from '@polycheck/shared'
import {
  finaleAttendancePercent,
  formatRadarCounters,
  mapFinaleBanner,
  mergeAnomaly,
  plotableCoordinates,
  radarDistanceCopy,
  resolveRadarDistance,
  shapeRadarOverlay,
} from '../lib/radar-overlay'

jest.mock('@polycheck/shared', () => {
  const mock = jest.requireActual<Record<string, unknown>>('../__mocks__/polycheck-shared')
  return {
    ...mock,
    haversineDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000
      const toRad = (d: number) => (d * Math.PI) / 180
      const a =
        Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    },
  }
})

const GEOFENCE = { latitude: 14.8697, longitude: 120.9991, radiusMeters: 50 }

const students = [
  { id: 'user-1', studentId: '2021-00042' },
  { id: 'user-2', studentId: '2022-00013' },
]

const attempt = (overrides: Partial<ScanAttemptView> & { id: string }): ScanAttemptView => ({
  sessionId: 'sess-1',
  studentId: 'user-1',
  studentName: 'Maria Santos',
  timestamp: '2026-11-02T08:01:14.000Z',
  receivedAt: '2026-11-02T08:01:15.000Z',
  coordinates: { latitude: 14.8697, longitude: 120.9991 },
  outcome: 'accepted',
  ...overrides,
})

const record = (overrides: Partial<AttendanceRecord> & { id: string }): AttendanceRecord => ({
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'user-1',
  studentName: 'Maria Santos',
  timestamp: '2026-11-02T08:01:14.000Z',
  status: 'present',
  coordinates: { latitude: 14.8697, longitude: 120.9991 },
  isSynced: true,
  ...overrides,
})

describe('radarDistanceCopy', () => {
  it('renders the exact denied copy demanded by the plan', () => {
    expect(radarDistanceCopy({ studentNumber: '2021-00042', distanceMeters: 124, denied: true, outsideMeters: 74 }))
      .toBe('2021-00042: 124m away · 74m outside geofence')
  })

  it('renders the inside copy for accepted check-ins', () => {
    expect(radarDistanceCopy({ studentNumber: '2021-00042', distanceMeters: 21, denied: false }))
      .toBe('2021-00042: 21m inside geofence')
  })

  it('falls back to Unknown and never renders a negative outside distance', () => {
    expect(radarDistanceCopy({ studentNumber: '  ', distanceMeters: 30, denied: true, outsideMeters: -5 }))
      .toBe('Unknown: 30m away · 0m outside geofence')
  })

  it('labels missing telemetry instead of inventing a number', () => {
    expect(radarDistanceCopy({ studentNumber: '2021-00042', distanceMeters: null, denied: false }))
      .toBe('2021-00042: verified · no distance telemetry')
  })
})

describe('resolveRadarDistance', () => {
  it('prefers the stored server-computed distance and rounds it', () => {
    expect(resolveRadarDistance(GEOFENCE, 14.8697, 120.9991, 123.6)).toBe(124)
  })

  it('falls back to the shared Haversine math against the geofence centre', () => {
    expect(resolveRadarDistance(GEOFENCE, 14.8697, 120.9991, null)).toBe(0)
    // 0.001° of latitude ≈ 111.19 m.
    expect(resolveRadarDistance(GEOFENCE, 14.8707, 120.9991, null)).toBe(111)
  })

  it('returns null when neither stored telemetry nor a geofence exists', () => {
    expect(resolveRadarDistance(null, 14.8697, 120.9991, null)).toBeNull()
  })
})

describe('plotableCoordinates', () => {
  it('rejects null fixes and the (0,0) manual default', () => {
    expect(plotableCoordinates(null, 120.9991)).toBeNull()
    expect(plotableCoordinates(0, 0)).toBeNull()
    expect(plotableCoordinates(14.8697, 120.9991)).toEqual({ latitude: 14.8697, longitude: 120.9991 })
  })
})

describe('shapeRadarOverlay', () => {
  it('counts accepted attempts inside and keeps the map free of duplicates', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [attempt({ id: 'a-1', outcome: 'accepted', distanceMeters: 21 })],
      records: [record({ id: 'r-1' })],
      students,
    })
    expect(data.insideCount).toBe(1)
    expect(data.deniedCount).toBe(0)
    expect(data.deniedLog).toEqual([])
    // The record pin carries the status colour; the accepted attempt adds none.
    expect(data.mapPins).toHaveLength(1)
    expect(data.mapPins[0]).toMatchObject({ id: 'user-1', status: 'present', label: 'Maria Santos' })
    expect(data.recordPinCount).toBe(1)
  })

  it('shapes a denied attempt into a red pin plus the forensic log entry', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [attempt({ id: 'a-1', outcome: 'denied', distanceMeters: 124, denialReason: 'outside_geofence' })],
      records: [],
      students,
    })
    expect(data.deniedCount).toBe(1)
    expect(data.insideCount).toBe(0)
    expect(data.deniedLog).toHaveLength(1)
    expect(data.deniedLog[0]).toMatchObject({
      key: 'attempt:a-1',
      studentNumber: '2021-00042',
      copy: '2021-00042: 124m away · 74m outside geofence',
      reason: 'outside_geofence',
      source: 'attempt',
    })
    const pin = data.mapPins.find((item) => item.id === 'attempt:a-1')
    expect(pin).toMatchObject({
      status: 'absent',
      label: 'Maria Santos',
      program: '124m away · 74m outside geofence',
      latitude: 14.8697,
      longitude: 120.9991,
    })
  })

  it('computes the distance via the Haversine fallback when telemetry is missing', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [attempt({
        id: 'a-1',
        outcome: 'denied',
        distanceMeters: null,
        coordinates: { latitude: 14.8707, longitude: 120.9991 },
      })],
      records: [],
      students,
    })
    expect(data.deniedLog[0].distanceMeters).toBe(111)
    expect(data.deniedLog[0].copy).toBe('2021-00042: 111m away · 61m outside geofence')
  })

  it('routes attempts without a usable fix into the no-GPS legend', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [
        attempt({ id: 'a-1', outcome: 'denied', coordinates: { latitude: null, longitude: null }, denialReason: 'mocked_location' }),
        attempt({ id: 'a-2', studentId: 'user-2', outcome: 'accepted', coordinates: { latitude: 0, longitude: 0 } }),
      ],
      records: [],
      students,
    })
    expect(data.noGps).toEqual([
      {
        key: 'attempt:a-1',
        studentId: 'user-1',
        studentName: 'Maria Santos',
        studentNumber: '2021-00042',
        denied: true,
        reason: 'mocked_location',
      },
      {
        key: 'attempt:a-2',
        studentId: 'user-2',
        studentName: 'Maria Santos',
        studentNumber: '2022-00013',
        denied: false,
        reason: null,
      },
    ])
    expect(data.mapPins).toEqual([])
    expect(data.deniedCount).toBe(1)
  })

  it('keeps every denial visible in the count while a retried student checks in', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [
        attempt({ id: 'a-1', outcome: 'denied', distanceMeters: 900 }),
        attempt({ id: 'a-2', outcome: 'accepted', distanceMeters: 12 }),
      ],
      records: [record({ id: 'r-1' })],
      students,
    })
    // One student inside (deduped across attempt + record), two denial events.
    expect(data.insideCount).toBe(1)
    expect(data.deniedCount).toBe(1)
    expect(data.deniedLog).toHaveLength(1)
    expect(data.mapPins).toHaveLength(2)
  })

  it('counts only accepted record statuses toward Inside', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [],
      records: [
        record({ id: 'r-1', studentId: 'user-1', status: 'disputed' }),
        record({ id: 'r-2', studentId: 'user-2', status: 'late' }),
      ],
      students,
    })
    expect(data.recordPinCount).toBe(2)
    expect(data.mapPins).toHaveLength(2)
    expect(data.insideCount).toBe(1)
  })
})

describe('formatRadarCounters', () => {
  it('renders the header counter copy', () => {
    expect(formatRadarCounters(30, 2)).toBe('Inside: 30 · Denied: 2')
  })
})

describe('mergeAnomaly', () => {
  const anomaly: AttendanceAnomalyEvent = {
    sessionId: 'sess-1',
    studentId: 'user-1',
    studentName: 'Maria Santos',
    studentNumber: '2021-00042',
    latitude: 14.8707,
    longitude: 120.9991,
    distanceMeters: 124,
    geofenceRadiusMeters: 50,
    reason: 'outside_geofence',
    timestamp: '2026-11-02T08:05:00.000Z',
  }

  it('appends a new anomaly', () => {
    expect(mergeAnomaly([], anomaly)).toHaveLength(1)
  })

  it('dedupes socket replays of the same event', () => {
    const once = mergeAnomaly([], anomaly)
    expect(mergeAnomaly(once, anomaly)).toBe(once)
  })

  it('keeps distinct events from the same student', () => {
    const retry = { ...anomaly, timestamp: '2026-11-02T08:06:00.000Z' }
    expect(mergeAnomaly([anomaly], retry)).toHaveLength(2)
  })
})

describe('live anomaly shaping', () => {
  it('appends a red entry instantly from an attendance:anomaly broadcast', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [],
      records: [],
      students,
      anomalies: [{
        sessionId: 'sess-1',
        studentId: 'user-1',
        studentName: 'Maria Santos',
        studentNumber: '2021-00042',
        latitude: 14.8707,
        longitude: 120.9991,
        distanceMeters: 124,
        geofenceRadiusMeters: 50,
        reason: 'outside_geofence',
        timestamp: '2026-11-02T08:05:00.000Z',
      }],
    })
    expect(data.deniedCount).toBe(1)
    expect(data.deniedLog[0]).toMatchObject({
      key: 'anomaly:user-1:0',
      copy: '2021-00042: 124m away · 74m outside geofence',
      source: 'anomaly',
    })
    expect(data.mapPins[0]).toMatchObject({ status: 'absent', id: 'anomaly:user-1:0' })
  })

  it('lands a coordinate-less anomaly in the no-GPS legend', () => {
    const data = shapeRadarOverlay({
      geofence: GEOFENCE,
      attempts: [],
      records: [],
      students,
      anomalies: [{
        sessionId: 'sess-1',
        studentId: 'user-2',
        latitude: null,
        longitude: null,
        reason: 'duplicate_token',
        timestamp: '2026-11-02T08:05:00.000Z',
      }],
    })
    expect(data.noGps[0]).toMatchObject({ studentId: 'user-2', denied: true, reason: 'duplicate_token' })
    expect(data.mapPins).toEqual([])
  })
})

describe('finale banner mapping', () => {
  const counts = { present: 30, late: 6, absent: 4, excused: 3, incomplete: 2, disputed: 1, pending: 0 }

  it('computes the standing-policy rate: (present+late) / (that + incomplete + absent)', () => {
    expect(finaleAttendancePercent(counts)).toBe(86)
  })

  it('returns null before any evaluated row exists', () => {
    expect(finaleAttendancePercent({ present: 0, late: 0, absent: 0, excused: 5, incomplete: 0, disputed: 2, pending: 1 })).toBeNull()
  })

  it('maps the broadcast into the banner view model', () => {
    const summary: SessionFinaleSummary = { sessionId: 'sess-1', endedAt: '2026-11-02T09:35:00.000Z', counts, capacity: 42 }
    expect(mapFinaleBanner(summary)).toEqual({
      endedAt: '2026-11-02T09:35:00.000Z',
      capacity: 42,
      counts,
      rate: 86,
      rateLabel: '86%',
    })
  })

  it('renders an em-dash rate when nothing is evaluated', () => {
    const summary: SessionFinaleSummary = {
      sessionId: 'sess-1',
      endedAt: '2026-11-02T09:35:00.000Z',
      counts: { present: 0, late: 0, absent: 0, excused: 0, incomplete: 0, disputed: 0, pending: 0 },
      capacity: 0,
    }
    expect(mapFinaleBanner(summary).rateLabel).toBe('—')
  })
})
