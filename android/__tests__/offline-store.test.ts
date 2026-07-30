import type { Section, Session } from '@polycheck/shared'

// Mock all native dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
}))
jest.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' }, expoGoConfig: { debuggerHost: 'localhost:8081' } },
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: Record<string, unknown>) => obj.android },
}))
jest.mock('@polycheck/shared', () => ({
  createSigningKeyPair: jest.fn(),
  isWithinGeofence: jest.fn(),
  signQRToken: jest.fn(),
  verifyQRToken: jest.fn(),
}))
jest.mock('../services/offline-crypto', () => ({
  encryptOfflineValue: jest.fn(async (value: unknown) => `encrypted:${JSON.stringify(value)}`),
  decryptOfflineValue: jest.fn(async (value: string) => JSON.parse(value.slice('encrypted:'.length))),
}))

// Create in-memory SQLite mock with basic query handling
const tables: Record<string, Array<Record<string, any>>> = {}
let schemaVersion = 0

function execSql(sql: string) {
  const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/g)
  if (createMatch) {
    for (const match of createMatch) {
      const name = match.replace(/CREATE TABLE IF NOT EXISTS\s+/, '')
      if (!tables[name]) tables[name] = []
    }
  }
  const dropMatches = sql.match(/DROP TABLE IF EXISTS (\w+)/g)
  if (dropMatches) {
    for (const match of dropMatches) delete tables[match.replace(/DROP TABLE IF EXISTS\s+/, '')]
  }
  const version = sql.match(/PRAGMA user_version\s*=\s*(\d+)/)
  if (version) schemaVersion = Number(version[1])
}

function runSql(sql: string, ...params: unknown[]) {
  if (/INSERT\s+OR\s+IGNORE/i.test(sql) && /sync_queue_v2/i.test(sql)) {
    const [ownerId, id, kind, payload, createdAt] = params
    if (!tables.sync_queue_v2) tables.sync_queue_v2 = []
    const exists = tables.sync_queue_v2.some((r: any) => r.owner_id === ownerId && r.id === id)
    if (!exists) {
      tables.sync_queue_v2.push({
        owner_id: ownerId,
        id,
        kind,
        payload,
        attempts: 0,
        last_error: null,
        created_at: createdAt,
      })
    }
    return { changes: exists ? 0 : 1 }
  }

  if (/sync_metadata_v2/i.test(sql) && /ON CONFLICT/i.test(sql)) {
    if (!tables.sync_metadata_v2) tables.sync_metadata_v2 = []
    const [ownerId, value, updatedAt] = params
    const existing = tables.sync_metadata_v2.find(
      (r: any) => r.owner_id === ownerId && r.key === 'server_clock_offset_ms',
    )
    if (existing) {
      existing.value = value
      existing.updated_at = updatedAt
    } else {
      tables.sync_metadata_v2.push({
        owner_id: ownerId,
        key: 'server_clock_offset_ms',
        value,
        updated_at: updatedAt,
      })
    }
    return { changes: 1 }
  }

  // INSERT ... ON CONFLICT DO UPDATE (generic upsert for sections/sessions)
  if (/INSERT/i.test(sql) && /ON CONFLICT/i.test(sql)) {
    const tableName = sql.match(/INTO\s+(\w+)/i)![1]
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    if (!colMatch) return { changes: 0 }
    const cols = colMatch[1].split(',').map((c) => c.trim())
    const row: Record<string, unknown> = {}
    cols.forEach((col, i) => { if (i < params.length) row[col] = params[i] })
    if (!tables[tableName]) tables[tableName] = []
    const existing = tables[tableName].find(
      (r: any) => r.owner_id === row.owner_id && r.id === row.id,
    )
    if (existing) Object.assign(existing, row)
    else tables[tableName].push(row)
    return { changes: 1 }
  }

  if (/UPDATE\s+(\w+)/i.test(sql)) {
    const tableName = sql.match(/UPDATE\s+(\w+)/i)![1]
    const whereCols = [...sql.matchAll(/(?:WHERE|AND)\s+(\w+)\s*=\s*\?/gi)].map((match) => match[1])
    if (!whereCols.length) return { changes: 0 }
    const whereValues = params.slice(params.length - whereCols.length)
    const row = (tables[tableName] || []).find((candidate: any) =>
      whereCols.every((column, index) => candidate[column] === whereValues[index]),
    )
    if (row) {
      const setClause = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] || ''
      const setParts = setClause.split(',').map((s) => s.trim().split('=').map((c) => c.trim()))
      setParts.forEach(([col], i) => { row[col] = params[i] })
      return { changes: 1 }
    }
    return { changes: 0 }
  }

  if (/DELETE\s+FROM/i.test(sql)) {
    const tableName = sql.match(/FROM\s+(\w+)/i)![1]
    const whereCols = [...sql.matchAll(/(?:WHERE|AND)\s+(\w+)\s*=\s*\?/gi)].map((match) => match[1])
    if (!tables[tableName]) return { changes: 0 }
    const before = tables[tableName].length
    tables[tableName] = whereCols.length
      ? tables[tableName].filter(
          (candidate: any) => !whereCols.every((column, index) => candidate[column] === params[index]),
        )
      : []
    return { changes: before - tables[tableName].length }
  }

  return { changes: 0 }
}

