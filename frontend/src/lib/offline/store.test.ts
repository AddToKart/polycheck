import { beforeEach, describe, expect, it } from 'vitest'
import type { AttendanceRecord, Section, Session, Student, Subject } from '@polycheck/shared'
import {
  cacheAttendanceRecords,
  cacheRoster,
  cacheSections,
  cacheSessions,
  cacheSubjects,
  drainOfflineQueue,
  enqueueOfflineOperation,
  getCachedAttendanceForSession,
  getCachedAttendanceRecords,
  getCachedRoster,
  getCachedSections,
  getCachedSessions,
  getCachedSubjects,
  getEnrolledSectionIds,
  getOfflineQueueIssues,
  getPendingSyncCount,
  getServerClockOffset,
  initializeOfflineStore,
  removeCachedAttendanceLeg,
  replaceCachedAttendanceForStudent,
  retryOfflineOperation,
  setEnrolledSectionIds,
  setServerClockOffset,
  wipeOfflineStore,
} from './store'
import { decryptValue, encryptValue } from './crypto'
import { getOfflineDatabase } from './db'

const subject: Subject = {
  id: 'subj-1',
  name: 'Software Engineering',
  code: 'SE101',
  description: 'Testing',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const section: Section = {
  id: 'sec-1',
  subjectId: 'subj-1',
  section: 'BSIT 3-1',
  room: 'Room 101',
  schedule: [],
  semester: '2026-1',
  teacherId: 'teacher-1',
  teacherName: 'Teacher One',
  studentCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const session: Session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  mode: 'in_person',
  date: '2026-10-26',
  startTime: '09:00',
  endTime: '10:00',
  qrValidityMinutes: 5,
  gracePeriodMinutes: 10,
  geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
  isActive: false,
  teacherId: 'teacher-1',
  createdAt: '2026-10-26T00:00:00.000Z',
}

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

const record: AttendanceRecord = {
  id: 'offline:sess-1:student-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  studentName: 'Juan Dela Cruz',
  timestamp: '2026-10-26T01:00:00.000Z',
  status: 'present',
  coordinates: { latitude: 14.8697, longitude: 120.9991 },
  deviceId: 'web-device',
  isSynced: false,
}

async function resetStore(ownerId = 'user-1') {
  await wipeOfflineStore()
  await initializeOfflineStore(ownerId)
}

describe('offline store', () => {
  beforeEach(async () => {
    await resetStore()
  })

  it('round-trips subjects and keeps plaintext out of IndexedDB', async () => {
    await cacheSubjects([subject])
    await expect(getCachedSubjects()).resolves.toEqual([subject])

    const db = await getOfflineDatabase()
    const raw = await db.get('subjects', subject.id)
    expect(raw?.payload.data).not.toContain('Software Engineering')
    expect(JSON.stringify(raw)).not.toContain('Software Engineering')
  })

  it('round-trips sections, sessions and roster entries', async () => {
    await cacheSections([section])
    await cacheSessions([session])
    await cacheRoster('sec-1', [student])

    await expect(getCachedSections()).resolves.toEqual([section])
    await expect(getCachedSessions('sec-1')).resolves.toEqual([session])
    await expect(getCachedSessions('other')).resolves.toEqual([])
    await expect(getCachedRoster('sec-1')).resolves.toEqual([student])
  })

  it('keeps unsynced attendance when server records are replaced', async () => {
    await cacheAttendanceRecords([record])
    await replaceCachedAttendanceForStudent('student-1', [])
    const cached = await getCachedAttendanceRecords('student-1')
    expect(cached).toEqual([record])
  })

  it('persists enrollment scope and a 7-day clock offset', async () => {
    await setEnrolledSectionIds(['sec-1'])
    await expect(getEnrolledSectionIds()).resolves.toEqual(['sec-1'])
    await setServerClockOffset(1234)
    await expect(getServerClockOffset()).resolves.toBe(1234)
  })

  it('wipes prior-owner data when a different account signs in', async () => {
    await cacheSubjects([subject])
    await initializeOfflineStore('user-2')
    await expect(getCachedSubjects()).resolves.toEqual([])
  })

  it('deduplicates queue entries by kind + clientAttemptId', async () => {
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-1', clientAttemptId: 'attempt-1' })
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-1', clientAttemptId: 'attempt-1' })
    await expect(getPendingSyncCount()).resolves.toBe(1)
  })

  it('removes synced entries and preserves terminal failures for review', async () => {
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-1', clientAttemptId: 'ok' })
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-1', clientAttemptId: 'bad' })

    await drainOfflineQueue(async (_kind, payload) =>
      payload.clientAttemptId === 'ok'
        ? { outcome: 'synced' as const }
        : { outcome: 'terminal' as const, error: 'Signature is invalid' },
    )

    await expect(getPendingSyncCount()).resolves.toBe(0)
    const issues = await getOfflineQueueIssues()
    expect(issues).toHaveLength(1)
    expect(issues[0].failed).toBe(true)
    expect(issues[0].error).toBe('Signature is invalid')

    await retryOfflineOperation(issues[0].id)
    await drainOfflineQueue(async () => ({ outcome: 'synced' as const }))
    await expect(getOfflineQueueIssues()).resolves.toEqual([])
  })

  it('keeps draining past a retryable row so the evidence behind it still syncs', async () => {
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-1', clientAttemptId: 'retry' })
    await enqueueOfflineOperation('attendance_scan', { sessionId: 'sess-2', clientAttemptId: 'ok' })

    await drainOfflineQueue(async (_kind, payload) =>
      payload.clientAttemptId === 'retry'
        ? { outcome: 'retryable' as const, error: 'Service unavailable' }
        : { outcome: 'synced' as const },
    )

    // The retryable row is kept for the next attempt; the row queued behind it
    // is not blocked by it.
    await expect(getPendingSyncCount()).resolves.toBe(1)
    const issues = await getOfflineQueueIssues()
    expect(issues).toHaveLength(1)
    expect(issues[0].error).toBe('Service unavailable')
    expect(issues[0].failed).toBe(false)
  })
})

// ── WEB-01: one AES key per account even under concurrent first writes ───────

describe('offline store per-account key (WEB-01)', () => {
  beforeEach(async () => {
    await wipeOfflineStore()
    await initializeOfflineStore('user-1')
  })

  it('encrypts 20 concurrent values with a single key that decrypts them all', async () => {
    const db = await getOfflineDatabase()
    const envelopes = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        encryptValue(db, 'user-1', { index, seed: `value-${index}` }),
      ),
    )

    const decrypted = await Promise.all(
      envelopes.map((envelope) => decryptValue<{ index: number }>(db, 'user-1', envelope)),
    )
    expect(decrypted.map((value) => value.index)).toEqual(Array.from({ length: 20 }, (_, i) => i))

    // A single persisted key row and no raw-key fallback row flip-flopping.
    const stored = await db.getAll('crypto_keys')
    expect(stored).toHaveLength(1)
    expect(stored[0].ownerId).toBe('user-1')
  })

  it('shares one key creation across cache groups written in the same tick', async () => {
    const db = await getOfflineDatabase()
    const before = await db.getAll('crypto_keys')
    expect(before).toHaveLength(1)

    // Two different cache groups encrypt concurrently right after a fresh
    // owner init; both must use the key `initializeOfflineStore` already
    // seeded (no second generation path).
    const [subjectEnvelope, recordEnvelope] = await Promise.all([
      encryptValue(db, 'user-1', subject),
      encryptValue(db, 'user-1', record),
    ])

    const after = await db.getAll('crypto_keys')
    expect(after).toHaveLength(1)
    expect(after[0].createdAt).toBe(before[0].createdAt)
    await expect(decryptValue(db, 'user-1', subjectEnvelope)).resolves.toEqual(subject)
    await expect(decryptValue(db, 'user-1', recordEnvelope)).resolves.toEqual(record)
  })

  it('reuses an existing persisted raw-key fallback instead of regenerating', async () => {
    const db = await getOfflineDatabase()
    // Simulate an engine that had to persist raw bytes (legacy / partial impl).
    const raw = crypto.getRandomValues(new Uint8Array(32))
    const base64 = btoa(String.fromCharCode(...raw))
    await db.put('crypto_keys', { ownerId: 'user-raw', rawKey: base64, createdAt: '2026-01-01' })

    const first = await encryptValue(db, 'user-raw', { ok: true })
    const rows = await db.getAll('crypto_keys')
    expect(rows.filter((row) => row.ownerId === 'user-raw')).toHaveLength(1)
    expect(rows.find((row) => row.ownerId === 'user-raw')?.rawKey).toBe(base64)
    await expect(decryptValue(db, 'user-raw', first)).resolves.toEqual({ ok: true })
  })

  /**
   * The seed-on-init guard alone is not the fix: a brand-new owner (an account
   * whose `initializeOfflineStore` bind was lost to a reload, or a second tab)
   * can reach `encryptValue` with no persisted key at all. Without the
   * module-level in-flight map, both callers run generate→put and the loser's
   * ciphertext is permanently undecryptable.
   */
  it('creates exactly one key when two unseeded callers encrypt concurrently', async () => {
    const db = await getOfflineDatabase()
    await expect(db.getAll('crypto_keys')).resolves.toEqual(
      expect.not.arrayContaining([expect.objectContaining({ ownerId: 'fresh-owner' })]),
    )

    const [first, second] = await Promise.all([
      encryptValue(db, 'fresh-owner', { which: 'first' }),
      encryptValue(db, 'fresh-owner', { which: 'second' }),
    ])

    // One key row, and BOTH envelopes decrypt: the second caller must not have
    // replaced the key the first caller encrypted under.
    const rows = (await db.getAll('crypto_keys')).filter((row) => row.ownerId === 'fresh-owner')
    expect(rows).toHaveLength(1)
    await expect(decryptValue(db, 'fresh-owner', first)).resolves.toEqual({ which: 'first' })
    await expect(decryptValue(db, 'fresh-owner', second)).resolves.toEqual({ which: 'second' })
  })

  it('reuses one key across twenty unseeded concurrent writers', async () => {
    const db = await getOfflineDatabase()
    const envelopes = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        encryptValue(db, 'fresh-burst', { index }),
      ),
    )

    const rows = (await db.getAll('crypto_keys')).filter((row) => row.ownerId === 'fresh-burst')
    expect(rows).toHaveLength(1)
    const decrypted = await Promise.all(
      envelopes.map((envelope) => decryptValue<{ index: number }>(db, 'fresh-burst', envelope)),
    )
    expect(decrypted.map((value) => value.index)).toEqual(
      Array.from({ length: 20 }, (_, index) => index),
    )
  })
})

