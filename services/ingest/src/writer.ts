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
import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'
import { computeRecordHash, generateLedgerSalt } from '@polycheck/shared/ledger'
import type { AttendanceWriter, BufferedScan } from './queue'
import { PermanentWriteError } from './queue'

interface ExistingRow {
  recordHash: string | null
  status: string
}

interface PreparedRow {
  scan: BufferedScan
  mode: 'insert' | 'claim'
  id: string
  /** `ScanAttempt` row id, or null when attempt persistence is disabled. */
  attemptId: string | null
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
  notes, "manuallySet", "acceptedScanAttemptId", "checkInAttemptId", "checkOutAttemptId",
  "createdAt", "updatedAt"`

// 23 placeholders per row: 26 columns, minus the two SQL literals (`isSynced`,
// `manuallySet`), minus `updatedAt` which reuses the `createdAt` parameter.
const INSERT_PARAMS_PER_ROW = 23

/**
 * The per-leg attempt FK the control plane sets for the same scan
 * (`scan-validator.service.ts` / `attendance.service.ts`). In-person rows use
 * the single accepted-attempt link; online checkpoints use their own leg.
 */
function attemptLinkColumns(scan: BufferedScan): { accepted: boolean; checkIn: boolean; checkOut: boolean } {
  if (scan.mode === 'online' && scan.checkpoint === 'end') {
    return { accepted: false, checkIn: false, checkOut: true }
  }
  if (scan.mode === 'online' && scan.checkpoint === 'start') {
    return { accepted: false, checkIn: true, checkOut: false }
  }
  return { accepted: true, checkIn: false, checkOut: false }
}

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
    const link = attemptLinkColumns(row.scan)
    const attempt = row.attemptId
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
      link.accepted ? attempt : null,
      link.checkIn ? attempt : null,
      link.checkOut ? attempt : null,
      row.createdAt,
    )
    return `(${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},
      (${p(6)}::timestamptz AT TIME ZONE 'UTC'),${p(7)}::"AttendanceStatus",
      ${p(8)},${p(9)},${p(10)},${p(11)},true,
      (${p(12)}::timestamptz AT TIME ZONE 'UTC'),${p(13)},${p(14)},${p(15)},
      ${p(16)},${p(17)},
      CASE WHEN ${p(18)}::text IS NULL THEN NULL ELSE ${p(18)}::text::"AttendanceStatus" END,
      ${p(19)},false,${p(20)}::text,${p(21)}::text,${p(22)}::text,
      (${p(23)}::timestamptz AT TIME ZONE 'UTC'),(${p(23)}::timestamptz AT TIME ZONE 'UTC'))`
  })
  return {
    sql: `INSERT INTO "AttendanceRecord" (${INSERT_COLUMNS}) VALUES ${tuples.join(',')}
      ON CONFLICT ("sessionId", "studentId") DO NOTHING
      RETURNING id`,
    values,
  }
}

// 18 placeholders per row: 16 value columns plus the `syncedAt`/`createdAt`
// pair the SET clause consumes (both reuse the row's createdAt parameter).
const CLAIM_PARAMS_PER_ROW = 18

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
    const link = attemptLinkColumns(row.scan)
    const attempt = row.attemptId
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
      link.accepted ? attempt : null,
      link.checkIn ? attempt : null,
      link.checkOut ? attempt : null,
      row.createdAt,
      row.createdAt,
    )
    return `(${p(1)}::text,${p(2)}::"AttendanceStatus",
      (${p(3)}::timestamptz AT TIME ZONE 'UTC'),${p(4)}::float8,${p(5)}::float8,
      ${p(6)}::text,${p(7)}::text,${p(8)}::text,${p(9)}::text,
      ${p(10)}::text,${p(11)}::text,
      CASE WHEN ${p(12)}::text IS NULL THEN NULL ELSE ${p(12)}::text::"AttendanceStatus" END,
      ${p(13)}::text,${p(14)}::text,${p(15)}::text,${p(16)}::text,
      (${p(17)}::timestamptz AT TIME ZONE 'UTC'),(${p(18)}::timestamptz AT TIME ZONE 'UTC'))`
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
        "acceptedScanAttemptId" = v."acceptedScanAttemptId",
        "checkInAttemptId" = v."checkInAttemptId",
        "checkOutAttemptId" = v."checkOutAttemptId",
        "isSynced" = true,
        "syncedAt" = v."syncedAt",
        "updatedAt" = v."syncedAt",
        "createdAt" = v."createdAt"
      FROM (VALUES ${tuples.join(',')}) AS v(
        "studentId", status, timestamp, latitude, longitude, "deviceId",
        "prevHash", "recordHash", salt, "disputeReason", "disputeDescription",
        "disputePreviousStatus", notes, "acceptedScanAttemptId", "checkInAttemptId",
        "checkOutAttemptId", "syncedAt", "createdAt")
      WHERE r."sessionId" = $1 AND r."studentId" = v."studentId"
        AND r.status = 'pending' AND r."recordHash" IS NULL
      RETURNING r."studentId"`,
    values,
  }
}

