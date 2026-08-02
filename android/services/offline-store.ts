import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import type { AttendanceRecord, Section, Session, Subject } from '@polycheck/shared'
import { decryptOfflineValue, encryptOfflineValue } from './offline-crypto'

export type OfflineOperationKind = 'attendance_scan' | 'scan_attempt' | 'session_activation' | 'session_end'
export type OfflineSendResult =
  | { outcome: 'synced' }
  | { outcome: 'retryable' | 'terminal'; error: string }

type QueueRow = {
  id: string
  kind: OfflineOperationKind
  payload: string
  attempts: number
}

let databasePromise: Promise<SQLite.SQLiteDatabase | null> | null = null
let drainPromise: Promise<void> | null = null
let activeOwnerId: string | null = null

const database = () => {
  if (Platform.OS === 'web') return Promise.resolve(null)
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('polycheck.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cached_subjects_v2 (
          owner_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, cached_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE TABLE IF NOT EXISTS cached_sections_v2 (
          owner_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, cached_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE TABLE IF NOT EXISTS cached_sessions_v2 (
          owner_id TEXT NOT NULL, id TEXT NOT NULL, section_id TEXT NOT NULL,
          payload TEXT NOT NULL, cached_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE INDEX IF NOT EXISTS cached_sessions_v2_section_idx
          ON cached_sessions_v2(owner_id, section_id);
        CREATE TABLE IF NOT EXISTS cached_attendance_v2 (
          owner_id TEXT NOT NULL, id TEXT NOT NULL, student_id TEXT NOT NULL,
          section_id TEXT NOT NULL, session_id TEXT NOT NULL, is_synced INTEGER NOT NULL,
          payload TEXT NOT NULL, cached_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE INDEX IF NOT EXISTS cached_attendance_v2_student_idx
          ON cached_attendance_v2(owner_id, student_id);
        CREATE INDEX IF NOT EXISTS cached_attendance_v2_section_idx
          ON cached_attendance_v2(owner_id, section_id);
        CREATE INDEX IF NOT EXISTS cached_attendance_v2_session_idx
          ON cached_attendance_v2(owner_id, session_id);
        CREATE TABLE IF NOT EXISTS sync_queue_v2 (
          owner_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE TABLE IF NOT EXISTS sync_metadata_v2 (
          owner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, key)
        );
      `)
      return db
    })
  }
  return databasePromise
}

const owner = () => activeOwnerId

const requireOwner = () => {
  const value = owner()
  if (!value) throw new Error('Offline storage requires an authenticated account')
  return value
}

const migrateLegacyData = async (db: SQLite.SQLiteDatabase) => {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version').catch(() => null)
  if ((version?.user_version ?? 0) >= 2) return

  // V1 rows had no account owner and contained plaintext. Assigning them to
  // whichever account signs in first could expose another user's class data or
  // submit their queued scan. Drop them and require a fresh authenticated
  // pre-sync instead of guessing ownership.
  await db.execAsync(`
    DROP TABLE IF EXISTS cached_sections;
    DROP TABLE IF EXISTS cached_sessions;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS sync_metadata;
    PRAGMA user_version = 2;
  `)
}

export const setOfflineOwner = (ownerId: string | null) => {
  activeOwnerId = ownerId
}

export const initializeOfflineStore = async (ownerId: string) => {
  setOfflineOwner(ownerId)
  const db = await database()
  if (db) await migrateLegacyData(db)
}

export const cacheSubjects = async (subjects: Subject[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const subject of subjects) {
      await db.runAsync(
        `INSERT INTO cached_subjects_v2 (owner_id, id, payload, cached_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(owner_id, id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
        ownerId,
        subject.id,
        await encryptOfflineValue(subject),
        cachedAt,
      )
    }
  })
}

export const getCachedSubjects = async (): Promise<Subject[]> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return []
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM cached_subjects_v2 WHERE owner_id = ? ORDER BY cached_at DESC',
    ownerId,
  )
  return Promise.all(rows.map((row) => decryptOfflineValue<Subject>(row.payload)))
}

export const getCachedSubject = async (id: string): Promise<Subject | null> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return null
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM cached_subjects_v2 WHERE owner_id = ? AND id = ?',
    ownerId,
    id,
  )
  return row ? decryptOfflineValue<Subject>(row.payload) : null
}