// ── WEB-12: leg-scoped optimistic row deletion ───────────────────────────────

describe('removeCachedAttendanceLeg (WEB-12)', () => {
  beforeEach(async () => {
    await wipeOfflineStore()
    await initializeOfflineStore('student-1')
  })

  const startLeg: AttendanceRecord = {
    ...record,
    id: 'offline:sess-1:student-1:start',
    checkInTime: '2026-10-26T01:00:00.000Z',
    checkInStatus: 'present',
  }
  const endLeg: AttendanceRecord = {
    ...record,
    id: 'offline:sess-1:student-1:end',
    checkOutTime: '2026-10-26T03:00:00.000Z',
    checkOutStatus: 'present',
  }

  it('deletes only the drained checkpoint and leaves the sibling leg visible', async () => {
    await cacheAttendanceRecords([startLeg, endLeg])

    await removeCachedAttendanceLeg('sess-1', 'student-1', { checkpoint: 'start' })

    const remaining = await getCachedAttendanceForSession('sess-1')
    expect(remaining.map((entry) => entry.id)).toEqual(['offline:sess-1:student-1:end'])
  })

  it('uses the record id from the queue payload when present', async () => {
    await cacheAttendanceRecords([startLeg, endLeg])

    await removeCachedAttendanceLeg('sess-1', 'student-1', { recordId: endLeg.id })

    const remaining = await getCachedAttendanceForSession('sess-1')
    expect(remaining.map((entry) => entry.id)).toEqual([startLeg.id])
  })

  it('deletes the single-leg (in-person) optimistic row when no checkpoint applies', async () => {
    await cacheAttendanceRecords([record])

    await removeCachedAttendanceLeg('sess-1', 'student-1')

    await expect(getCachedAttendanceForSession('sess-1')).resolves.toEqual([])
  })
})
