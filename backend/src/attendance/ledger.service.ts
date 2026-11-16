import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { computeRecordHash, generateLedgerSalt, ledgerDateOf, type LedgerVerifyResult } from '@polycheck/shared/ledger'

export interface LedgerAppendRecord {
  id: string
  sessionId: string
  studentId: string
  timestamp: Date
}

export type LedgerDb = Pick<Prisma.TransactionClient, 'attendanceRecord' | 'auditLog' | 'session'>

const VERIFY_SESSION_PAGE_SIZE = 50
const MAX_ANCHOR_ROWS = 30

interface AnchorMetadata {
  date?: string
  lastRecordHash?: string
  recordsCounted?: number
  sessionId?: string
  recordId?: string
}

interface DateBucket {
  count: number
  hashes: Set<string>
  headHash?: string
  headRowId?: string
  headKey?: string
  sessionId?: string
}

// Chain coverage invariant: a row is chained exactly once, at the moment its
// committed state (timestamp, studentId, sessionId) is written. Hashed fields
// are immutable afterwards - a row whose `recordHash` is already set is an
// idempotent no-op for every later update (online check-out leg, manual
// overrides). Verify treats rows without `recordHash` (roster seeds resolved
// without scan evidence) as simply not being on the chain, so coverage grows
// as rows receive committed decisions.
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fail-closed chain append. Runs inside the caller's transaction: any error
   * propagates and rolls back the whole attendance commit, so an attendance
   * row can never exist without chain state. A per-session PostgreSQL advisory
   * lock serializes classroom bursts across instances; the head is read inside
   * the transaction afterwards. A row that already carries `recordHash` stays
   * untouched (chain nodes are immutable).
   */
  async appendLedger(tx: Prisma.TransactionClient, record: LedgerAppendRecord, prev?: string | null) {
    try {
      // hashtext returns int4; the single-arg xact-lock overload takes bigint.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${record.sessionId})::bigint)`
      const existing = await tx.attendanceRecord.findUnique({
        where: { id: record.id },
        select: { recordHash: true },
      })
      if (!existing) throw new Error(`attendance record ${record.id} disappeared before its chain append`)
      if (existing.recordHash) return existing.recordHash

      let prevHash: string | null
      if (arguments.length >= 3) {
        prevHash = prev ?? null
      } else {
        const head = await tx.attendanceRecord.findFirst({
          where: { sessionId: record.sessionId, id: { not: record.id }, recordHash: { not: null } },
          // Write order, not scan time: the ingestion drainer selects its head
          // the same way, so both writers agree on the session head. Scan
          // timestamps are payload data (they can arrive out of order via offline
          // replay); createdAt is the closest available write-order proxy without
          // a chain-position column.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { recordHash: true },
        })
        prevHash = head?.recordHash ?? null
      }
      const salt = generateLedgerSalt()
      const recordHash = computeRecordHash({
        prevHash,
        studentId: record.studentId,
        timestampIso: record.timestamp.toISOString(),
        sessionId: record.sessionId,
        salt,
      })
      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { prevHash, recordHash, salt },
      })
      return recordHash
    } catch (error) {
      this.logger.error(
        `Ledger append failed for attendance record ${record.id} in session ${record.sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      throw error
    }
  }

  /**
   * Read-only tamper verification (WF-LD11): recompute every chained row from
   * its stored inputs, check that each row's `prevHash` references a record
   * that exists in its session (arrival-order linkage - offline batches chain
   * in server-arrival order while hashing their own scan timestamps), then
   * compare daily anchors: the anchored head hash must still exist in that
   * day's chain and the day's recomputed row count must not shrink (chains may
   * grow beyond an anchor through late-arriving offline rows, never shrink
   * without tampering). Stops at the first inconsistency.
   *
   * The result never claims integrity it did not check: an empty table, or a
   * table whose rows all lack a `recordHash` (a fresh seed before the ledger
   * backfill), reports `insufficient_data` rather than `verified: true`.
   */
  async verifyLedger(db: LedgerDb): Promise<LedgerVerifyResult> {
    let cursor: string | undefined
    let recordsChecked = 0
    let sessionsChecked = 0
    const buckets = new Map<string, DateBucket>()

    const [totalRecords, hashedRecords] = await Promise.all([
      db.attendanceRecord.count(),
      db.attendanceRecord.count({ where: { recordHash: { not: null } } }),
    ])
    const unhashedRecords = Math.max(0, totalRecords - hashedRecords)
    if (hashedRecords === 0) {
      this.logger.warn(`Ledger verification found nothing to check: ${totalRecords} attendance row(s), none chained`)
      return {
        status: 'insufficient_data',
        verified: false,
        recordsChecked: 0,
        sessionsChecked: 0,
        unhashedRecords,
      }
    }

    while (true) {
      const sessions = await db.session.findMany({
        where: cursor ? { id: { gt: cursor } } : undefined,
        orderBy: { id: 'asc' },
        take: VERIFY_SESSION_PAGE_SIZE,
        select: { id: true },
      })
      if (sessions.length === 0) break
      cursor = sessions[sessions.length - 1].id
      for (const session of sessions) {
        const rows = await db.attendanceRecord.findMany({
          where: { sessionId: session.id, recordHash: { not: null } },
          orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
          select: { id: true, recordHash: true, prevHash: true, salt: true, studentId: true, timestamp: true },
        })
        if (rows.length === 0) continue
        sessionsChecked += 1
        const chainedHashes = new Set<string>()
        for (const row of rows) chainedHashes.add(row.recordHash as string)
        for (const row of rows) {
          const recomputed = computeRecordHash({
            prevHash: row.prevHash,
            studentId: row.studentId,
            timestampIso: row.timestamp.toISOString(),
            sessionId: session.id,
            salt: row.salt ?? '',
          })
          if (recomputed !== row.recordHash) {
            return this.broken(session.id, row.id, 'hash_mismatch', recordsChecked, sessionsChecked, unhashedRecords)
          }
          if (row.prevHash !== null && !chainedHashes.has(row.prevHash)) {
            return this.broken(session.id, row.id, 'link_mismatch', recordsChecked, sessionsChecked, unhashedRecords)
          }
          recordsChecked += 1
          this.collectBucket(buckets, session.id, row)
        }
      }
    }

    const anchors = await db.auditLog.findMany({
      where: { action: 'ledger.anchored' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_ANCHOR_ROWS,
    })
    return this.checkAnchors(buckets, anchors, recordsChecked, sessionsChecked, unhashedRecords)
  }

  private collectBucket(
    buckets: Map<string, DateBucket>,
    sessionId: string,
    row: {
      id: string
      recordHash: string | null
      timestamp: Date
    },
  ) {
    const date = ledgerDateOf(row.timestamp)
    const bucket = buckets.get(date) ?? { count: 0, hashes: new Set<string>() }
    const key = `${row.timestamp.toISOString()}|${row.id}`
    bucket.count += 1
    bucket.hashes.add(row.recordHash as string)
    if (bucket.headKey === undefined || key > bucket.headKey) {
      bucket.headKey = key
      bucket.headHash = row.recordHash as string
      bucket.headRowId = row.id
      bucket.sessionId = sessionId
    }
    buckets.set(date, bucket)
  }

  private checkAnchors(
    buckets: Map<string, DateBucket>,
    anchors: { id: string; metadata: Prisma.JsonValue | null }[],
    recordsChecked: number,
    sessionsChecked: number,
    unhashedRecords: number,
  ): LedgerVerifyResult {
    const checkedDates: string[] = []
    const seenDates = new Set<string>()
    for (const anchor of anchors) {
      const meta = (anchor.metadata ?? null) as AnchorMetadata | null
      const date = typeof meta?.date === 'string' ? meta.date : undefined
      if (!date || seenDates.has(date)) continue
      seenDates.add(date)
      const expected = Number(meta?.recordsCounted ?? 0)
      if (expected <= 0) continue
      checkedDates.push(date)
      const bucket = buckets.get(date)
      if (!bucket) {
        return this.broken(
          meta?.sessionId ?? '',
          meta?.recordId ?? anchor.id,
          'anchor_mismatch',
          recordsChecked,
          sessionsChecked,
          unhashedRecords,
        )
      }
      if (bucket.count < expected || (meta?.lastRecordHash && !bucket.hashes.has(meta.lastRecordHash))) {
        return this.broken(
          bucket.sessionId ?? meta?.sessionId ?? '',
          meta?.recordId ?? bucket.headRowId ?? anchor.id,
          'anchor_mismatch',
          recordsChecked,
          sessionsChecked,
          unhashedRecords,
        )
      }
    }
    if (checkedDates.length === 0) {
      return { status: 'verified', verified: true, recordsChecked, sessionsChecked, unhashedRecords }
    }
    return {
      status: 'verified',
      verified: true,
      recordsChecked,
      sessionsChecked,
      unhashedRecords,
      lastAnchorDate: checkedDates.sort().pop(),
    }
  }

  private broken(
    sessionId: string,
    recordId: string,
    reason: 'hash_mismatch' | 'link_mismatch' | 'anchor_mismatch',
    recordsChecked: number,
    sessionsChecked: number,
    unhashedRecords: number,
  ): LedgerVerifyResult {
    this.logger.warn(`Ledger verification failed at ${reason} for record ${recordId} in session ${sessionId}`)
    return {
      status: 'broken',
      verified: false,
      recordsChecked,
      sessionsChecked,
      unhashedRecords,
      brokenAt: { sessionId, recordId, reason },
    }
  }
}
