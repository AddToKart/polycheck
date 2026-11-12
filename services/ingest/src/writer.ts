/**
 * Postgres writer for buffered scans. Raw SQL on purpose: the drainer needs one
 * lock, four lookups and an insert — an ORM (and a second generated client)
 * would buy nothing and would add a build coupling between the two services.
 *
 * Contract with the request path: the gateway accepts optimistically and this
 * writer is the **authoritative** check. The teacher signing key is re-read here
 * (NestJS deliberately never trusts a cached key for verification), so a rotated
 * or revoked key cannot be honoured by the fast path. A signature that fails at
 * this point is still persisted — as a disputed record for teacher review.
 */
import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { verifyQRToken } from '@polycheck/shared'
import { computeRecordHash, generateLedgerSalt } from '@polycheck/shared/ledger'
import type { AttendanceWriter } from './queue'

const INSERT_SQL = `
INSERT INTO "AttendanceRecord" (
  id, "sessionId", "sectionId", "studentId", "studentName",
  timestamp, status, latitude, longitude, "deviceId", "tokenSnapshot",
  "isSynced", "syncedAt", "prevHash", "recordHash", salt,
  "disputeReason", "disputeDescription", "disputePreviousStatus",
  notes, "manuallySet", "createdAt", "updatedAt"
) VALUES ($1,$2,$3,$4,$5,
  ($6::timestamptz AT TIME ZONE 'UTC'),
  $7::"AttendanceStatus",$8,$9,$10,$11,$12,
  ($13::timestamptz AT TIME ZONE 'UTC'),
  $14,$15,$16,$17,$18,$19::"AttendanceStatus",$20,$21,
  ($22::timestamptz AT TIME ZONE 'UTC'),
  ($23::timestamptz AT TIME ZONE 'UTC'))
ON CONFLICT ("sessionId", "studentId") DO NOTHING
RETURNING id
`

/**
 * Activation pre-seeds a `pending` row for every enrolled student, so a scan
 * usually finds an existing row rather than inserting one. Claiming that row is
 * the difference between "attendance recorded" and "the scan was silently
 * dropped" — the original ON CONFLICT DO NOTHING treated the roster seed as a
 * duplicate and left the student pending forever.
 *
 * The guard is deliberately narrow: only a row that is still `pending` **and**
 * has no chain hash may be claimed. A teacher's manual decision or an
 * already-chained row wins (first arrival), and `timestamp` is never rewritten
 * because it is part of the hash preimage.
 */
const CLAIM_SQL = `
UPDATE "AttendanceRecord" SET
  status = $3::"AttendanceStatus",
  timestamp = ($15::timestamptz AT TIME ZONE 'UTC'),
  latitude = $4,
  longitude = $5,
  "deviceId" = $6,
  "prevHash" = $7,
  "recordHash" = $8,
  salt = $9,
  "disputeReason" = $10,
  "disputeDescription" = $11,
  "disputePreviousStatus" = CASE WHEN $12::text IS NULL THEN NULL ELSE $12::"AttendanceStatus" END,
  notes = $13,
  "isSynced" = true,
  "syncedAt" = ($14::timestamptz AT TIME ZONE 'UTC'),
  "updatedAt" = ($14::timestamptz AT TIME ZONE 'UTC')
WHERE "sessionId" = $1 AND "studentId" = $2
  AND status = 'pending' AND "recordHash" IS NULL
RETURNING id
`

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
        // critical section below is only "read head + insert rows". This is the
        // difference between a ~6-query lock hold and a ~2-query one per batch.
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

        const last = await client.query<{ recordHash: string | null }>(
          `SELECT "recordHash" FROM "AttendanceRecord"
            WHERE "sessionId" = $1 AND "recordHash" IS NOT NULL
            ORDER BY "createdAt" DESC LIMIT 1`,
          [sessionId],
        )
        let prevHash = last.rows[0]?.recordHash ?? null

        let written = 0
        let duplicates = 0

        for (const scan of scans) {
          // Authoritative signature gate. A missing or rotated key fails closed.
          const signatureValid = teacherPublicKey
            ? verifyQRToken(scan.qrToken, teacherPublicKey) !== null
            : false

          const status = signatureValid ? scan.status : 'disputed'
          const reason = signatureValid ? scan.reason : 'invalid_signature'
          const message = signatureValid
            ? scan.message
            : 'QR token signature is invalid (re-verified at commit time).'
          const previousStatus = !signatureValid && scan.status === 'disputed' ? null : scan.status

          const salt = generateLedgerSalt()
          const recordHash = computeRecordHash({
            prevHash,
            studentId: scan.userId,
            timestampIso: scan.scannedAt,
            sessionId,
            salt,
          })
          // ISO strings, not Date objects: node-postgres serialises a Date for a
          // `timestamp` column from the client's local clock and would bypass
          // the UTC session timezone set above.
          const now = new Date().toISOString()

          // Dispute columns are only meaningful for a disputed row.
          const disputeReason = status === 'disputed' ? (reason ?? null) : null
          const disputeDescription = status === 'disputed' ? (message ?? null) : null
          const notes = reason ? `[${reason}] ${message ?? ''}`.trim() : null

          const insert = await client.query(INSERT_SQL, [
            randomUUID(),
            sessionId,
            scan.sectionId,
            scan.userId,
            nameById.get(scan.userId) ?? '',
            scan.scannedAt,
            status,
            scan.latitude ?? null,
            scan.longitude ?? null,
            scan.deviceId ?? null,
            scan.qrToken,
            true,
            now,
            prevHash,
            recordHash,
            salt,
            disputeReason,
            disputeDescription,
            status === 'disputed' ? previousStatus : null,
            notes,
            false,
            now,
            now,
          ])

          if (insert.rowCount === 1) {
            prevHash = recordHash
            written += 1
            continue
          }

          // The row already exists because activation pre-seeded the roster.
          // Claim it only while it is still pending and unchained; otherwise the
          // earlier decision wins and this scan is a duplicate.
          const claim = await client.query(CLAIM_SQL, [
            sessionId,
            scan.userId,
            status,
            scan.latitude ?? null,
            scan.longitude ?? null,
            scan.deviceId ?? null,
            prevHash,
            recordHash,
            salt,
            disputeReason,
            disputeDescription,
            status === 'disputed' ? 'pending' : null,
            notes,
            now,
            // The chain preimage uses this exact timestamp, so the claimed row
            // must store the same value (the roster seed carried its own time,
            // which no longer matches the hash once the scan claims it).
            scan.scannedAt,
          ])
          if (claim.rowCount === 1) {
            prevHash = recordHash
            written += 1
          } else {
            duplicates += 1
          }
        }

        await client.query('COMMIT')
        return { written, duplicates }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },
  }
}
