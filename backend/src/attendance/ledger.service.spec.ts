import { createHash } from 'crypto'
import { LedgerService } from './ledger.service'
import { computeRecordHash } from '@polycheck/shared/ledger'

function hashOf(prev: string | null, studentId: string, timestampIso: string, sessionId: string, salt: string) {
  return createHash('sha256')
    .update(`${prev ?? ''}|${studentId}|${timestampIso}|${sessionId}|${salt}`)
    .digest('hex')
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    studentId: 'stu-1',
    timestamp: new Date('2026-07-14T01:00:00.000Z'),
    recordHash: null as string | null,
    prevHash: null as string | null,
    salt: null as string | null,
    ...overrides,
  }
}

type ChainRow = ReturnType<typeof makeRow>

function makeTx() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(0),
    attendanceRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as {
    $executeRaw: jest.Mock
    attendanceRecord: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock }
  }
}

const service = new LedgerService({} as never)

function makeDb(options: {
  sessions: string[]
  rowsBySession: Record<string, ChainRow[]>
  anchors?: { id: string; metadata: unknown }[]
}) {
  const { sessions, rowsBySession, anchors = [] } = options
  return {
    session: {
      findMany: jest.fn().mockImplementation(async (args: { where?: { id?: { gt?: string } }; take?: number }) =>
        sessions
          .filter((id) => id > (args?.where?.id?.gt ?? ''))
          .slice(0, args?.take ?? 50)
          .map((id) => ({ id })),
      ),
    },
    attendanceRecord: {
      findFirst: jest.fn().mockImplementation(async (args: { where: { sessionId: string } }) =>
        (rowsBySession[args.where.sessionId] ?? []).find(
          (row: { recordHash: string | null; status?: string }) =>
            row.recordHash === null && row.status !== 'pending',
        ) ?? null,
      ),
      findMany: jest
        .fn()
        .mockImplementation(async (args: { where: { sessionId: string } }) =>
          (rowsBySession[args.where.sessionId] ?? []).filter(
            (row: { recordHash: string | null }) => row.recordHash !== null,
          ),
        ),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue(anchors) },
  }
}

describe('LedgerService.appendLedger', () => {
  const record = {
    id: 'rec-1',
    sessionId: 'sess-1',
    studentId: 'stu-1',
    timestamp: new Date('2026-07-14T01:00:00.000Z'),
  }

  it('writes a genesis record hash with a fresh 32-hex salt inside the transaction', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })

    const hash = await service.appendLedger(tx as never, record)

    expect(tx.attendanceRecord.update).toHaveBeenCalledTimes(1)
    const data = tx.attendanceRecord.update.mock.calls[0][0].data
    expect(data.prevHash).toBeNull()
    expect(data.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(data.recordHash).toBe(hash)
    expect(hash).toBe(hashOf(null, 'stu-1', '2026-07-14T01:00:00.000Z', 'sess-1', data.salt))
  })

  it('hashes over the row timestamp, never the arrival time', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })

    const hash = await service.appendLedger(tx as never, record)

    const data = tx.attendanceRecord.update.mock.calls[0][0].data
    expect(data.recordHash).toBe(
      hashOf(null, 'stu-1', new Date('2026-07-14T01:00:00.000Z').toISOString(), 'sess-1', data.salt),
    )
    expect(hash).not.toBe(
      hashOf(null, 'stu-1', new Date('2026-07-14T09:00:00.000Z').toISOString(), 'sess-1', data.salt),
    )
  })

  it('links to the unique chain tail regardless of scan timestamp order', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })
    tx.attendanceRecord.findMany.mockResolvedValue([
      { id: 'rec-head', recordHash: 'head-hash', prevHash: 'root-hash' },
      { id: 'rec-root', recordHash: 'root-hash', prevHash: null },
    ])

    const hash = await service.appendLedger(tx as never, {
      ...record,
      id: 'rec-2',
      studentId: 'stu-2',
      timestamp: new Date('2026-07-14T02:00:00.000Z'),
    })

    expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'sess-1', id: { not: 'rec-2' }, recordHash: { not: null } },
        select: { id: true, recordHash: true, prevHash: true },
      }),
    )
    const data = tx.attendanceRecord.update.mock.calls[0][0].data
    expect(data.prevHash).toBe('head-hash')
    expect(hash).toBe(hashOf('head-hash', 'stu-2', '2026-07-14T02:00:00.000Z', 'sess-1', data.salt))
  })

  it('treats already-chained rows as immutable chain nodes (online check-out retry)', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: 'committed-hash' })

    const result = await service.appendLedger(tx as never, record)

    expect(result).toBe('committed-hash')
    expect(tx.attendanceRecord.findMany).not.toHaveBeenCalled()
    expect(tx.attendanceRecord.update).not.toHaveBeenCalled()
  })

  it('uses the caller-supplied prevHash instead of reading the head', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })

    await service.appendLedger(tx as never, record, 'explicit-prev')

    expect(tx.attendanceRecord.findMany).not.toHaveBeenCalled()
    expect(tx.attendanceRecord.update.mock.calls[0][0].data.prevHash).toBe('explicit-prev')
  })

  it('takes the per-session advisory lock before reading chain state', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })

    await service.appendLedger(tx as never, { ...record, sessionId: 'sess-9' })

    const sql = String(tx.$executeRaw.mock.calls[0][0])
    expect(sql.includes('pg_advisory_xact_lock')).toBe(true)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attendanceRecord.findUnique.mock.invocationCallOrder[0],
    )
  })

  it('fails closed when the committed row is not visible to the transaction', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue(null)

    await expect(service.appendLedger(tx as never, record)).rejects.toThrow('disappeared before its chain append')
    expect(tx.attendanceRecord.update).not.toHaveBeenCalled()
  })

  it('propagates persistence failures so the attendance commit rolls back', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })
    tx.attendanceRecord.update.mockRejectedValue(new Error('connection closed'))

    await expect(service.appendLedger(tx as never, record)).rejects.toThrow('connection closed')
  })

  it('uses fresh salts on every append', async () => {
    const tx = makeTx()
    tx.attendanceRecord.findUnique.mockResolvedValue({ recordHash: null })

    await service.appendLedger(tx as never, record)
    const firstSalt = tx.attendanceRecord.update.mock.calls[0][0].data.salt
    tx.attendanceRecord.update.mockClear()
    await service.appendLedger(tx as never, {
      ...record,
      id: 'rec-2',
      studentId: 'stu-2',
      timestamp: new Date('2026-07-14T02:00:00.000Z'),
    })

    const secondSalt = tx.attendanceRecord.update.mock.calls[0][0].data.salt
    expect(firstSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(secondSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(firstSalt).not.toEqual(secondSalt)
  })
})