const ATTEMPT_PARAMS_PER_ROW = 24

/**
 * One multi-row `INSERT` for the batch's `ScanAttempt` rows — the write the
 * control plane already performs per scan. Forensics (F8 timeline) and the
 * geofence radar (F2) read this table, so without it the gateway path is
 * invisible to both.
 *
 * `(studentId, clientAttemptId)` is unique. A conflict can only mean another
 * process already recorded the same attempt; `DO NOTHING` keeps the earlier row
 * and the returned natural keys map surviving ids back to their scans.
 */
function buildAttemptInsert(sessionId: string, rows: PreparedRow[]) {
  const values: unknown[] = []
  const tuples = rows.map((row, index) => {
    const b = index * ATTEMPT_PARAMS_PER_ROW
    const p = (offset: number) => `$${b + offset}`
    const scan = row.scan
    // RA 10173: online sessions never persist location, matching
    // `buildScanAttemptData` on the control plane.
    const online = scan.mode === 'online'
    values.push(
      row.attemptId,
      sessionId,
      scan.userId,
      scan.clientAttemptId ?? null,
      scan.scannedAt,
      // A live scan was timed by the receive clock (ING-01), so there is no
      // separate client timestamp to record; an offline replay carries one.
      scan.offline ? scan.scannedAt : null,
      scan.receivedAt,
      online ? null : (scan.locationCapturedAt ?? null),
      online ? null : (scan.latitude ?? null),
      online ? null : (scan.longitude ?? null),
      online ? null : (scan.accuracyMeters ?? null),
      online ? null : (scan.mocked ?? null),
      scan.inputChannel ?? null,
      scan.checkpoint ?? null,
      scan.pinVerified ?? null,
      scan.deviceId ?? null,
      scan.offline,
      scan.distanceMeters ?? null,
      // The column is INTEGER and `'30.5'::int` is a 22P02 — which quarantines
      // the WHOLE batch, legitimate scans included. The value comes from an
      // `Int` column so it is integral in practice; rounding here keeps a
      // malformed cached snapshot from taking the batch down with it.
      scan.geofenceRadiusMeters === undefined || scan.geofenceRadiusMeters === null
        ? null
        : Math.round(scan.geofenceRadiusMeters),
      JSON.stringify(scan.riskSignals ?? []),
      // `outcome` matches the control plane: a flagged (disputed) attempt is
      // `flagged`; everything else is its committed status.
      row.status === 'disputed' ? 'flagged' : row.status,
      row.disputeReason,
      // Same message the control plane stores, so the forensics rail renders
      // gateway attempts with the same copy.
      row.status === 'disputed' ? (row.disputeDescription ?? null) : null,
      // The gateway already hashed the token on the accept path; only hash here
      // when the buffered scan predates that field.
      scan.tokenHash ??
        (scan.qrToken ? createHash('sha256').update(scan.qrToken).digest('hex') : null),
    )
    return `(${p(1)}::text,${p(2)}::text,${p(3)}::text,${p(4)}::text,
      (${p(5)}::timestamptz AT TIME ZONE 'UTC'),(${p(6)}::timestamptz AT TIME ZONE 'UTC'),
      (${p(7)}::timestamptz AT TIME ZONE 'UTC'),(${p(8)}::timestamptz AT TIME ZONE 'UTC'),
      ${p(9)}::float8,${p(10)}::float8,${p(11)}::float8,${p(12)}::boolean,
      ${p(13)}::text,${p(14)}::text,${p(15)}::boolean,${p(16)}::text,${p(17)}::boolean,
      ${p(18)}::float8,${p(19)}::int,${p(20)}::jsonb,${p(21)}::text,${p(22)}::text,${p(23)}::text,${p(24)}::text)`
  })
  return {
    sql: `INSERT INTO "ScanAttempt"
      (id, "sessionId", "studentId", "clientAttemptId", timestamp, "clientScannedAt",
        "receivedAt", "locationCapturedAt", latitude, longitude, "accuracyMeters",
        mocked, "inputChannel", checkpoint, "pinVerified", "deviceId", offline,
        "distanceMeters", "geofenceRadiusMeters", "riskSignals", outcome, reason, message, "tokenHash")
      VALUES ${tuples.join(',')}
      ON CONFLICT ("studentId", "clientAttemptId") DO NOTHING
      RETURNING id, "studentId", "clientAttemptId"`,
    values,
  }
}

