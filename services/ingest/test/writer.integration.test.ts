/**
 * Postgres-backed integration tests for the batched drainer writer.
 *
 * These exercise the paths that matter for the hash chain and cannot be proven
 * with fakes: insert chaining, claiming activation-seeded rows, duplicate
 * suppression, deterministic head selection between batches, fail-closed
 * signature handling, and the "earlier decision wins" guard.
 *
 * Opt-in by environment: the suite runs only when DATABASE_URL is set (CI's
 * verify job provides one with migrations applied; local runs can point at the
 * compose database). Every fixture row carries random ids and is removed in
 * afterAll, so a shared dev database is left untouched.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { computeRecordHash } from '@polycheck/shared/ledger'
import { createPgWriter } from '../src/writer'
import type { AttendanceWriter, BufferedScan } from '../src/queue'
import { PermanentWriteError } from '../src/queue'

const databaseUrl = process.env.DATABASE_URL
const describeDb = databaseUrl ? describe : describe.skip

interface StoredRow {
  id: string
  studentId: string
  status: string
  timestamp_iso: string
  prevHash: string | null
  recordHash: string
  salt: string
  disputeReason: string | null
  disputePreviousStatus: string | null
  acceptedScanAttemptId: string | null
  checkInAttemptId: string | null
  checkOutAttemptId: string | null
  createdAt_iso: string
}

interface StoredAttempt {
  id: string
  studentId: string
  clientAttemptId: string | null
  outcome: string
  reason: string | null
  latitude: number | null
  longitude: number | null
  offline: boolean
  checkpoint: string | null
  tokenHash: string | null
}

describeDb('createPgWriter (Postgres integration)', () => {
  const teacherKeys = createSigningKeyPair(new Uint8Array(32).fill(31))
  const foreignKeys = createSigningKeyPair(new Uint8Array(32).fill(47))
  const ids = {
    teacher: randomUUID(),
    students: Array.from({ length: 6 }, () => randomUUID()),
    subject: randomUUID(),
    section: randomUUID(),
    session: randomUUID(),
  }

  let pool: Pool
  let writer: AttendanceWriter

  const token = (secretKey = teacherKeys.secretKey) =>
    signQRToken(
      {
        version: 1,
        sessionId: ids.session,
        sectionId: ids.section,
        teacherId: ids.teacher,
        teacherName: 'Integration Teacher',
        issuedAt: Date.now(),
        validityMinutes: 15,
        gracePeriodMinutes: 15,
        mode: 'in_person',
        pinRequired: false,
      },
      secretKey,
    )

  const scan = (studentIndex: number, overrides: Partial<BufferedScan> = {}): BufferedScan => ({
    userId: ids.students[studentIndex]!,
    sessionId: ids.session,
    sectionId: ids.section,
    status: 'present',
    scannedAt: new Date(Date.now() - 120_000 + studentIndex * 1_000).toISOString(),
    receivedAt: new Date().toISOString(),
    riskSignals: [],
    offline: false,
    qrToken: token(),
    latitude: 12.5,
    longitude: 121.5,
    accuracyMeters: 8,
    locationCapturedAt: new Date(Date.now() - 121_000 + studentIndex * 1_000).toISOString(),
    deviceId: `writer-device-${studentIndex}`,
    clientAttemptId: randomUUID(),
    inputChannel: 'camera',
    mocked: false,
    ...overrides,
  })

  async function seedRosterRow(studentIndex: number, status = 'pending') {
    await pool.query(
      `INSERT INTO "AttendanceRecord"
        (id, "sessionId", "sectionId", "studentId", "studentName", timestamp, status, "isSynced", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'Seeded Student', $5::timestamptz AT TIME ZONE 'UTC', $6::"AttendanceStatus", false, $7::timestamptz, $7::timestamptz)`,
      [randomUUID(), ids.session, ids.section, ids.students[studentIndex], new Date().toISOString(), status, new Date(Date.now() - 3_600_000).toISOString()],
    )
  }

  async function rowsForSession(): Promise<StoredRow[]> {
    const result = await pool.query<StoredRow>(
      `SELECT id, "studentId", status::text AS status,
              to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS timestamp_iso,
              "prevHash", "recordHash", salt, "disputeReason",
              "disputePreviousStatus"::text AS "disputePreviousStatus",
              "acceptedScanAttemptId", "checkInAttemptId", "checkOutAttemptId",
              to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt_iso"
         FROM "AttendanceRecord" WHERE "sessionId" = $1 ORDER BY "createdAt" ASC, id ASC`,
      [ids.session],
    )
    return result.rows
  }

  async function attemptsForSession(): Promise<StoredAttempt[]> {
    const result = await pool.query<StoredAttempt>(
      `SELECT id, "studentId", "clientAttemptId", outcome, reason,
              latitude, longitude, coalesce(offline, false) AS offline,
              checkpoint, "tokenHash"
         FROM "ScanAttempt" WHERE "sessionId" = $1 ORDER BY "createdAt" ASC, id ASC`,
      [ids.session],
    )
    return result.rows
  }

  async function enroll(studentIndex: number) {
    await pool.query(
      `INSERT INTO "Enrollment" (id, "studentId", "sectionId", "enrolledAt")
       VALUES ($1, $2, $3, now()) ON CONFLICT ("studentId", "sectionId") DO NOTHING`,
      [randomUUID(), ids.students[studentIndex], ids.section],
    )
  }

  beforeAll(async () => {
    if (!databaseUrl) return
    pool = new Pool({ connectionString: databaseUrl, max: 2, options: '-c TimeZone=UTC' })
    writer = createPgWriter(pool)

    await pool.query(
      // Constraint User_role_fields_valid: teachers need an email; students need
      // studentId/program/yearLevel/department.
      `INSERT INTO "User" (id, "fullName", password, "authEmail", email, role, "teacherPublicKey", "updatedAt")
       VALUES ($1, 'Integration Teacher', 'x', $2, $3, 'teacher', $4, now())`,
      [
        ids.teacher,
        `writer-teacher-${ids.teacher}@example.test`,
        `writer-teacher-${ids.teacher}@example.test`,
        teacherKeys.publicKey,
      ],
    )
    for (const studentId of ids.students) {
      await pool.query(
        `INSERT INTO "User" (id, "fullName", password, "authEmail", role, "studentId", program, "yearLevel", department, "updatedAt")
         VALUES ($1, 'Integration Student', 'x', $2, 'student', $3, 'BSIT', 1, 'CCIS', now())`,
        [studentId, `writer-student-${studentId}@example.test`, `WRI-${studentId.slice(0, 8)}`],
      )
    }
    await pool.query(`INSERT INTO "Subject" (id, name, code, "updatedAt") VALUES ($1, 'Writer Integration', $2, now())`, [
      ids.subject,
      `WRI-${ids.subject.slice(0, 8)}`,
    ])
    await pool.query(
      `INSERT INTO "Section" (id, "subjectId", section, room, semester, "teacherId", "updatedAt")
       VALUES ($1, $2, 'WRI-1', 'R-1', '2026-1', $3, now())`,
      [ids.section, ids.subject, ids.teacher],
    )
    await pool.query(
      `INSERT INTO "Session"
        (id, "sectionId", "teacherId", "subjectName", date, "startTime", "endTime", "qrValidityMinutes", "gracePeriodMinutes", "isActive")
       VALUES ($1, $2, $3, 'Writer Integration', '2026-11-14', '09:00', '10:00', 15, 15, true)`,
      [ids.session, ids.section, ids.teacher],
    )
  })

  beforeEach(async () => {
    if (!databaseUrl) return
    await pool.query(`DELETE FROM "AttendanceRecord" WHERE "sessionId" = $1`, [ids.session])
    await pool.query(`DELETE FROM "ScanAttempt" WHERE "sessionId" = $1`, [ids.session])
    await pool.query(`DELETE FROM "EnrollmentTombstone" WHERE "sectionId" = $1`, [ids.section])
    await pool.query(`DELETE FROM "Enrollment" WHERE "sectionId" = $1`, [ids.section])
    // The cooldown is a User column, not part of the section scope: without this
    // reset the cooldown case would leak into every later test in the file.
    await pool.query(
      `UPDATE "User" SET "deviceCooldownUntil" = NULL, "cooldownDeviceId" = NULL, "boundDeviceId" = NULL
        WHERE id = ANY($1::text[])`,
      [ids.students],
    )
    // Members of record for the happy paths; individual cases remove one.
    for (let index = 0; index < ids.students.length; index += 1) await enroll(index)
  })

  afterAll(async () => {
    if (!databaseUrl) return
    await pool.query(`DELETE FROM "AttendanceRecord" WHERE "sessionId" = $1`, [ids.session])
    await pool.query(`DELETE FROM "ScanAttempt" WHERE "sessionId" = $1`, [ids.session])
    await pool.query(`DELETE FROM "EnrollmentTombstone" WHERE "sectionId" = $1`, [ids.section])
    await pool.query(`DELETE FROM "Enrollment" WHERE "sectionId" = $1`, [ids.section])
    await pool.query(`DELETE FROM "Session" WHERE id = $1`, [ids.session])
    await pool.query(`DELETE FROM "Section" WHERE id = $1`, [ids.section])
    await pool.query(`DELETE FROM "Subject" WHERE id = $1`, [ids.subject])
    await pool.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [[ids.teacher, ...ids.students]])
    await pool.end()
  })

  it('inserts a batch in arrival order and links each row to its predecessor', async () => {
    const result = await writer.writeBatch(ids.session, [scan(0), scan(1)])
    expect(result).toEqual({ written: 2, duplicates: 0 })

    const rows = await rowsForSession()
    expect(rows).toHaveLength(2)
    expect(rows[0]!.prevHash).toBeNull()
    expect(rows[1]!.prevHash).toBe(rows[0]!.recordHash)
    expect(rows.every((row) => row.status === 'present')).toBe(true)

    for (const row of rows) {
      expect(row.recordHash).toBe(
        computeRecordHash({
          prevHash: row.prevHash,
          studentId: row.studentId,
          timestampIso: row.timestamp_iso,
          sessionId: ids.session,
          salt: row.salt,
        }),
      )
    }
  })

  it('claims an activation-seeded pending row and chains it in place', async () => {
    await seedRosterRow(2)
    const result = await writer.writeBatch(ids.session, [scan(2)])
    expect(result).toEqual({ written: 1, duplicates: 0 })

    const [row] = await rowsForSession()
    expect(row!.status).toBe('present')
    expect(row!.recordHash).toBeTruthy()
    expect(row!.disputePreviousStatus).toBeNull()
    // The claim rewrites createdAt to write time so the head stays unambiguous.
    // Compared as a text-form UTC instant: node-postgres parses timestamp-without-
    // time-zone columns in the process timezone, which would shift this by hours.
    expect(new Date(row!.createdAt_iso).getTime()).toBeGreaterThan(Date.now() - 10_000)
    expect(row!.recordHash).toBe(
      computeRecordHash({
        prevHash: row!.prevHash,
        studentId: row!.studentId,
        timestampIso: row!.timestamp_iso,
        sessionId: ids.session,
        salt: row!.salt,
      }),
    )
  })

  it('treats a second scan for the same student as a duplicate without rewriting the row', async () => {
    await writer.writeBatch(ids.session, [scan(3, { status: 'late' })])
    const [before] = await rowsForSession()

    const result = await writer.writeBatch(ids.session, [scan(3, { status: 'present' })])

    expect(result).toEqual({ written: 0, duplicates: 1 })
    const [after] = await rowsForSession()
    expect(after).toEqual(before)
    expect(after!.status).toBe('late')
  })

  it('selects the last written row as the head for the next batch', async () => {
    await writer.writeBatch(ids.session, [scan(0), scan(1)])
    await writer.writeBatch(ids.session, [scan(4)])

    const rows = await rowsForSession()
    expect(rows).toHaveLength(3)
    expect(rows[2]!.prevHash).toBe(rows[1]!.recordHash)
    // A timestamp-ordered head would have picked rows[0] here: scan(4) carries
    // an older scannedAt than the first batch's rows in some runs.
    expect(rows[2]!.prevHash).not.toBe(rows[0]!.recordHash)
  })

  it('stores a failing signature as disputed, keeping the seed as the pre-dispute state', async () => {
    await seedRosterRow(5)
    const result = await writer.writeBatch(ids.session, [scan(5, { qrToken: token(foreignKeys.secretKey) })])

    expect(result).toEqual({ written: 1, duplicates: 0 })
    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('invalid_signature')
    expect(row!.disputePreviousStatus).toBe('pending')
    expect(row!.recordHash).toBe(
      computeRecordHash({
        prevHash: row!.prevHash,
        studentId: row!.studentId,
        timestampIso: row!.timestamp_iso,
        sessionId: ids.session,
        salt: row!.salt,
      }),
    )
  })

  it("checks a president-started session against its own key, not the professor's", async () => {
    const setHost = (publicKey: string | null, startedAt: Date | null) =>
      pool.query(`UPDATE "Session" SET "hostPublicKey" = $2, "hostStartedAt" = $3 WHERE id = $1`, [
        ids.session,
        publicKey,
        startedAt,
      ])
    try {
      // Created by a president but not started by them: still the professor's key.
      await setHost(foreignKeys.publicKey, null)
      await writer.writeBatch(ids.session, [scan(0), scan(1, { qrToken: token(foreignKeys.secretKey) })])
      // Started by the president: only the session's key is accepted.
      await setHost(foreignKeys.publicKey, new Date())
      await writer.writeBatch(ids.session, [scan(2, { qrToken: token(foreignKeys.secretKey) }), scan(3)])

      const byStudent = new Map((await rowsForSession()).map((row) => [row.studentId, row.disputeReason]))
      expect(ids.students.slice(0, 4).map((id) => byStudent.get(id))).toEqual([
        null,
        'invalid_signature',
        null,
        'invalid_signature',
      ])
    } finally {
      await setHost(null, null)
    }
  })

  it('lets an earlier decision win when the roster row was already resolved', async () => {
    await seedRosterRow(0, 'absent')
    const result = await writer.writeBatch(ids.session, [scan(0)])

    expect(result).toEqual({ written: 0, duplicates: 1 })
    const [row] = await rowsForSession()
    expect(row!.status).toBe('absent')
    expect(row!.recordHash).toBeNull()
  })

  it('rejects with a permanent error when the session disappeared after accept', async () => {
    // A session deleted between accept and commit can never succeed on replay;
    // the drainer quarantines PermanentWriteError instead of retrying forever.
    // Distinct date so the fixture session's unique (section, date, start, end)
    // slot stays free for the rest of the suite.
    const vanished = randomUUID()
    await pool.query(
      `INSERT INTO "Session"
        (id, "sectionId", "teacherId", "subjectName", date, "startTime", "endTime", "qrValidityMinutes", "gracePeriodMinutes", "isActive")
       VALUES ($1, $2, $3, 'Vanished Session', '2026-11-15', '09:00', '10:00', 15, 15, true)`,
      [vanished, ids.section, ids.teacher],
    )
    await pool.query(`DELETE FROM "Session" WHERE id = $1`, [vanished])

    await expect(writer.writeBatch(vanished, [scan(0, { sessionId: vanished })])).rejects.toBeInstanceOf(PermanentWriteError)
  })

  // ── ING-02: commit-time membership re-checks ──

  it('commits a scan from a removed student as disputed and still chains it (ING-02)', async () => {
    await pool.query(`DELETE FROM "Enrollment" WHERE "sectionId" = $1 AND "studentId" = $2`, [
      ids.section,
      ids.students[1],
    ])

    const result = await writer.writeBatch(ids.session, [scan(0), scan(1)])

    // Not dropped: the row is committed so the teacher rail sees it.
    expect(result).toEqual({ written: 2, duplicates: 0 })
    const rows = await rowsForSession()
    const removed = rows.find((row) => row.studentId === ids.students[1])!
    expect(removed.status).toBe('disputed')
    expect(removed.disputeReason).toBe('student_not_enrolled')
    // Arrival-order chaining is unaffected by the decision.
    expect(removed.prevHash).toBe(rows[0]!.recordHash)
    expect(removed.recordHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('disputes a tombstoned student with student_blocked_from_section (ING-02)', async () => {
    await pool.query(
      `INSERT INTO "EnrollmentTombstone" (id, "sectionId", "studentId", "removedById", "removedAt")
       VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), ids.section, ids.students[2], ids.teacher],
    )

    await writer.writeBatch(ids.session, [scan(2)])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('student_blocked_from_section')
  })

  it('disputes a scan inside an active device cooldown (ING-02)', async () => {
    await pool.query(`UPDATE "User" SET "deviceCooldownUntil" = now() + interval '1 hour' WHERE id = $1`, [
      ids.students[3],
    ])

    await writer.writeBatch(ids.session, [scan(3)])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('device_cooldown_active')
  })

  it('prefers the explicit teacher block over a plain missing enrollment (ING-02)', async () => {
    // A tombstoned student also has no enrollment row. The reason must be the
    // teacher-actionable one, not the generic "not enrolled".
    await pool.query(`DELETE FROM "Enrollment" WHERE "sectionId" = $1 AND "studentId" = $2`, [
      ids.section,
      ids.students[3],
    ])
    await pool.query(
      `INSERT INTO "EnrollmentTombstone" (id, "sectionId", "studentId", "removedById", "removedAt")
       VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), ids.section, ids.students[3], ids.teacher],
    )

    await writer.writeBatch(ids.session, [scan(3)])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('student_blocked_from_section')
  })

  it('keeps the enrolled happy path unchanged (ING-02)', async () => {
    await writer.writeBatch(ids.session, [scan(4)])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('present')
    expect(row!.disputeReason).toBeNull()
    expect(row!.disputePreviousStatus).toBeNull()
  })

  it('does not dispute a bound device inside a cooldown (DeviceBindingService parity, ING-02)', async () => {
    // `assertScanAllowed` only gates students WITHOUT a bound device: a bound
    // device was already vouched for at login. The writer must agree or a
    // legitimate check-in would be flagged after every device change.
    await pool.query(
      `UPDATE "User" SET "deviceCooldownUntil" = now() + interval '1 hour', "boundDeviceId" = 'bound-device'
        WHERE id = $1`,
      [ids.students[5]],
    )

    await writer.writeBatch(ids.session, [scan(5)])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('present')
    expect(row!.disputeReason).toBeNull()
  })

  it('lets an invalid signature take precedence over membership disputes (ING-02)', async () => {
    await pool.query(`DELETE FROM "Enrollment" WHERE "sectionId" = $1 AND "studentId" = $2`, [
      ids.section,
      ids.students[4],
    ])

    await writer.writeBatch(ids.session, [scan(4, { qrToken: token(foreignKeys.secretKey) })])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('invalid_signature')
  })

  // ── ING-03: disputePreviousStatus semantics ──

  it('stamps NULL on an inserted disputed row so Reject restores absent (ING-03)', async () => {
    // Re-pinned (ING-03): this used to stamp `scan.status` ('present'), so a
    // teacher Reject on a forged row flipped it to Present.
    await writer.writeBatch(ids.session, [scan(5, { qrToken: token(foreignKeys.secretKey) })])

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('invalid_signature')
    expect(row!.disputePreviousStatus).toBeNull()

    // Reject path: `disputes.service.resolve` restores `?? 'absent'`.
    const restored = row!.disputePreviousStatus ?? 'absent'
    expect(restored).toBe('absent')
  })

  it('stamps NULL on a gateway-flagged insert so Reject restores absent (ING-03)', async () => {
    // A legitimate-but-flagged scan (gateway assigned `disputed`): the old code
    // copied 'disputed' into the column and Reject then 403'd the teacher.
    await writer.writeBatch(
      ids.session,
      [scan(0, { status: 'disputed', reason: 'missing_scan_evidence', message: 'Legacy evidence incomplete' })],
    )

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputeReason).toBe('missing_scan_evidence')
    expect(row!.disputePreviousStatus).toBeNull()
  })

  it('keeps pending as the claim restore target so Reject returns the row to pending (ING-03)', async () => {
    await seedRosterRow(1)
    await writer.writeBatch(
      ids.session,
      [scan(1, { status: 'disputed', reason: 'missing_scan_evidence', message: 'Legacy evidence incomplete' })],
    )

    const [row] = await rowsForSession()
    expect(row!.status).toBe('disputed')
    expect(row!.disputePreviousStatus).toBe('pending')
  })

  // ── ING-09: ScanAttempt persistence ──

  it('writes one ScanAttempt per committed scan and links accepted rows (ING-09)', async () => {
    await writer.writeBatch(ids.session, [scan(0), scan(1)])

    const rows = await rowsForSession()
    const attempts = await attemptsForSession()
    expect(attempts).toHaveLength(2)
    expect(attempts.every((attempt) => attempt.outcome === 'present')).toBe(true)
    expect(attempts.every((attempt) => attempt.tokenHash?.length === 64)).toBe(true)
    // Coordinates are retained for in-person sessions.
    expect(attempts[0]!.latitude).toBe(12.5)
    for (const row of rows) {
      expect(row.acceptedScanAttemptId).toBe(attempts.find((a) => a.studentId === row.studentId)!.id)
      expect(row.checkInAttemptId).toBeNull()
      expect(row.checkOutAttemptId).toBeNull()
    }
  })

  it('persists a denied-by-signature scan as a flagged attempt (ING-09)', async () => {
    await writer.writeBatch(ids.session, [scan(2, { qrToken: token(foreignKeys.secretKey) })])

    const attempts = await attemptsForSession()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.outcome).toBe('flagged')
    expect(attempts[0]!.reason).toBe('invalid_signature')
  })

  it('never persists coordinates for an online checkpoint attempt (ING-09, RA 10173)', async () => {
    await writer.writeBatch(ids.session, [scan(3, { mode: 'online', checkpoint: 'start' })])

    const attempts = await attemptsForSession()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.latitude).toBeNull()
    expect(attempts[0]!.longitude).toBeNull()
    expect(attempts[0]!.checkpoint).toBe('start')
    // The record links the attempt through the per-leg FK, not the in-person one.
    const [row] = await rowsForSession()
    expect(row!.checkInAttemptId).toBe(attempts[0]!.id)
    expect(row!.acceptedScanAttemptId).toBeNull()
  })

  it('skips attempt writes entirely when the kill switch is off (ING-09)', async () => {
    const quiet = createPgWriter(pool, { persistScanAttempts: false })
    await quiet.writeBatch(ids.session, [scan(0)])

    expect(await attemptsForSession()).toHaveLength(0)
    const [row] = await rowsForSession()
    expect(row!.acceptedScanAttemptId).toBeNull()
    expect(row!.status).toBe('present')
  })
})