export const replaceCachedSubjects = async (subjects: Subject[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  await db.runAsync('DELETE FROM cached_subjects_v2 WHERE owner_id = ?', ownerId)
  await cacheSubjects(subjects)
}

export const cacheSections = async (sections: Section[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const section of sections) {
      await db.runAsync(
        `INSERT INTO cached_sections_v2 (owner_id, id, payload, cached_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(owner_id, id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
        ownerId,
        section.id,
        await encryptOfflineValue(section),
        cachedAt,
      )
    }
  })
}

export const getCachedSections = async (): Promise<Section[]> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return []
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM cached_sections_v2 WHERE owner_id = ? ORDER BY cached_at DESC',
    ownerId,
  )
  return Promise.all(rows.map((row) => decryptOfflineValue<Section>(row.payload)))
}

export const getCachedSection = async (id: string): Promise<Section | null> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return null
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM cached_sections_v2 WHERE owner_id = ? AND id = ?',
    ownerId,
    id,
  )
  return row ? decryptOfflineValue<Section>(row.payload) : null
}

export const replaceCachedSections = async (sections: Section[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  await db.runAsync('DELETE FROM cached_sections_v2 WHERE owner_id = ?', ownerId)
  await cacheSections(sections)
}

export const cacheSessions = async (sessions: Session[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const session of sessions) {
      await db.runAsync(
        `INSERT INTO cached_sessions_v2
          (owner_id, id, section_id, payload, cached_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, id) DO UPDATE SET
          section_id = excluded.section_id, payload = excluded.payload, cached_at = excluded.cached_at`,
        ownerId,
        session.id,
        session.sectionId,
        await encryptOfflineValue(session),
        cachedAt,
      )
    }
  })
}

export const getCachedSessions = async (sectionId?: string): Promise<Session[]> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return []
  const rows = sectionId
    ? await db.getAllAsync<{ payload: string }>(
        'SELECT payload FROM cached_sessions_v2 WHERE owner_id = ? AND section_id = ? ORDER BY cached_at DESC',
        ownerId,
        sectionId,
      )
    : await db.getAllAsync<{ payload: string }>(
        'SELECT payload FROM cached_sessions_v2 WHERE owner_id = ? ORDER BY cached_at DESC',
        ownerId,
      )
  return Promise.all(rows.map((row) => decryptOfflineValue<Session>(row.payload)))
}

export const getCachedSession = async (id: string): Promise<Session | null> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return null
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM cached_sessions_v2 WHERE owner_id = ? AND id = ?',
    ownerId,
    id,
  )
  return row ? decryptOfflineValue<Session>(row.payload) : null
}

export const cacheAttendanceRecords = async (records: AttendanceRecord[]) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const record of records) {
      await db.runAsync(
        `INSERT INTO cached_attendance_v2
          (owner_id, id, student_id, section_id, session_id, is_synced, payload, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, id) DO UPDATE SET
          student_id = excluded.student_id,
          section_id = excluded.section_id,
          session_id = excluded.session_id,
          is_synced = excluded.is_synced,
          payload = excluded.payload,
          cached_at = excluded.cached_at`,
        ownerId,
        record.id,
        record.studentId,
        record.sectionId,
        record.sessionId,
        record.isSynced === false ? 0 : 1,
        await encryptOfflineValue(record),
        cachedAt,
      )
    }
  })
}

export const getCachedAttendanceRecords = async (studentId?: string): Promise<AttendanceRecord[]> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return []
  const rows = studentId
    ? await db.getAllAsync<{ payload: string }>(
        'SELECT payload FROM cached_attendance_v2 WHERE owner_id = ? AND student_id = ? ORDER BY cached_at DESC',
        ownerId,
        studentId,
      )
    : await db.getAllAsync<{ payload: string }>(
        'SELECT payload FROM cached_attendance_v2 WHERE owner_id = ? ORDER BY cached_at DESC',
        ownerId,
      )
  return Promise.all(rows.map((row) => decryptOfflineValue<AttendanceRecord>(row.payload)))
}

export const replaceCachedAttendanceForStudent = async (
  studentId: string,
  records: AttendanceRecord[],
) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  const existing = await getCachedAttendanceRecords(studentId)
  const pending = existing.filter((record) => record.isSynced === false)
  await db.runAsync(
    'DELETE FROM cached_attendance_v2 WHERE owner_id = ? AND student_id = ?',
    ownerId,
    studentId,
  )
  await cacheAttendanceRecords([...records, ...pending])
}

export const removeCachedAttendanceAttempt = async (sessionId: string, studentId: string) => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return
  await db.runAsync(
    'DELETE FROM cached_attendance_v2 WHERE owner_id = ? AND session_id = ? AND student_id = ?',
    ownerId,
    sessionId,
    studentId,
  )
}

export const enqueueOfflineOperation = async (kind: OfflineOperationKind, payload: unknown) => {
  const db = await database()
  if (!db) throw new Error('Offline queue is unavailable on this platform')
  const ownerId = requireOwner()
  const createdAt = new Date().toISOString()
  const clientAttemptId =
    payload && typeof payload === 'object' && 'clientAttemptId' in payload
      ? String(payload.clientAttemptId)
      : undefined
  const id = clientAttemptId ? `${kind}:${clientAttemptId}` : `${kind}:${createdAt}:${Math.random().toString(36).slice(2)}`
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue_v2
      (owner_id, id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    ownerId,
    id,
    kind,
    await encryptOfflineValue(payload),
    createdAt,
  )
}

export const drainOfflineQueue = async (
  send: (kind: OfflineOperationKind, payload: Record<string, unknown>) => Promise<OfflineSendResult | void>,
) => {
  if (drainPromise) return drainPromise
  const ownerId = requireOwner()
  drainPromise = (async () => {
    const db = await database()
    if (!db) return
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT id, kind, payload, attempts FROM sync_queue_v2
       WHERE owner_id = ?
         AND (last_error IS NULL OR last_error NOT LIKE 'terminal:%')
       ORDER BY created_at ASC LIMIT 100`,
      ownerId,
    )
    for (const row of rows) {
      if (owner() !== ownerId) break
      try {
        const payload = await decryptOfflineValue<Record<string, unknown>>(row.payload)
        const result = await send(row.kind, payload)
        if (result?.outcome === 'terminal') {
          await db.runAsync(
            'UPDATE sync_queue_v2 SET attempts = ?, last_error = ? WHERE owner_id = ? AND id = ?',
            row.attempts + 1,
            `terminal: ${result.error.slice(0, 490)}`,
            ownerId,
            row.id,
          )
          continue
        }
        if (result?.outcome === 'retryable') {
          await db.runAsync(
            'UPDATE sync_queue_v2 SET attempts = ?, last_error = ? WHERE owner_id = ? AND id = ?',
            row.attempts + 1,
            `retryable: ${result.error.slice(0, 489)}`,
            ownerId,
            row.id,
          )
          break
        }
        await db.runAsync('DELETE FROM sync_queue_v2 WHERE owner_id = ? AND id = ?', ownerId, row.id)
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Sync failed'
        await db.runAsync(
          'UPDATE sync_queue_v2 SET attempts = ?, last_error = ? WHERE owner_id = ? AND id = ?',
          row.attempts + 1,
          message,
          ownerId,
          row.id,
        )
        break
      }
    }
  })().finally(() => {
    drainPromise = null
  })
  return drainPromise
}