describe('LedgerService.verifyLedger', () => {
  function chained(id: string, hour: number, prevHash: string | null, sessionId: string, studentId: string) {
    const timestamp = new Date(Date.UTC(2026, 6, 14, hour))
    const salt = `salt-${id}salt`
    return {
      id,
      sessionId,
      recordHash: computeRecordHash({
        prevHash,
        studentId,
        timestampIso: timestamp.toISOString(),
        sessionId,
        salt,
      }),
      prevHash,
      salt,
      studentId,
      timestamp,
    }
  }

  it('verifies a clean chain across multiple sessions', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2')
    const b1 = chained('b1', 1, null, 'sess-b', 'stu-3')
    const db = makeDb({ sessions: ['sess-a', 'sess-b'], rowsBySession: { 'sess-a': [a1, a2], 'sess-b': [b1] } })

    const result = await service.verifyLedger(db as never)

    expect(result).toEqual({ verified: true, recordsChecked: 3, sessionsChecked: 2 })
    expect(db.attendanceRecord.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { sessionId: 'sess-a', recordHash: { not: null } } }),
    )
    expect(db.attendanceRecord.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { sessionId: 'sess-b', recordHash: { not: null } } }),
    )
  })

  it('reports hash_mismatch when a stored row no longer recomputes', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const tampered = { ...chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2'), studentId: 'stu-impersonated' }
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [a1, tampered] } })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(false)
    expect(result.brokenAt).toEqual({ sessionId: 'sess-a', recordId: 'a2', reason: 'hash_mismatch' })
    expect(result.recordsChecked).toBe(1)
  })

  it('reports link_mismatch when a referenced predecessor disappears', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, 'deleted-record-hash', 'sess-a', 'stu-2')
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [a1, a2] } })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(false)
    expect(result.brokenAt).toEqual({ sessionId: 'sess-a', recordId: 'a2', reason: 'link_mismatch' })
  })

  it('accepts arrival-order linkage where the referenced row has a later timestamp', async () => {
    // Student B scanned online at 03:00 and was chained first; student A's
    // 02:00 offline scan arrives later and links to B (arrival order truth).
    const b = chained('b1', 3, null, 'sess-a', 'stu-b')
    const a = chained('a1', 1, b.recordHash, 'sess-a', 'stu-a')
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [a, b] } })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(true)
    expect(result.recordsChecked).toBe(2)
  })

  it('rejects two ledger rows that branch from the same predecessor', async () => {
    const root = chained('root', 1, null, 'sess-a', 'stu-root')
    const firstChild = chained('child-a', 2, root.recordHash, 'sess-a', 'stu-a')
    const secondChild = chained('child-b', 3, root.recordHash, 'sess-a', 'stu-b')
    const db = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [root, firstChild, secondChild] },
    })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(false)
    expect(result.brokenAt).toMatchObject({ sessionId: 'sess-a', reason: 'link_mismatch' })
  })

  it('reports incomplete coverage when a finalized row has no hash', async () => {
    const unchained = makeRow({ id: 'seed', status: 'absent' })
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [unchained, a1] } })

    const result = await service.verifyLedger(db as never)

    expect(result).toMatchObject({
      verified: false,
      brokenAt: { sessionId: 'sess-a', recordId: 'seed', reason: 'coverage_incomplete' },
    })
  })

  it('allows pending roster rows while a session is unresolved', async () => {
    const pending = makeRow({ id: 'pending', status: 'pending' })
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [pending, a1] } })

    const result = await service.verifyLedger(db as never)

    expect(result).toEqual({ verified: true, recordsChecked: 1, sessionsChecked: 1 })
  })

  it('verifies against daily anchors: presence + non-shrinking count', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2')
    const db = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [a1, a2] },
      anchors: [
        {
          id: 'anchor-1',
          metadata: {
            date: '2026-07-14',
            lastRecordHash: a2.recordHash,
            recordsCounted: 2,
            sessionId: 'sess-a',
            recordId: 'a2',
          },
        },
      ],
    })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(true)
    expect(result.lastAnchorDate).toBe('2026-07-14')
  })

  it('tolerates chains that grew beyond an anchor through late-arriving rows', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2')
    const a3 = chained('a3', 3, a2.recordHash, 'sess-a', 'stu-3')
    const db = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [a1, a2, a3] },
      anchors: [
        {
          id: 'anchor-1',
          metadata: { date: '2026-07-14', lastRecordHash: a2.recordHash, recordsCounted: 2 },
        },
      ],
    })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(true)
    expect(result.recordsChecked).toBe(3)
  })

  it('reports anchor_mismatch when the anchored day lost rows', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2')
    const db = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [a1] },
      anchors: [
        {
          id: 'anchor-1',
          metadata: {
            date: '2026-07-14',
            lastRecordHash: a2.recordHash,
            recordsCounted: 2,
            sessionId: 'sess-a',
            recordId: 'a2',
          },
        },
      ],
    })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(false)
    expect(result.brokenAt).toEqual({ sessionId: 'sess-a', recordId: 'a2', reason: 'anchor_mismatch' })
  })

  it('reports anchor_mismatch when the anchored head hash no longer exists', async () => {
    const a1 = chained('a1', 1, null, 'sess-a', 'stu-1')
    const a2 = chained('a2', 2, a1.recordHash, 'sess-a', 'stu-2')
    const db = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [a1, a2] },
      anchors: [
        { id: 'anchor-1', metadata: { date: '2026-07-14', lastRecordHash: 'rewritten-elsewhere', recordsCounted: 2 } },
      ],
    })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(false)
    expect(result.brokenAt?.reason).toBe('anchor_mismatch')
  })

  it('handles empty ledgers and days without anchors', async () => {
    const db = makeDb({ sessions: ['sess-a'], rowsBySession: { 'sess-a': [] } })

    const result = await service.verifyLedger(db as never)

    expect(result).toEqual({ verified: true, recordsChecked: 0, sessionsChecked: 0 })

    const noAnchor = makeDb({
      sessions: ['sess-a'],
      rowsBySession: { 'sess-a': [chained('a1', 1, null, 'sess-a', 'stu-1')] },
    })
    const withoutAnchor = await service.verifyLedger(noAnchor as never)
    expect(withoutAnchor).toEqual({ verified: true, recordsChecked: 1, sessionsChecked: 1 })
  })

  it('keeps checking every session page while streaming', async () => {
    const sessions = ['s1', 's2', 's3']
    const rowsBySession: Record<string, ChainRow[]> = {}
    sessions.forEach((sessionId, index) => {
      rowsBySession[sessionId] = [chained(`r${index}`, 1, null, sessionId, `stu-${index}`)]
    })
    const db = makeDb({ sessions, rowsBySession })

    const result = await service.verifyLedger(db as never)

    expect(result.verified).toBe(true)
    expect(result.sessionsChecked).toBe(3)
    expect(db.attendanceRecord.findMany).toHaveBeenCalledTimes(3)
  })
})
