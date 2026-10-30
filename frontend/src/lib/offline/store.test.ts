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
  replaceCachedAttendanceForStudent,
  retryOfflineOperation,
  setEnrolledSectionIds,
  setServerClockOffset,
  wipeOfflineStore,
} from './store'
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
})
