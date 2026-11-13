/**
 * Postgres writer for buffered scans. Raw SQL on purpose: the drainer needs one
 * lock, four lookups and a batched write — an ORM (and a second generated
 * client) would buy nothing and would add a build coupling between the two
 * services.
 *
 * Contract with the request path: the gateway accepts optimistically and this
 * writer is the **authoritative** check. The teacher signing key is re-read here
 * (NestJS deliberately never trusts a cached key for verification), so a rotated
 * or revoked key cannot be honoured by the fast path. A signature that fails at
 * this point is still persisted — as a disputed record for teacher review.
 *
 * Ordering invariant: within a session, rows are chained in stream-arrival
 * order. The whole batch is computed and written under one
 * transaction-scoped advisory lock. The per-row round trips of the original
 * writer made one 200-entry drain batch take seconds (≈4 ms/scan); the writer
 * now emits **one multi-row INSERT and one batched claim UPDATE** per session,
 * so a batch costs a constant number of queries no matter how many scans it
 * carries. Ordering is unchanged: hashes are computed sequentially in arrival
 * order, and the statements only store the values computed for each position.
 */
import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'
import { computeRecordHash, generateLedgerSalt } from '@polycheck/shared/ledger'
import type { AttendanceWriter, BufferedScan } from './queue'

interface ExistingRow {
  recordHash: string | null
  status: string
}

interface PreparedRow {
  scan: BufferedScan
  mode: 'insert' | 'claim'
  id: string
  status: 'present' | 'late' | 'disputed' | 'incomplete'
  prevHash: string | null
  recordHash: string
  salt: string
  disputeReason: string | null
  disputeDescription: string | null
  disputePreviousStatus: string | null
  notes: string | null
  createdAt: string
}

const INSERT_COLUMNS = `id, "sessionId", "sectionId", "studentId", "studentName",
  timestamp, status, latitude, longitude, "deviceId", "tokenSnapshot",
  "isSynced", "syncedAt", "prevHash", "recordHash", salt,
  "disputeReason", "disputeDescription", "disputePreviousStatus",
  notes, "manuallySet", "createdAt", "updatedAt"`

const INSERT_PARAMS_PER_ROW = 20

/**
 * Builds one `INSERT … VALUES (…), (…)` for every newly-seen scan. `isSynced`
 * and `manuallySet` are literals; `updatedAt` reuses the row's `createdAt`
 * parameter (Postgres allows one placeholder to appear twice).
 */
function buildInsert(sessionId: string, rows: PreparedRow[], nameById: Map<string, string>) {
  const values: unknown[] = []
  const tuples = rows.map((row, index) => {
    const b = index * INSERT_PARAMS_PER_ROW
    const p = (offset: number) => `$${b + offset}`
    values.push(
      row.id,
      sessionId,
      row.scan.sectionId,
      row.scan.userId,
      nameById.get(row.scan.userId) ?? '',
      row.scan.scannedAt,
      row.status,
      row.scan.latitude ?? null,
      row.scan.longitude ?? null,
      row.scan.deviceId ?? null,
      row.scan.qrToken,
      row.createdAt,
      row.prevHash,
      row.recordHash,
      row.salt,
      row.disputeReason,
      row.disputeDescription,
      row.disputePreviousStatus,
      row.notes,
      row.createdAt,
    )
    return `(${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},
      (${p(6)}::timestamptz AT TIME ZONE 'UTC'),${p(7)}::"AttendanceStatus",
      ${p(8)},${p(9)},${p(10)},${p(11)},true,
      (${p(12)}::timestamptz AT TIME ZONE 'UTC'),${p(13)},${p(14)},${p(15)},
      ${p(16)},${p(17)},
      CASE WHEN ${p(18)}::text IS NULL THEN NULL ELSE ${p(18)}::text::"AttendanceStatus" END,
      ${p(19)},false,
      (${p(20)}::timestamptz AT TIME ZONE 'UTC'),(${p(20)}::timestamptz AT TIME ZONE 'UTC'))`
  })
  return {
    sql: `INSERT INTO "AttendanceRecord" (${INSERT_COLUMNS}) VALUES ${tuples.join(',')}
      ON CONFLICT ("sessionId", "studentId") DO NOTHING
      RETURNING id`,
    values,
  }
}

const CLAIM_PARAMS_PER_ROW = 15

/**
 * One `UPDATE … FROM (VALUES …)` claims every pre-seeded `pending` row in the
 * batch. The guard (`status = 'pending' AND recordHash IS NULL`) is unchanged
 * from the per-row version: a teacher decision or an already-chained row wins
 * and the caller treats that scan as a duplicate.
 */