function querySql(sql: string, ...params: unknown[]) {
  if (/PRAGMA user_version/i.test(sql)) return [{ user_version: schemaVersion }]
  const tableName = sql.match(/FROM\s+(\w+)/i)?.[1]
  if (!tableName || !tables[tableName]) return sql.includes('COUNT(*)') ? [{ count: 0 }] : []
  let rows: any[] = [...tables[tableName]]

  const whereColumns = [...sql.matchAll(/(?:WHERE|AND)\s+(\w+)\s*=\s*\?/gi)].map((match) => match[1])
  if (whereColumns.length) {
    rows = rows.filter((row) => whereColumns.every((column, index) => row[column] === params[index]))
  }

  // WHERE col = 'literal' (string literal, no parameter)
  const literalWhere = sql.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/)
  if (literalWhere) rows = rows.filter((r) => r[literalWhere[1]] === literalWhere[2])

  // Handle last_error IS NULL OR last_error NOT LIKE 'terminal:%'
  if (/last_error/i.test(sql)) {
    rows = rows.filter((r) => r.last_error == null || (typeof r.last_error === 'string' && !r.last_error.startsWith('terminal:')))
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/)
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]))

  // COUNT(*)
  if (sql.includes('COUNT(*)')) return [{ count: rows.length }]

  return rows
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockImplementation((sql: string) => { execSql(sql); return Promise.resolve() }),
    runAsync: jest.fn().mockImplementation((sql: string, ...args: unknown[]) => Promise.resolve(runSql(sql, ...args))),
    getAllAsync: jest.fn().mockImplementation((sql: string, ...args: unknown[]) => Promise.resolve(querySql(sql, ...args))),
    getFirstAsync: jest.fn().mockImplementation((sql: string, ...args: unknown[]) => Promise.resolve(querySql(sql, ...args)[0] ?? null)),
    withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
  }),
  _resetDatabase: jest.fn().mockImplementation(() => {
    for (const k of Object.keys(tables)) delete tables[k]
    schemaVersion = 2
  }),
}))

import {
  initializeOfflineStore,
  cacheSections,
  getCachedSections,
  getCachedSection,
  cacheSessions,
  getCachedSessions,
  getCachedSession,
  enqueueOfflineOperation,
  drainOfflineQueue,
  getPendingSyncCount,
  setOfflineOwner,
  setServerClockOffset,
  getServerClockOffset,
} from '../services/offline-store'

const { _resetDatabase } = jest.requireMock('expo-sqlite') as { _resetDatabase: jest.Mock }

