import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb'

export const OFFLINE_DB_NAME = 'polycheck-offline'

export interface EncryptedEnvelope {
  v: 1
  iv: string
  data: string
}

export interface EncryptedRow {
  id: string
  ownerId: string
  payload: EncryptedEnvelope
  updatedAt: string
}

export interface AttendanceRow extends EncryptedRow {
  sessionId: string
  studentId: string
  sectionId: string
  isSynced: boolean
}

export interface SessionRow extends EncryptedRow {
  sectionId: string
}

export interface RosterRow extends EncryptedRow {
  sectionId: string
  studentId: string
}

export type OfflineOperationKind =
  | 'attendance_scan'
  | 'scan_attempt'
  | 'session_activation'
  | 'session_end'
  | 'attendance_manual'
  | 'attendance_status'

export interface QueueRow {
  id: string
  ownerId: string
  kind: OfflineOperationKind
  payload: EncryptedEnvelope
  clientAttemptId: string
  createdAt: string
  attempts: number
  lastError: string | null
}

export interface MetaRow {
  key: string
  value: string
  updatedAt: string
}

export interface CryptoKeyRow {
  ownerId: string
  key?: CryptoKey
  rawKey?: string
  createdAt: string
}

export interface PolycheckOfflineDB extends DBSchema {
  crypto_keys: { key: string; value: CryptoKeyRow }
  meta: { key: string; value: MetaRow }
  subjects: { key: string; value: EncryptedRow }
  sections: { key: string; value: EncryptedRow }
  sessions: {
    key: string
    value: SessionRow
    indexes: { 'by-section': string }
  }
  records: {
    key: string
    value: AttendanceRow
    indexes: { 'by-student': string; 'by-session': string; 'by-section': string }
  }
  roster: {
    key: string
    value: RosterRow
    indexes: { 'by-section': string }
  }
  queue_v2: { key: string; value: QueueRow }
}

let databasePromise: Promise<IDBPDatabase<PolycheckOfflineDB>> | null = null

export function getOfflineDatabase(): Promise<IDBPDatabase<PolycheckOfflineDB>> {
  if (!databasePromise) {
    databasePromise = openDB<PolycheckOfflineDB>(OFFLINE_DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('crypto_keys', { keyPath: 'ownerId' })
        db.createObjectStore('meta', { keyPath: 'key' })
        db.createObjectStore('subjects', { keyPath: 'id' })
        db.createObjectStore('sections', { keyPath: 'id' })
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('by-section', 'sectionId')
        const records = db.createObjectStore('records', { keyPath: 'id' })
        records.createIndex('by-student', 'studentId')
        records.createIndex('by-session', 'sessionId')
        records.createIndex('by-section', 'sectionId')
        const roster = db.createObjectStore('roster', { keyPath: 'id' })
        roster.createIndex('by-section', 'sectionId')
        db.createObjectStore('queue_v2', { keyPath: 'id' })
      },
      blocking() {
        // Another tab is deleting/upgrading: stop using this connection.
        databasePromise = null
      },
    })
  }
  return databasePromise
}

export async function closeOfflineDatabase(): Promise<void> {
  if (!databasePromise) return
  try {
    const db = await databasePromise
    db.close()
  } catch {
    // Ignore close failures on already-closed connections.
  }
  databasePromise = null
}

export async function deleteOfflineDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await closeOfflineDatabase()
  await deleteDB(OFFLINE_DB_NAME)
}
