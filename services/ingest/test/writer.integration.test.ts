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
  createdAt_iso: string
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
              to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt_iso"
         FROM "AttendanceRecord" WHERE "sessionId" = $1 ORDER BY "createdAt" ASC, id ASC`,
      [ids.session],
    )
    return result.rows
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
  })

  afterAll(async () => {
    if (!databaseUrl) return
    await pool.query(`DELETE FROM "AttendanceRecord" WHERE "sessionId" = $1`, [ids.session])
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
})