const mockSection: Section = {
  id: 'sec-test-1',
  subjectId: 'subj-1',
  section: 'BSCS 2-1',
  room: 'Room 304',
  schedule: [{ day: 'Mon', startTime: '08:00', endTime: '11:00', room: 'Room 304' }],
  semester: '1st Sem 2026-2027',
  teacherId: 't-001',
  teacherName: 'Prof. Test',
  enrollmentCode: 'TEST1',
  enrollmentCodeExpiry: '2026-12-31T23:59:59.000Z',
  studentCount: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockSession: Session = {
  id: 'sess-test-1',
  sectionId: 'sec-test-1',
  subjectName: 'Data Structures',
  teacherId: 't-001',
  date: '2026-07-15',
  startTime: '08:00',
  endTime: '11:00',
  geofence: {
    latitude: 14.5995,
    longitude: 120.9842,
    radiusMeters: 50,
  },
  isActive: false,
  isRescheduled: false,
  qrValidityMinutes: 20,
  gracePeriodMinutes: 15,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('offline-store', () => {
  beforeEach(async () => {
    _resetDatabase()
    await initializeOfflineStore('user-1')
  })

  describe('section caching', () => {
    it('caches and retrieves sections', async () => {
      await cacheSections([mockSection])
      const sections = await getCachedSections()
      expect(sections).toHaveLength(1)
      expect(sections[0].id).toBe('sec-test-1')
      expect(sections[0].section).toBe('BSCS 2-1')
    })

    it('updates existing sections on conflict', async () => {
      await cacheSections([mockSection])
      const updated = { ...mockSection, room: 'Room 999', studentCount: 50 }
      await cacheSections([updated])
      const sections = await getCachedSections()
      expect(sections).toHaveLength(1)
      expect(sections[0].room).toBe('Room 999')
      expect(sections[0].studentCount).toBe(50)
    })

    it('returns empty array when no sections cached', async () => {
      const sections = await getCachedSections()
      expect(sections).toEqual([])
    })

    it('gets a specific section by id', async () => {
      await cacheSections([mockSection])
      const found = await getCachedSection('sec-test-1')
      expect(found).not.toBeNull()
      expect(found!.id).toBe('sec-test-1')
    })

    it('returns null for non-existent section', async () => {
      const found = await getCachedSection('does-not-exist')
      expect(found).toBeNull()
    })

    it('caches multiple sections', async () => {
      const section2: Section = { ...mockSection, id: 'sec-test-2', section: 'BSCS 3-1' }
      await cacheSections([mockSection, section2])
      const sections = await getCachedSections()
      expect(sections).toHaveLength(2)
    })

    it('isolates cached sections between authenticated accounts', async () => {
      await cacheSections([mockSection])
      await initializeOfflineStore('user-2')
      expect(await getCachedSections()).toEqual([])

      setOfflineOwner('user-1')
      expect(await getCachedSections()).toHaveLength(1)
    })
  })

  describe('session caching', () => {
    it('caches and retrieves sessions', async () => {
      await cacheSessions([mockSession])
      const sessions = await getCachedSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('sess-test-1')
    })

    it('filters sessions by sectionId', async () => {
      const session2: Session = { ...mockSession, id: 'sess-test-2', sectionId: 'sec-other' }
      await cacheSessions([mockSession, session2])
      const filtered = await getCachedSessions('sec-test-1')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('sess-test-1')
    })

    it('gets all sessions when no sectionId filter', async () => {
      const session2: Session = { ...mockSession, id: 'sess-test-2', sectionId: 'sec-other' }
      await cacheSessions([mockSession, session2])
      const all = await getCachedSessions()
      expect(all).toHaveLength(2)
    })

    it('updates existing sessions on conflict', async () => {
      await cacheSessions([mockSession])
      const active: Session = { ...mockSession, isActive: true, qrToken: 'abc123' }
      await cacheSessions([active])
      const sessions = await getCachedSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].isActive).toBe(true)
      expect(sessions[0].qrToken).toBe('abc123')
    })

    it('gets a specific session by id', async () => {
      await cacheSessions([mockSession])
      const found = await getCachedSession('sess-test-1')
      expect(found).not.toBeNull()
      expect(found!.id).toBe('sess-test-1')
    })

    it('returns null for non-existent session', async () => {
      const found = await getCachedSession('does-not-exist')
      expect(found).toBeNull()
    })
  })

  describe('sync queue', () => {
    it('enqueues and counts pending operations', async () => {
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's1', studentId: 'st1' })
      const count = await getPendingSyncCount()
      expect(count).toBe(1)
    })

    it('uses clientAttemptId as dedup key', async () => {
      await enqueueOfflineOperation('attendance_scan', { clientAttemptId: 'dup-1', sessionId: 's1' })
      await enqueueOfflineOperation('attendance_scan', { clientAttemptId: 'dup-1', sessionId: 's1' })
      const count = await getPendingSyncCount()
      expect(count).toBe(1)
    })

    it('enqueues different operations separately', async () => {
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's1' })
      await enqueueOfflineOperation('session_activation', { sessionId: 's1' })
      const count = await getPendingSyncCount()
      expect(count).toBe(2)
    })

    it('drains queue and removes on successful send', async () => {
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's1' })
      const sendFn = jest.fn().mockResolvedValue({ outcome: 'synced' })
      await drainOfflineQueue(sendFn)
      const count = await getPendingSyncCount()
      expect(count).toBe(0)
      expect(sendFn).toHaveBeenCalledTimes(1)
    })

    it('marks terminal errors and does not retry', async () => {
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's1' })
      const sendFn = jest.fn().mockResolvedValue({ outcome: 'terminal', error: 'signature invalid' })
      await drainOfflineQueue(sendFn)
      // Terminal operations remain quarantined but are no longer pending.
      const count = await getPendingSyncCount()
      expect(count).toBe(0)
    })

    it('stops on first retryable error', async () => {
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's1' })
      await enqueueOfflineOperation('attendance_scan', { sessionId: 's2' })
      const sendFn = jest.fn().mockResolvedValue({ outcome: 'retryable', error: 'network' })
      await drainOfflineQueue(sendFn)
      // Only first item attempted; second remains
      expect(sendFn).toHaveBeenCalledTimes(1)
      const count = await getPendingSyncCount()
      expect(count).toBe(2) // both still in queue
    })

    it('processes at most 100 items per drain', async () => {
      for (let i = 0; i < 105; i++) {
        await enqueueOfflineOperation('attendance_scan', {
          clientAttemptId: `op-${i}`,
          sessionId: `s${i}`,
        })
      }
      const countBefore = await getPendingSyncCount()
      expect(countBefore).toBeGreaterThanOrEqual(100)
    })
  })

  describe('server clock offset', () => {
    it('stores and retrieves clock offset', async () => {
      await setServerClockOffset(5000)
      const offset = await getServerClockOffset()
      expect(offset).toBe(5000)
    })

    it('overwrites existing offset', async () => {
      await setServerClockOffset(5000)
      await setServerClockOffset(-3000)
      const offset = await getServerClockOffset()
      expect(offset).toBe(-3000)
    })

    it('returns null when no offset stored', async () => {
      const offset = await getServerClockOffset()
      expect(offset).toBeNull()
    })

    it('rounds fractional offsets', async () => {
      await setServerClockOffset(1234.56)
      const offset = await getServerClockOffset()
      expect(offset).toBe(1235)
    })
  })
})
