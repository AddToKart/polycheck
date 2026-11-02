import type { AttendanceRecord, Section, Session, Student, Subject } from '@polycheck/shared'
import { getOfflineDatabase, type EncryptedEnvelope, type OfflineOperationKind, type QueueRow } from './db'
import { decryptValue, encryptValue } from './crypto'

export type OfflineSendResult =
  | { outcome: 'synced' }
  | { outcome: 'pending'; error: string }
  | { outcome: 'retryable' | 'terminal'; error: string }

export const SYNC_STATE_EVENT = 'polycheck-sync-state'
export const SYNC_REQUEST_EVENT = 'polycheck-sync-requested'

let activeOwnerId: string | null = null
let drainPromise: Promise<void> | null = null

const now = () => new Date().toISOString()

function emit(name: string) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(name))
  } catch {
    // Non-browser test shims may not implement CustomEvent; queueing still works.
  }
}

export function setOfflineOwner(ownerId: string | null) {
  activeOwnerId = ownerId
}

export function getOfflineOwner(): string | null {
  return activeOwnerId
}

function requireOwner(): string {
  if (!activeOwnerId) throw new Error('Offline storage requires an authenticated account')
  return activeOwnerId
}

/**
 * Binds the encrypted store to the signed-in account. A different owner found
 * in the same browser wipes prior data instead of guessing ownership (matches
 * the mobile owner-scoping rule).
 */
export async function initializeOfflineStore(ownerId: string): Promise<void> {
  const db = await getOfflineDatabase()
  const existing = await db.get('meta', 'active_owner')
  if (existing && existing.value !== ownerId) {
    for (const store of [
      'subjects',
      'sections',
      'sessions',
      'records',
      'roster',
      'queue_v2',
    ] as const) {
      await db.clear(store)
    }
    await db.delete('crypto_keys', existing.value)
  }
  await db.put('meta', { key: 'active_owner', value: ownerId, updatedAt: now() })
  setOfflineOwner(ownerId)
}

export async function wipeOfflineStore(): Promise<void> {
  setOfflineOwner(null)
  const db = await getOfflineDatabase()
  for (const store of [
    'crypto_keys',
    'meta',
    'subjects',
    'sections',
    'sessions',
    'records',
    'roster',
    'queue_v2',
  ] as const) {
    await db.clear(store)
  }
  emit(SYNC_STATE_EVENT)
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDatabase()
  await db.put('meta', { key, value, updatedAt: now() })
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDatabase()
  const row = await db.get('meta', key)
  return row?.value ?? null
}

export async function setServerClockOffset(offsetMs: number): Promise<void> {
  await setMeta('server_clock_offset_ms', String(Math.round(offsetMs)))
  await setMeta('server_clock_offset_at', now())
}

export async function getServerClockOffset(): Promise<number | null> {
  const raw = await getMeta('server_clock_offset_ms')
  const capturedAt = await getMeta('server_clock_offset_at')
  if (raw === null || !capturedAt) return null
  if (Date.now() - new Date(capturedAt).getTime() > 7 * 24 * 60 * 60 * 1000) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export async function setLastSyncAt(): Promise<void> {
  await setMeta('last_sync_at', now())
}

export async function getLastSyncAt(): Promise<string | null> {
  return getMeta('last_sync_at')
}

export async function setEnrolledSectionIds(sectionIds: string[]): Promise<void> {
  await setMeta('enrolled_section_ids', JSON.stringify(sectionIds))
}

export async function getEnrolledSectionIds(): Promise<string[]> {
  const raw = await getMeta('enrolled_section_ids')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

// ── Reads / caches ───────────────────────────────────────────────────────────

async function cachedRow<T>(row: { payload: EncryptedEnvelope } | undefined, ownerId: string): Promise<T | null> {
  if (!row) return null
  const db = await getOfflineDatabase()
  return decryptValue<T>(db, ownerId, row.payload)
}

export async function cacheSubjects(subjects: Subject[]): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const updatedAt = now()
  const encrypted = await Promise.all(
    subjects.map(async (subject) => ({
      subject,
      payload: await encryptValue(db, ownerId, subject),
    })),
  )
  const tx = db.transaction('subjects', 'readwrite')
  for (const { subject, payload } of encrypted) {
    tx.store.put({ id: subject.id, ownerId, payload, updatedAt })
  }
  await tx.done
}

export async function getCachedSubjects(): Promise<Subject[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = await db.getAll('subjects')
  const values = await Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<Subject>(db, ownerId, row.payload)),
  )
  return values
}

export async function getCachedSubject(id: string): Promise<Subject | null> {
  const ownerId = activeOwnerId
  if (!ownerId) return null
  const db = await getOfflineDatabase()
  return cachedRow<Subject>(await db.get('subjects', id), ownerId)
}

export async function cacheSections(sections: Section[]): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const updatedAt = now()
  const encrypted = await Promise.all(
    sections.map(async (section) => ({
      section,
      payload: await encryptValue(db, ownerId, section),
    })),
  )
  const tx = db.transaction('sections', 'readwrite')
  for (const { section, payload } of encrypted) {
    tx.store.put({ id: section.id, ownerId, payload, updatedAt })
  }
  await tx.done
}