export const getPendingSyncCount = async () => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return 0
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sync_queue_v2
     WHERE owner_id = ?
       AND (last_error IS NULL OR last_error NOT LIKE 'terminal:%')`,
    ownerId,
  )
  return row?.count ?? 0
}

export const setServerClockOffset = async (offsetMs: number) => {
  const db = await database()
  if (!db) return
  const ownerId = requireOwner()
  await db.runAsync(
    `INSERT INTO sync_metadata_v2 (owner_id, key, value, updated_at)
     VALUES (?, 'server_clock_offset_ms', ?, ?)
     ON CONFLICT(owner_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ownerId,
    await encryptOfflineValue(String(Math.round(offsetMs))),
    new Date().toISOString(),
  )
}

export const getServerClockOffset = async (): Promise<number | null> => {
  const db = await database()
  const ownerId = owner()
  if (!db || !ownerId) return null
  const row = await db.getFirstAsync<{ value: string; updated_at: string }>(
    `SELECT value, updated_at FROM sync_metadata_v2
     WHERE owner_id = ? AND key = 'server_clock_offset_ms'`,
    ownerId,
  )
  if (!row || Date.now() - new Date(row.updated_at).getTime() > 7 * 24 * 60 * 60 * 1000) return null
  const value = Number(await decryptOfflineValue<string>(row.value))
  return Number.isFinite(value) ? value : null
}
