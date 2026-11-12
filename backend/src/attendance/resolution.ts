import type { Prisma } from '../prisma/client'

/**
 * Final resolution for hybrid (online) sessions.
 *
 * Between checkpoints the roster rows stay `pending` and the cockpit renders
 * per-leg badges. When the session closes we collapse the two legs into the
 * single `status` column used by every existing report/badge surface:
 *
 *   check-in (present|late) + check-out        -> checkInStatus
 *   exactly one accepted leg                   -> incomplete
 *   neither leg                                -> absent
 *
 * `disputed` records and teacher manual overrides are never touched. In-person
 * sessions keep the original pending -> absent behavior.
 */

export interface ResolutionSession {
  id: string
  mode: 'in_person' | 'online'
  /**
   * Whether the teacher ever armed the end-of-class checkpoint. Callers must
   * derive this from the session row *before* their ledger claim nulls the
   * token columns (both closers null `endQrToken` right before invoking this
   * resolver). Defaults to true: a caller that forgets to pass it keeps today's
   * penalizing matrix.
   */
  endArmed?: boolean
}

export interface ResolutionResult {
  absentStudentIds: string[]
}

export async function resolveSessionAttendance(
  tx: Prisma.TransactionClient,
  session: ResolutionSession,
): Promise<ResolutionResult> {
  if (session.mode !== 'online') {
    const pending = await tx.attendanceRecord.findMany({
      where: { sessionId: session.id, status: 'pending' },
      select: { studentId: true },
    })
    if (pending.length > 0) {
      await tx.attendanceRecord.updateMany({
        where: { sessionId: session.id, status: 'pending' },
        // Never rewrite `timestamp`: it is part of the hash-chain preimage
        // (prevHash|studentId|timestampIso|sessionId|salt) and the chain append
        // is a no-op once `recordHash` exists, so touching it silently breaks
        // verification. The session's `endedAt` records when this ran.
        data: { status: 'absent', manuallySet: false },
      })
    }
    return { absentStudentIds: pending.map((record) => record.studentId) }
  }

  const pendingRows = await tx.attendanceRecord.findMany({
    where: { sessionId: session.id, status: 'pending', manuallySet: false },
    select: { studentId: true, checkInToken: true, checkOutToken: true, checkInStatus: true },
  })
  if (pendingRows.length === 0) return { absentStudentIds: [] }

  // A forgotten/end-of-battery session never opened Checkpoint 2: the student
  // cannot have missed a checkout that didn't exist, so start-only rows keep
  // their check-in credit.
  const endArmed = session.endArmed !== false
  const absentStudentIds = pendingRows
    .filter((row) => !row.checkInToken && !row.checkOutToken)
    .map((row) => row.studentId)
  const completedPresent = pendingRows
    .filter((row) => row.checkInToken && (endArmed ? row.checkOutToken : true) && row.checkInStatus === 'present')
    .map((row) => row.studentId)
  const completedLate = pendingRows
    .filter((row) => row.checkInToken && (endArmed ? row.checkOutToken : true) && row.checkInStatus === 'late')
    .map((row) => row.studentId)
  const missedCheckout = endArmed
    ? pendingRows.filter((row) => row.checkInToken && !row.checkOutToken).map((row) => row.studentId)
    : []
  const missedCheckin = pendingRows.filter((row) => !row.checkInToken && row.checkOutToken).map((row) => row.studentId)

  const baseWhere = { sessionId: session.id, status: 'pending' as const, manuallySet: false }
  const completedCheckInWhere = {
    ...baseWhere,
    checkInToken: { not: null as null | string },
    ...(endArmed ? { checkOutToken: { not: null as null | string } } : {}),
  }

  if (absentStudentIds.length > 0) {
    await tx.attendanceRecord.updateMany({
      where: {
        ...baseWhere,
        studentId: { in: absentStudentIds },
        checkInToken: null,
        checkOutToken: null,
      },
      // Same ledger invariant as the in-person branch: the timestamp is hashed.
      data: { status: 'absent' },
    })
  }
  if (completedPresent.length > 0) {
    await tx.attendanceRecord.updateMany({
      where: { ...completedCheckInWhere, studentId: { in: completedPresent } },
      data: { status: 'present' },
    })
  }
  if (completedLate.length > 0) {
    await tx.attendanceRecord.updateMany({
      where: { ...completedCheckInWhere, studentId: { in: completedLate } },
      data: { status: 'late' },
    })
  }
  if (missedCheckout.length > 0) {
    await tx.attendanceRecord.updateMany({
      where: { ...baseWhere, studentId: { in: missedCheckout }, checkOutToken: null },
      data: { status: 'incomplete', notes: 'missed_checkout' },
    })
  }
  if (missedCheckin.length > 0) {
    await tx.attendanceRecord.updateMany({
      where: { ...baseWhere, studentId: { in: missedCheckin }, checkInToken: null },
      data: { status: 'incomplete', notes: 'missed_checkin' },
    })
  }

  return { absentStudentIds }
}