export async function getCachedSections(): Promise<Section[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = await db.getAll('sections')
  return Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<Section>(db, ownerId, row.payload)),
  )
}

export async function getCachedSection(id: string): Promise<Section | null> {
  const ownerId = activeOwnerId
  if (!ownerId) return null
  const db = await getOfflineDatabase()
  return cachedRow<Section>(await db.get('sections', id), ownerId)
}

export async function cacheSessions(sessions: Session[]): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const updatedAt = now()
  const encrypted = await Promise.all(
    sessions.map(async (session) => ({
      session,
      payload: await encryptValue(db, ownerId, session),
    })),
  )
  const tx = db.transaction('sessions', 'readwrite')
  for (const { session, payload } of encrypted) {
    tx.store.put({ id: session.id, ownerId, sectionId: session.sectionId, payload, updatedAt })
  }
  await tx.done
}

export async function getCachedSessions(sectionId?: string): Promise<Session[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = sectionId
    ? await db.getAllFromIndex('sessions', 'by-section', sectionId)
    : await db.getAll('sessions')
  return Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<Session>(db, ownerId, row.payload)),
  )
}

export async function getCachedSession(id: string): Promise<Session | null> {
  const ownerId = activeOwnerId
  if (!ownerId) return null
  const db = await getOfflineDatabase()
  return cachedRow<Session>(await db.get('sessions', id), ownerId)
}

export async function cacheAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const updatedAt = now()
  const encrypted = await Promise.all(
    records.map(async (record) => ({
      record,
      payload: await encryptValue(db, ownerId, record),
    })),
  )
  const tx = db.transaction('records', 'readwrite')
  for (const { record, payload } of encrypted) {
    tx.store.put({
      id: record.id,
      ownerId,
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      isSynced: record.isSynced !== false,
      payload,
      updatedAt,
    })
  }
  await tx.done
}

export async function getCachedAttendanceRecords(studentId?: string): Promise<AttendanceRecord[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = studentId
    ? await db.getAllFromIndex('records', 'by-student', studentId)
    : await db.getAll('records')
  return Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<AttendanceRecord>(db, ownerId, row.payload)),
  )
}

export async function getCachedAttendanceForSession(sessionId: string): Promise<AttendanceRecord[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = await db.getAllFromIndex('records', 'by-session', sessionId)
  return Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<AttendanceRecord>(db, ownerId, row.payload)),
  )
}

export async function replaceCachedAttendanceForStudent(
  studentId: string,
  records: AttendanceRecord[],
): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const existing = await getCachedAttendanceRecords(studentId)
  const pending = existing.filter((record) => record.isSynced === false)
  const tx = db.transaction('records', 'readwrite')
  const keys = await tx.store.index('by-student').getAllKeys(studentId)
  for (const key of keys) await tx.store.delete(key)
  await tx.done
  await cacheAttendanceRecords([...records.filter((record) => record.isSynced !== false), ...pending])
  void ownerId
}

export async function removeCachedAttendanceAttempt(
  sessionId: string,
  studentId: string,
): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const rows = await db.getAllFromIndex('records', 'by-session', sessionId)
  const tx = db.transaction('records', 'readwrite')
  for (const row of rows) {
    if (row.studentId === studentId && row.ownerId === ownerId) await tx.store.delete(row.id)
  }
  await tx.done
}

export async function removeCachedRecord(id: string): Promise<void> {
  requireOwner()
  const db = await getOfflineDatabase()
  await db.delete('records', id)
}

export async function cacheRoster(sectionId: string, students: Student[]): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const updatedAt = now()
  const existing = await db.getAllKeysFromIndex('roster', 'by-section', sectionId)
  const encrypted = await Promise.all(
    students.map(async (student) => ({
      student,
      payload: await encryptValue(db, ownerId, student),
    })),
  )
  const tx = db.transaction('roster', 'readwrite')
  for (const key of existing) tx.store.delete(key)
  for (const { student, payload } of encrypted) {
    tx.store.put({
      id: `${sectionId}:${student.id}`,
      ownerId,
      sectionId,
      studentId: student.id,
      payload,
      updatedAt,
    })
  }
  await tx.done
}

export async function getCachedRoster(sectionId: string): Promise<Student[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = await db.getAllFromIndex('roster', 'by-section', sectionId)
  return Promise.all(
    rows.filter((row) => row.ownerId === ownerId).map((row) => decryptValue<Student>(db, ownerId, row.payload)),
  )
}

// ── Queue ────────────────────────────────────────────────────────────────────