const attemptKey = (studentId: string, clientAttemptId: string | null) =>
  `${studentId}\u0000${clientAttemptId ?? ''}`

/**
 * ING-02 commit-time membership gate. Returns the dispute to stamp, or `null`
 * when the scan is still legitimate. Order matters: an explicit teacher block
 * outranks a plain missing enrollment, and a cooldown is the least specific.
 */
function classifyMembership(
  studentId: string,
  enrolled: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  cooledDown: ReadonlySet<string>,
): { reason: string; message: string } | null {
  if (blocked.has(studentId)) {
    return {
      reason: 'student_blocked_from_section',
      message: 'This student was removed from the section and cannot check in.',
    }
  }
  if (!enrolled.has(studentId)) {
    return {
      reason: 'student_not_enrolled',
      message: 'This student was not enrolled in the section when the scan committed.',
    }
  }
  if (cooledDown.has(studentId)) {
    return {
      reason: 'device_cooldown_active',
      message: 'This account is inside a device-cooldown window and requires instructor review.',
    }
  }
  return null
}

export interface PgWriterOptions {
  /**
   * ING-09: write one `ScanAttempt` row per committed scan and link accepted
   * rows. Default true; the drain benchmark can disable it via
   * `INGEST_PERSIST_SCAN_ATTEMPTS=false`.
   */
  persistScanAttempts?: boolean
}

