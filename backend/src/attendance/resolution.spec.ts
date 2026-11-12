import { resolveSessionAttendance } from './resolution'

function makeTx(rows: Array<Record<string, unknown>>) {
  return {
    attendanceRecord: {
      findMany: jest.fn().mockResolvedValue(rows),
      updateMany: jest.fn().mockResolvedValue({ count: rows.length }),
    },
  } as any
}

const pending = (overrides: Record<string, unknown> = {}) => ({
  studentId: 'stu-1',
  checkInToken: null,
  checkOutToken: null,
  checkInStatus: null,
  ...overrides,
})

describe('resolveSessionAttendance', () => {
  it('keeps the legacy in-person behavior: pending rows become absent', async () => {
    const tx = makeTx([{ studentId: 'stu-1' }, { studentId: 'stu-2' }])

    const result = await resolveSessionAttendance(tx, { id: 'sess-1', mode: 'in_person' })

    expect(result.absentStudentIds).toEqual(['stu-1', 'stu-2'])
    expect(tx.attendanceRecord.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 'sess-1', status: 'pending' },
      // `timestamp` must NOT be rewritten: it is part of the ledger hash
      // preimage and the chain append is a no-op once recordHash exists.
      data: { status: 'absent', manuallySet: false },
    })
  })

  it('applies the full online matrix: present, late, incomplete (both legs), and absent', async () => {
    const tx = makeTx([
      pending({ studentId: 'present-student', checkInToken: 't1', checkOutToken: 't2', checkInStatus: 'present' }),
      pending({ studentId: 'late-student', checkInToken: 't1', checkOutToken: 't2', checkInStatus: 'late' }),
      pending({ studentId: 'left-early', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' }),
      pending({ studentId: 'late-only', checkInToken: null, checkOutToken: 't2', checkInStatus: null }),
      pending({ studentId: 'ghost', checkInToken: null, checkOutToken: null }),
    ])

    const result = await resolveSessionAttendance(tx, { id: 'sess-online', mode: 'online' })

    expect(result.absentStudentIds).toEqual(['ghost'])
    const updates = tx.attendanceRecord.updateMany.mock.calls.map((call: any[]) => call[0])
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['ghost'] }, checkInToken: null, checkOutToken: null }),
          data: expect.objectContaining({ status: 'absent' }),
        }),
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['present-student'] } }),
          data: expect.objectContaining({ status: 'present' }),
        }),
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['late-student'] } }),
          data: expect.objectContaining({ status: 'late' }),
        }),
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['left-early'] }, checkOutToken: null }),
          data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkout' }),
        }),
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['late-only'] }, checkInToken: null }),
          data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkin' }),
        }),
      ]),
    )
    for (const update of updates) {
      expect(update.where).toEqual(
        expect.objectContaining({ sessionId: 'sess-online', status: 'pending', manuallySet: false }),
      )
    }
  })

  it('never resolves disputed or manually-set rows', async () => {
    const tx = makeTx([])

    const result = await resolveSessionAttendance(tx, { id: 'sess-online', mode: 'online' })

    expect(result.absentStudentIds).toEqual([])
    expect(tx.attendanceRecord.updateMany).not.toHaveBeenCalled()
    expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith({
      where: { sessionId: 'sess-online', status: 'pending', manuallySet: false },
      select: { studentId: true, checkInToken: true, checkOutToken: true, checkInStatus: true },
    })
  })

  describe('never-armed end checkpoint (V1 fairness)', () => {
    it('resolves check-in-only rows by their check-in status instead of incomplete', async () => {
      const tx = makeTx([
        pending({ studentId: 'present-student', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' }),
        pending({ studentId: 'late-student', checkInToken: 't1', checkOutToken: null, checkInStatus: 'late' }),
        pending({ studentId: 'ghost', checkInToken: null, checkOutToken: null }),
      ])

      const result = await resolveSessionAttendance(tx, {
        id: 'sess-crash',
        mode: 'online',
        endArmed: false,
      })

      const updates = tx.attendanceRecord.updateMany.mock.calls.map((call: any[]) => call[0])
      expect(result.absentStudentIds).toEqual(['ghost'])
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['ghost'] }, checkInToken: null, checkOutToken: null }),
            data: expect.objectContaining({ status: 'absent' }),
          }),
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['present-student'] } }),
            data: expect.objectContaining({ status: 'present' }),
          }),
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['late-student'] } }),
            data: expect.objectContaining({ status: 'late' }),
          }),
        ]),
      )
      // Nobody receives a missed_checkout penalty: the checkpoint never existed.
      expect(updates.some((update: any) => update.data.notes === 'missed_checkout')).toBe(false)
    })

    it('does not constrain the completed where to a checkout token when unarmed', async () => {
      const tx = makeTx([
        pending({ studentId: 'present-student', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' }),
      ])

      await resolveSessionAttendance(tx, { id: 'sess-crash', mode: 'online', endArmed: false })

      const update = tx.attendanceRecord.updateMany.mock.calls[0][0]
      expect(Object.keys(update.where)).not.toContain('checkOutToken')
    })

    it('check-out-only rows stay incomplete in both modes of operation', async () => {
      const rows = [pending({ studentId: 'late-only', checkInToken: null, checkOutToken: 't2', checkInStatus: null })]

      const unarmed = makeTx(rows)
      await resolveSessionAttendance(unarmed, { id: 'sess-a', mode: 'online', endArmed: false })
      const armed = makeTx(rows)
      await resolveSessionAttendance(armed, { id: 'sess-b', mode: 'online', endArmed: true })

      for (const tx of [unarmed, armed]) {
        expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['late-only'] }, checkInToken: null }),
            data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkin' }),
          }),
        )
      }
    })

    it('armed sessions preserve the full matrix with mixed checkout coverage', async () => {
      const tx = makeTx([
        pending({ studentId: 'left-early', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' }),
        pending({ studentId: 'stayed', checkInToken: 't1', checkOutToken: 't2', checkInStatus: 'present' }),
      ])

      const result = await resolveSessionAttendance(tx, { id: 'sess-online', mode: 'online', endArmed: true })

      const updates = tx.attendanceRecord.updateMany.mock.calls.map((call: any[]) => call[0])
      expect(result.absentStudentIds).toEqual([])
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: expect.objectContaining({
              studentId: { in: ['stayed'] },
              checkInToken: { not: null },
              checkOutToken: { not: null },
            }),
            data: expect.objectContaining({ status: 'present' }),
          }),
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['left-early'] }, checkOutToken: null }),
            data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkout' }),
          }),
        ]),
      )
      // The armed path keeps the existing where-shape: checkout constraint present.
      const stayed = updates.find((update: any) => update.data.status === 'present')
      expect(stayed.where.checkOutToken).toEqual({ not: null })
    })

    it('defaults to the armed matrix when endArmed is omitted (backward-compat lock)', async () => {
      const tx = makeTx([
        pending({ studentId: 'left-early', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' }),
      ])

      await resolveSessionAttendance(tx, { id: 'sess-online', mode: 'online' })

      const updates = tx.attendanceRecord.updateMany.mock.calls.map((call: any[]) => call[0])
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: expect.objectContaining({ studentId: { in: ['left-early'] }, checkOutToken: null }),
            data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkout' }),
          }),
        ]),
      )
    })
  })
})