export async function enqueueOfflineOperation(
  kind: OfflineOperationKind,
  payload: Record<string, unknown>,
): Promise<string> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const clientAttemptId =
    typeof payload.clientAttemptId === 'string' && payload.clientAttemptId
      ? payload.clientAttemptId
      : crypto.randomUUID()
  const id = `${kind}:${clientAttemptId}`
  const row: QueueRow = {
    id,
    ownerId,
    kind,
    payload: await encryptValue(db, ownerId, { ...payload, clientAttemptId }),
    clientAttemptId,
    createdAt: now(),
    attempts: 0,
    lastError: null,
  }
  try {
    await db.add('queue_v2', row)
  } catch (error) {
    // Idempotent enqueue: the same evidence attempt is already queued.
    if (error instanceof DOMException && error.name === 'ConstraintError') return id
    throw error
  }
  emit(SYNC_STATE_EVENT)
  emit(SYNC_REQUEST_EVENT)
  return id
}

export async function drainOfflineQueue(
  send: (
    kind: OfflineOperationKind,
    payload: Record<string, unknown>,
    operationId: string,
  ) => Promise<OfflineSendResult | void>,
): Promise<void> {
  if (drainPromise) return drainPromise
  const ownerId = requireOwner()
  drainPromise = (async () => {
    const db = await getOfflineDatabase()
    const rows = (await db.getAll('queue_v2'))
      .filter(
        (row) =>
          row.ownerId === ownerId &&
          !(row.lastError ?? '').startsWith('terminal:'),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, 100)

    for (const row of rows) {
      if (activeOwnerId !== ownerId) break
      let payload: Record<string, unknown>
      try {
        payload = await decryptValue<Record<string, unknown>>(db, ownerId, row.payload)
      } catch {
        await db.put('queue_v2', {
          ...row,
          attempts: row.attempts + 1,
          lastError: 'terminal: Saved evidence could not be read. Contact support.',
        })
        continue
      }
      if (activeOwnerId !== ownerId) break
      try {
        const result = await send(row.kind, payload, row.id)
        if (result?.outcome === 'pending') continue
        if (result?.outcome === 'terminal') {
          await db.put('queue_v2', {
            ...row,
            attempts: row.attempts + 1,
            lastError: `terminal: ${result.error.slice(0, 490)}`,
          })
          emit(SYNC_STATE_EVENT)
          continue
        }
        if (result?.outcome === 'retryable') {
          await db.put('queue_v2', {
            ...row,
            attempts: row.attempts + 1,
            lastError: `retryable: ${result.error.slice(0, 489)}`,
          })
          emit(SYNC_STATE_EVENT)
          break
        }
        await db.delete('queue_v2', row.id)
        emit(SYNC_STATE_EVENT)
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Sync failed'
        await db.put('queue_v2', { ...row, attempts: row.attempts + 1, lastError: message })
        emit(SYNC_STATE_EVENT)
        break
      }
    }
    await setLastSyncAt()
    emit(SYNC_STATE_EVENT)
  })().finally(() => {
    drainPromise = null
  })
  return drainPromise
}

export async function getPendingSyncCount(): Promise<number> {
  const ownerId = activeOwnerId
  if (!ownerId) return 0
  const db = await getOfflineDatabase()
  const rows = await db.getAll('queue_v2')
  return rows.filter(
    (row) => row.ownerId === ownerId && !(row.lastError ?? '').startsWith('terminal:'),
  ).length
}

export interface OfflineQueueIssue {
  id: string
  kind: OfflineOperationKind
  sessionId: string
  error: string
  failed: boolean
}

export async function getOfflineQueueIssues(): Promise<OfflineQueueIssue[]> {
  const ownerId = activeOwnerId
  if (!ownerId) return []
  const db = await getOfflineDatabase()
  const rows = await db.getAll('queue_v2')
  return Promise.all(
    rows
      .filter((row) => row.ownerId === ownerId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(async (row) => {
        let sessionId = 'Unavailable'
        try {
          const payload = await decryptValue<Record<string, unknown>>(db, ownerId, row.payload)
          sessionId = String(payload.sessionId ?? 'Unavailable')
        } catch {
          // Preserve unreadable evidence for support instead of deleting it.
        }
        return {
          id: row.id,
          kind: row.kind,
          sessionId,
          error:
            row.lastError?.replace(/^(terminal|retryable): /, '') ??
            'Awaiting server confirmation',
          failed: row.lastError?.startsWith('terminal:') ?? false,
        }
      }),
  )
}

export async function retryOfflineOperation(id: string): Promise<void> {
  const ownerId = requireOwner()
  const db = await getOfflineDatabase()
  const row = await db.get('queue_v2', id)
  if (!row || row.ownerId !== ownerId) return
  await db.put('queue_v2', { ...row, lastError: null })
  emit(SYNC_STATE_EVENT)
  emit(SYNC_REQUEST_EVENT)
}

export function requestQueueDrain(): void {
  emit(SYNC_REQUEST_EVENT)
}

export async function persistOfflineStorage(): Promise<{
  persisted: boolean
  usage: number
  quota: number
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null
  try {
    const persisted = await navigator.storage.persist()
    const estimate = await navigator.storage.estimate()
    return { persisted, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch {
    return null
  }
}
