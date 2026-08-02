import type { ScanEvidence } from '../src/attendance/types'
import type { QRTokenPayload } from '@polycheck/shared'

// Shared fixture factories for attendance specs. All timestamps are anchored to
// ISSUED_AT (30s in the past at module load) so scans stay inside the ±30s
// stale-location window regardless of when the test runs.

export const VALID_TOKEN = 't'.repeat(100)
export const ISSUED_AT = Date.now() - 30_000 // 30 seconds ago
export const LOCATION_CAPTURED_AT = new Date().toISOString()

export function makeRosterRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Jane Doe',
    studentProgram: 'BSIT',
    timestamp: new Date(ISSUED_AT),
    status: 'pending',
    latitude: 14.6,
    longitude: 121.0,
    deviceId: null,
    tokenSnapshot: null,
    isSynced: true,
    syncedAt: new Date(),
    disputeReason: null,
    disputeDescription: null,
    disputeResolved: false,
    manuallySet: false,
    ...overrides,
  }
}

export function makeCachedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    subjectName: 'CS 101',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofenceLatitude: 14.6,
    geofenceLongitude: 121.0,
    geofenceRadiusMeters: 50,
    isActive: true,
    endedAt: null,
    qrToken: VALID_TOKEN,
    qrTokenExpiresAt: null,
    qrGeneratedAt: new Date(ISSUED_AT).toISOString(),
    teacherPublicKey: 'pk',
    ...overrides,
  }
}

export function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    subjectName: 'CS 101',
    date: '2026-07-14',
    startTime: '10:00',
    endTime: '11:00',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofenceLatitude: 14.6,
    geofenceLongitude: 121.0,
    geofenceRadiusMeters: 50,
    isActive: true,
    endedAt: null,
    qrToken: VALID_TOKEN,
    ...overrides,
  }
}

export function makeEvidence(overrides: Partial<ScanEvidence> = {}): ScanEvidence {
  // locationCapturedAt is anchored to ISSUED_AT + 2s (well within the ±30s
  // stale-location window) so that test timing differences cannot push the age
  // past the threshold and trigger stale_location before the check under test.
  return {
    sessionId: 'sess-1',
    latitude: 14.5863,
    longitude: 121.0,
    qrToken: VALID_TOKEN,
    deviceId: 'device-1',
    clientAttemptId: 'attempt-1',
    accuracyMeters: 10,
    locationCapturedAt: new Date(ISSUED_AT + 2_000).toISOString(),
    scannedAt: new Date(ISSUED_AT).toISOString(),
    inputChannel: 'camera',
    mocked: false,
    ...overrides,
  }
}

export function validPayload(overrides: Record<string, unknown> = {}): QRTokenPayload {
  return {
    version: 1,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    issuedAt: ISSUED_AT,
    validityMinutes: 10,
    gracePeriodMinutes: 5,
    teacherName: 'T',
    ...overrides,
  }
}