function buildClaim(sessionId: string, rows: PreparedRow[]) {
  const values: unknown[] = [sessionId]
  const tuples = rows.map((row, index) => {
    const b = 1 + index * CLAIM_PARAMS_PER_ROW
    const p = (offset: number) => `$${b + offset}`
    values.push(
      row.scan.userId,
      row.status,
      row.scan.scannedAt,
      row.scan.latitude ?? null,
      row.scan.longitude ?? null,
      row.scan.deviceId ?? null,
      row.prevHash,
      row.recordHash,
      row.salt,
      row.disputeReason,
      row.disputeDescription,
      row.disputePreviousStatus,
      row.notes,
      row.createdAt,
      row.createdAt,
    )
    return `(${p(1)}::text,${p(2)}::"AttendanceStatus",
      (${p(3)}::timestamptz AT TIME ZONE 'UTC'),${p(4)}::float8,${p(5)}::float8,
      ${p(6)}::text,${p(7)}::text,${p(8)}::text,${p(9)}::text,
      ${p(10)}::text,${p(11)}::text,
      CASE WHEN ${p(12)}::text IS NULL THEN NULL ELSE ${p(12)}::text::"AttendanceStatus" END,
      ${p(13)}::text,
      (${p(14)}::timestamptz AT TIME ZONE 'UTC'),(${p(15)}::timestamptz AT TIME ZONE 'UTC'))`
  })
  return {
    sql: `UPDATE "AttendanceRecord" AS r SET
        status = v.status,
        timestamp = v.timestamp,
        latitude = v.latitude,
        longitude = v.longitude,
        "deviceId" = v."deviceId",
        "prevHash" = v."prevHash",
        "recordHash" = v."recordHash",
        salt = v.salt,
        "disputeReason" = v."disputeReason",
        "disputeDescription" = v."disputeDescription",
        "disputePreviousStatus" = v."disputePreviousStatus",
        notes = v.notes,
        "isSynced" = true,
        "syncedAt" = v."syncedAt",
        "updatedAt" = v."syncedAt",
        "createdAt" = v."createdAt"
      FROM (VALUES ${tuples.join(',')}) AS v(
        "studentId", status, timestamp, latitude, longitude, "deviceId",
        "prevHash", "recordHash", salt, "disputeReason", "disputeDescription",
        "disputePreviousStatus", notes, "syncedAt", "createdAt")
      WHERE r."sessionId" = $1 AND r."studentId" = v."studentId"
        AND r.status = 'pending' AND r."recordHash" IS NULL
      RETURNING r."studentId"`,
    values,
  }
}