export function createPgWriter(pool: Pool, options: PgWriterOptions = {}): AttendanceWriter {
  const persistAttempts = options.persistScanAttempts ?? true
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
        const session = await client.query<{ teacherId: string; sectionId: string }>(
          'SELECT "teacherId", "sectionId" FROM "Session" WHERE id = $1',
          [sessionId],
        )
        const sessionRow = session.rows[0]
        const teacherId = sessionRow?.teacherId
        if (!sessionRow || !teacherId) {
          // The session was deleted after the gateway accepted the scan. No
          // retry can recreate it, so quarantine rather than retry forever.
          throw new PermanentWriteError(`session ${sessionId} disappeared before commit`)
        }
        // `Session.sectionId` is immutable, so resolving it outside the lock is
        // safe and lets the membership gate below use plain equality.
        const sectionId = sessionRow.sectionId

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

        // ING-02: membership/cooldown re-checks at commit time. The gateway
        // validates against a cached snapshot, so a student removed, blocked or
        // cooled down since the request must not silently land a `present` row.
        // All three predicates come back in ONE round-trip (they are correlated
        // subqueries, not joins, so a student can appear in several sets) and
        // they sit inside the advisory lock, so the window before the write is
        // as small as the control plane's own in-transaction recheck.
        //
        // Deferred deliberately: the V2 concurrent-session conflict check stays
        // control-plane-only. It needs a second window/date join per scan and
        // never drops a legitimate record (the first class always wins), so the
        // ingest hot path keeps its constant query count until a follow-up.
        const membership = await client.query<{
          studentId: string
          enrolled: boolean
          blocked: boolean
          cooledDown: boolean
        }>(
          `SELECT u.id AS "studentId",
                  EXISTS (
                    SELECT 1 FROM "Enrollment" e
                     WHERE e."sectionId" = $1 AND e."studentId" = u.id
                  ) AS enrolled,
                  EXISTS (
                    SELECT 1 FROM "EnrollmentTombstone" t
                     WHERE t."sectionId" = $1 AND t."studentId" = u.id
                  ) AS blocked,
                  (
                    u."deviceCooldownUntil" > now() AND u."boundDeviceId" IS NULL
                  ) AS "cooledDown"
             FROM "User" u
            WHERE u.id = ANY($2::text[])`,
          [sectionId, studentIds],
        )
        const enrolled = new Set<string>()
        const blocked = new Set<string>()
        const cooledDown = new Set<string>()
        for (const row of membership.rows) {
          if (row.enrolled) enrolled.add(row.studentId)
          if (row.blocked) blocked.add(row.studentId)
          if (row.cooledDown) cooledDown.add(row.studentId)
        }

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

          // Authoritative signature gate. A missing or rotated key fails closed,
          // and it takes precedence over every membership re-check.
          const signatureValid = teacherPublicKey
            ? verifyQRTokenNative(scan.qrToken, teacherPublicKey) !== null
            : false

          // ING-02: membership/cooldown gates, applied only to otherwise-valid
          // scans. These are committed as disputed rows (teacher-visible), never
          // dropped, and still occupy their arrival-order chain position.
          const membership = signatureValid ? classifyMembership(scan.userId, enrolled, blocked, cooledDown) : null

          const status: PreparedRow['status'] = !signatureValid || membership ? 'disputed' : scan.status
          const reason = !signatureValid ? 'invalid_signature' : (membership?.reason ?? scan.reason)
          const message = !signatureValid
            ? 'QR token signature is invalid (re-verified at commit time).'
            : (membership?.message ?? scan.message)

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
            attemptId: persistAttempts ? randomUUID() : null,
            status,
            prevHash: rowPrevHash,
            recordHash,
            salt,
            disputeReason,
            disputeDescription,
            // ING-03: a committed `disputed` row has no restorable prior state,
            // so an inserted one stamps NULL (teacher Reject restores the safe
            // `absent` default). A claim replaces a roster seed that was
            // `pending`, which is the correct restore target.
            disputePreviousStatus: status === 'disputed' ? (existingRow ? 'pending' : null) : null,
            notes,
            createdAt: new Date(createdAtMs).toISOString(),
          }
          if (row.mode === 'insert') insertRows.push(row)
          else claimRows.push(row)
        }

        if (insertRows.length > 0 || claimRows.length > 0) {
          // ING-09: the `ScanAttempt` insert must precede the record write so the
          // FK columns resolve. One statement per batch keeps the transaction
          // count identical; the kill switch skips it entirely.
          if (persistAttempts) {
            const written = [...insertRows, ...claimRows]
            const attempts = buildAttemptInsert(sessionId, written)
            const result = await client.query<{ id: string; studentId: string; clientAttemptId: string | null }>(
              attempts.sql,
              attempts.values,
            )
            const surviving = new Map<string, string>()
            for (const row of result.rows) {
              surviving.set(attemptKey(row.studentId, row.clientAttemptId), row.id)
            }
            // A conflicting `(studentId, clientAttemptId)` kept an earlier row
            // and `DO NOTHING` did not return it. Re-read those ids so the
            // record still links to the surviving attempt instead of failing
            // the FK check on an id that was never written.
            const unresolved = written.filter((row) => !surviving.has(attemptKey(row.scan.userId, row.scan.clientAttemptId ?? null)))
            if (unresolved.length > 0) {
              const pairs = unresolved
                .filter((row) => row.scan.clientAttemptId)
                .map((row) => ({ studentId: row.scan.userId, clientAttemptId: row.scan.clientAttemptId as string }))
              if (pairs.length > 0) {
                const existingAttempts = await client.query<{
                  id: string
                  studentId: string
                  clientAttemptId: string
                }>(
                  `SELECT id, "studentId", "clientAttemptId" FROM "ScanAttempt"
                    WHERE "sessionId" = $1
                      AND ("studentId", "clientAttemptId") IN (SELECT * FROM unnest($2::text[], $3::text[]))`,
                  [sessionId, pairs.map((pair) => pair.studentId), pairs.map((pair) => pair.clientAttemptId)],
                )
                for (const row of existingAttempts.rows) {
                  surviving.set(attemptKey(row.studentId, row.clientAttemptId), row.id)
                }
              }
            }
            for (const row of written) {
              row.attemptId = surviving.get(attemptKey(row.scan.userId, row.scan.clientAttemptId ?? null)) ?? null
            }
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
        const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined
        // 23503 FK violation, 23514 CHECK violation, 22P02 invalid text/enum
        // representation. Replaying the same rows cannot change any of them, so
        // the whole batch is quarantined on the first delivery. A row-count
        // mismatch is deliberately NOT in this list: it means a concurrent
        // writer moved the partition, which a retry can fix.
        if (typeof code === 'string' && (code === '23503' || code === '23514' || code === '22P02')) {
          throw new PermanentWriteError(
            `attendance batch rejected by Postgres (${code}): ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        throw error
      } finally {
        client.release()
      }
    },
  }
}
