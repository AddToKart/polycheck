import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import type { Section, Session } from '@polycheck/shared'

export type OfflineOperationKind = 'attendance_scan' | 'scan_attempt' | 'session_activation' | 'session_end'

type QueueRow = {
  id: string
  kind: OfflineOperationKind
  payload: string
  attempts: number
}

let databasePromise: Promise<SQLite.SQLiteDatabase | null> | null = null
let drainPromise: Promise<void> | null = null

async function database() {
  if (Platform.OS === 'web') return null
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('polycheck.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cached_sections (
          id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          cached_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cached_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          section_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          cached_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS cached_sessions_section_idx ON cached_sessions(section_id);
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL
        );
      `)
      return db
    })
  }
  return databasePromise
}

export async function initializeOfflineStore() {
  await database()
}

export async function cacheSections(sections: Section[]) {
  const db = await database()
  if (!db) return
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const section of sections) {
      await db.runAsync(
        `INSERT INTO cached_sections (id, payload, cached_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
        section.id,
        JSON.stringify(section),
        cachedAt,
      )
    }
  })
}

export async function getCachedSections(): Promise<Section[]> {
  const db = await database()
  if (!db) return []
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM cached_sections ORDER BY cached_at DESC')
  return rows.map((row) => JSON.parse(row.payload) as Section)
}

export async function getCachedSection(id: string): Promise<Section | null> {
  const db = await database()
  if (!db) return null
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM cached_sections WHERE id = ?', id)
  return row ? JSON.parse(row.payload) as Section : null
}

export async function cacheSessions(sessions: Session[]) {
  const db = await database()
  if (!db) return
  const cachedAt = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const session of sessions) {
      await db.runAsync(
        `INSERT INTO cached_sessions (id, section_id, payload, cached_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET section_id = excluded.section_id, payload = excluded.payload, cached_at = excluded.cached_at`,
        session.id,
        session.sectionId,
        JSON.stringify(session),
        cachedAt,
      )
    }
  })
}

export async function getCachedSessions(sectionId?: string): Promise<Session[]> {
  const db = await database()
  if (!db) return []
  const rows = sectionId
    ? await db.getAllAsync<{ payload: string }>('SELECT payload FROM cached_sessions WHERE section_id = ? ORDER BY cached_at DESC', sectionId)
    : await db.getAllAsync<{ payload: string }>('SELECT payload FROM cached_sessions ORDER BY cached_at DESC')
  return rows.map((row) => JSON.parse(row.payload) as Session)
}

export async function getCachedSession(id: string): Promise<Session | null> {
  const db = await database()
  if (!db) return null
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM cached_sessions WHERE id = ?', id)
  return row ? JSON.parse(row.payload) as Session : null
}

export async function enqueueOfflineOperation(kind: OfflineOperationKind, payload: unknown) {
  const db = await database()
  if (!db) throw new Error('Offline queue is unavailable on this platform')
  const createdAt = new Date().toISOString()
  const id = `${kind}:${createdAt}:${Math.random().toString(36).slice(2)}`
  await db.runAsync(
    'INSERT INTO sync_queue (id, kind, payload, created_at) VALUES (?, ?, ?, ?)',
    id,
    kind,
    JSON.stringify(payload),
    createdAt,
  )
}

export async function drainOfflineQueue(
  send: (kind: OfflineOperationKind, payload: Record<string, unknown>) => Promise<void>,
) {
  if (drainPromise) return drainPromise
  drainPromise = (async () => {
    const db = await database()
    if (!db) return
    const rows = await db.getAllAsync<QueueRow>('SELECT id, kind, payload, attempts FROM sync_queue ORDER BY created_at ASC LIMIT 100')
    for (const row of rows) {
      try {
        await send(row.kind, JSON.parse(row.payload) as Record<string, unknown>)
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', row.id)
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Sync failed'
        await db.runAsync('UPDATE sync_queue SET attempts = ?, last_error = ? WHERE id = ?', row.attempts + 1, message, row.id)
        break
      }
    }
  })().finally(() => { drainPromise = null })
  return drainPromise
}

export async function getPendingSyncCount() {
  const db = await database()
  if (!db) return 0
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_queue')
  return row?.count ?? 0
}