export function createPgWriter(pool: Pool): AttendanceWriter {
  return {
    async writeBatch(sessionId, scans) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // `AttendanceRecord.timestamp` is `timestamp without time zone`
        // (Prisma's default), so the naive instant depends on the session time
        // zone. The control plane runs UTC; pin it per transaction so a gateway
        // started on a non-UTC host cannot write a different instant and break
        // every chain hash it produces. `SET LOCAL` is transaction-scoped and
        // cannot be silently ignored the way a pool option can.
        await client.query("SET LOCAL TIME ZONE 'UTC'")
        // Reads that do not depend on chain order happen BEFORE the lock, so the
        // critical section below is only "read head + write rows".
        const session = await client.query<{ teacherId: string }>(
          'SELECT "teacherId" FROM "Session" WHERE id = $1',
          [sessionId],
        )
        const teacherId = session.rows[0]?.teacherId
        if (!teacherId) throw new Error(`session ${sessionId} disappeared before commit`)

        // Resolved once per batch, never per scan.
        const teacher = await client.query<{ teacherPublicKey: string | null }>(
          'SELECT "teacherPublicKey" FROM "User" WHERE id = $1',
          [teacherId],
        )
        const teacherPublicKey = teacher.rows[0]?.teacherPublicKey ?? null

        const studentIds = [...new Set(scans.map((scan) => scan.userId))]
        const students = await client.query<{ id: string; fullName: string }>(
          'SELECT id, "fullName" FROM "User" WHERE id = ANY($1::text[])',
          [studentIds],
        )
        const nameById = new Map(students.rows.map((row) => [row.id, row.fullName]))

        // One lock acquisition for the whole batch: 2,000 serialised appends
        // become ~40. Stream order is arrival order.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [sessionId])

        // Partition against committed state *inside* the lock: a chained row is
        // a duplicate (first arrival wins), an unchained `pending` seed is
        // claimed, anything else is inserted.
        const existing = await client.query<{ studentId: string } & ExistingRow>(
          `SELECT "studentId", "recordHash", status FROM "AttendanceRecord"
            WHERE "sessionId" = $1 AND "studentId" = ANY($2::text[])`,
          [sessionId, studentIds],
        )
        const existingByStudent = new Map<string, ExistingRow>(
          existing.rows.map((row) => [row.studentId, { recordHash: row.recordHash, status: row.status }]),
        )

        const head = await client.query<{ recordHash: string | null; createdAt: Date }>(
          `SELECT "recordHash", "createdAt" FROM "AttendanceRecord"
            WHERE "sessionId" = $1 AND "recordHash" IS NOT NULL
            ORDER BY "createdAt" DESC LIMIT 1`,
          [sessionId],
        )
        let prevHash = head.rows[0]?.recordHash ?? null
        // Strictly increasing `createdAt` keeps the chain head unambiguous for
        // the next batch even when several rows are written in one statement
        // (ties would make `ORDER BY createdAt DESC` pick an arbitrary row).
        let createdAtMs = Math.max(Date.now(), (head.rows[0]?.createdAt.getTime() ?? 0) + 1)

        let duplicates = 0
        const insertRows: PreparedRow[] = []
        const claimRows: PreparedRow[] = []
        const seen = new Set<string>()

        for (const scan of scans) {
          // Two scans for one student in one batch: the first in arrival order
          // wins, the second is a duplicate, matching the per-row behaviour.
          if (seen.has(scan.userId)) {
            duplicates += 1
            continue
          }
          seen.add(scan.userId)

          const existingRow = existingByStudent.get(scan.userId)
          if (existingRow && (existingRow.recordHash !== null || existingRow.status !== 'pending')) {
            duplicates += 1
            continue
          }

          // Authoritative signature gate. A missing or rotated key fails closed.
          const signatureValid = teacherPublicKey
            ? verifyQRTokenNative(scan.qrToken, teacherPublicKey) !== null
            : false

          const status = signatureValid ? scan.status : 'disputed'
          const reason = signatureValid ? scan.reason : 'invalid_signature'
          const message = signatureValid
            ? scan.message
            : 'QR token signature is invalid (re-verified at commit time).'
          const previousStatus = !signatureValid && scan.status === 'disputed' ? null : scan.status

          const salt = generateLedgerSalt()
          const rowPrevHash = prevHash
          const recordHash = computeRecordHash({
            prevHash: rowPrevHash,
            studentId: scan.userId,
            timestampIso: scan.scannedAt,
            sessionId,
            salt,
          })
          prevHash = recordHash
          createdAtMs += 1

          // Dispute columns are only meaningful for a disputed row.
          const disputeReason = status === 'disputed' ? (reason ?? null) : null
          const disputeDescription = status === 'disputed' ? (message ?? null) : null
          const notes = reason ? `[${reason}] ${message ?? ''}`.trim() : null

          const row: PreparedRow = {
            scan,
            mode: existingRow ? 'claim' : 'insert',
            id: randomUUID(),
            status,
            prevHash: rowPrevHash,
            recordHash,
            salt,
            disputeReason,
            disputeDescription,
            // A disputed claim replaces a roster seed that was `pending`; an
            // inserted row records the scan's own status as the pre-dispute state.
            disputePreviousStatus: status === 'disputed' ? (existingRow ? 'pending' : previousStatus) : null,
            notes,
            createdAt: new Date(createdAtMs).toISOString(),
          }
          if (row.mode === 'insert') insertRows.push(row)
          else claimRows.push(row)
        }

        if (insertRows.length > 0) {
          const insert = buildInsert(sessionId, insertRows, nameById)
          const result = await client.query(insert.sql, insert.values)
          if (result.rowCount !== insertRows.length) {
            // A concurrent writer changed the partition between the read and
            // the write. Roll back and let the drainer retry: the chain must
            // never record a hash that was not persisted.
            throw new Error(`attendance batch insert wrote ${result.rowCount}/${insertRows.length} rows; retrying`)
          }
        }

        if (claimRows.length > 0) {
          const claim = buildClaim(sessionId, claimRows)
          const result = await client.query(claim.sql, claim.values)
          if (result.rowCount !== claimRows.length) {
            // Same fail-closed rule: a row claimed elsewhere (manual override,
            // backend write) means our computed chain included it wrongly.
            throw new Error(`attendance batch claimed ${result.rowCount}/${claimRows.length} seed rows; retrying`)
          }
        }

        await client.query('COMMIT')
        return { written: insertRows.length + claimRows.length, duplicates }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },
  }
}
