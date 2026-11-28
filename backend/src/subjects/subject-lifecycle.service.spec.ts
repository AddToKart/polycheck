import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { Prisma } from '../prisma/client'
import { SubjectLifecycleService } from './subject-lifecycle.service'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const DAY = 24 * 60 * 60 * 1000

function subject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subj-1',
    name: 'Programming 1',
    code: 'COMP 002',
    createdById: 'teacher-1',
    archivedAt: null as Date | null,
    evidencePurgedAt: null as Date | null,
    sections: [{ id: 'sec-1', teacherId: 'teacher-1' }],
    ...overrides,
  }
}

function setup(current = subject()) {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  })
  const prisma = {
    subject: {
      ...model(),
      findUnique: jest.fn().mockResolvedValue(current),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    section: model(),
    session: model(),
    attendanceRecord: model(),
    proofOfClass: model(),
    scanAttempt: model(),
    enrollment: model(),
    sectionRole: model(),
    sessionPermission: model(),
    auditLog: model(),
    $transaction: jest.fn(),
  }
  prisma.$transaction.mockImplementation(async (work: unknown) =>
    typeof work === 'function' ? (work as (tx: typeof prisma) => unknown)(prisma) : Promise.all(work as unknown[]),
  )
  const redis = {
    acquireLock: jest.fn().mockResolvedValue('token'),
    releaseLock: jest.fn().mockResolvedValue(true),
  }
  const storage = { remove: jest.fn().mockResolvedValue(undefined) }
  const service = new SubjectLifecycleService(prisma as never, redis as never, storage as never)
  return { service, prisma, redis, storage }
}

const audited = (prisma: ReturnType<typeof setup>['prisma']) =>
  prisma.auditLog.create.mock.calls.map((call) => call[0].data.action)

describe('SubjectLifecycleService', () => {
  describe('archive', () => {
    it('archives only when no class is running, and says when the evidence goes', async () => {
      const { service, prisma } = setup()
      const archivedAt = new Date('2026-11-28T00:00:00Z')
      prisma.subject.findUnique.mockResolvedValueOnce(subject()).mockResolvedValue(subject({ archivedAt }))

      const result = await service.archive('subj-1', teacher)

      expect(prisma.subject.updateMany.mock.calls[0][0].where).toEqual({
        id: 'subj-1',
        archivedAt: null,
        sections: { none: { sessions: { some: { isActive: true } } } },
      })
      expect(result.evidencePurgeAt).toBe(new Date(archivedAt.getTime() + 90 * DAY).toISOString())
      expect(audited(prisma)).toEqual(['subject.archived'])
    })

    it('refuses while a class is running', async () => {
      const { service, prisma } = setup()
      prisma.subject.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.archive('subj-1', teacher)).rejects.toThrow(/still running/)
    })

    it('refuses a teacher who did not create the subject', async () => {
      const { service } = setup(subject({ createdById: 'someone-else' }))
      await expect(service.archive('subj-1', teacher)).rejects.toThrow(ForbiddenException)
    })

    it("refuses while another teacher's class is under the subject", async () => {
      const { service } = setup(
        subject({
          sections: [
            { id: 'sec-1', teacherId: 'teacher-1' },
            { id: 'sec-2', teacherId: 'teacher-2' },
          ],
        }),
      )
      await expect(service.archive('subj-1', teacher)).rejects.toThrow(/Other teachers/)
    })

    it('refuses an administrator', async () => {
      const { service } = setup()
      await expect(
        service.archive('subj-1', { id: 'teacher-1', role: 'super_admin', scope: 'institution' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('waits its turn when another change to the subject holds the lock', async () => {
      const { service, redis, prisma } = setup()
      redis.acquireLock.mockResolvedValue(null)
      await expect(service.archive('subj-1', teacher)).rejects.toThrow(ConflictException)
      expect(prisma.subject.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('brings the subject back and cancels the countdown', async () => {
      const { service, prisma } = setup(subject({ archivedAt: new Date() }))
      await service.restore('subj-1', teacher)
      expect(prisma.subject.update).toHaveBeenCalledWith({
        where: { id: 'subj-1' },
        data: { archivedAt: null, archivedById: null, evidencePurgedAt: null },
      })
    })

    it('explains when another active subject has taken the code', async () => {
      const { service, prisma } = setup(subject({ archivedAt: new Date() }))
      prisma.subject.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
      )
      await expect(service.restore('subj-1', teacher)).rejects.toThrow(/COMP 002/)
    })
  })

  describe('deletePermanently', () => {
    const archived = () => subject({ archivedAt: new Date() })

    it('refuses a subject that is not archived', async () => {
      const { service, prisma } = setup()
      await expect(service.deletePermanently('subj-1', teacher, 'COMP 002')).rejects.toThrow(
        /Archive the subject first/,
      )
      expect(prisma.subject.delete).not.toHaveBeenCalled()
    })

    it('refuses without the typed subject code', async () => {
      const { service, prisma } = setup(archived())
      await expect(service.deletePermanently('subj-1', teacher, 'COMP 00')).rejects.toThrow(BadRequestException)
      expect(prisma.subject.delete).not.toHaveBeenCalled()
    })

    it('deletes everything, notes the removed ledger rows and removes the files afterwards', async () => {
      const { service, prisma, storage } = setup(archived())
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { timestamp: new Date('2026-07-14T02:00:00Z'), recordHash: 'hash-1', excuseEvidencePath: '/uploads/e.jpg' },
        { timestamp: new Date('2026-07-14T03:00:00Z'), recordHash: 'hash-2', excuseEvidencePath: null },
        { timestamp: new Date('2026-07-15T03:00:00Z'), recordHash: null, excuseEvidencePath: null },
      ])
      prisma.proofOfClass.findMany.mockResolvedValue([{ photoUrl: '/uploads/p.jpg' }])
      prisma.auditLog.findMany.mockResolvedValue([{ metadata: { lastRecordHash: 'hash-2' } }])

      await service.deletePermanently('subj-1', teacher, ' comp 002 ')

      expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: 'subj-1' } })
      expect(audited(prisma)).toEqual(['ledger.records_removed', 'subject.force_deleted'])
      expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.dates).toEqual({
        '2026-07-14': { count: 2, anchoredHashes: ['hash-2'] },
      })
      expect(storage.remove.mock.calls.map((call) => call[0])).toEqual(['/uploads/p.jpg', '/uploads/e.jpg'])
    })

    it('deletes nothing when the subject was restored a moment earlier', async () => {
      const { service, prisma, storage } = setup(archived())
      prisma.subject.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.deletePermanently('subj-1', teacher, 'COMP 002')).rejects.toThrow(/restored/)
      expect(prisma.attendanceRecord.deleteMany).not.toHaveBeenCalled()
      expect(storage.remove).not.toHaveBeenCalled()
    })
  })

  describe('the 90-day evidence erasure', () => {
    const now = new Date('2027-03-01T00:00:00Z')
    const old = () => subject({ archivedAt: new Date(now.getTime() - 91 * DAY) })

    it('asks only for subjects archived at least 90 days ago and not yet erased', async () => {
      const { service, prisma } = setup()
      await service.purgeDueEvidence(now)
      expect(prisma.subject.findMany.mock.calls[0][0].where).toEqual({
        archivedAt: { lte: new Date(now.getTime() - 90 * DAY) },
        evidencePurgedAt: null,
      })
    })

    it('erases photos, locations and scan logs but never deletes an attendance record', async () => {
      const { service, prisma, storage } = setup(old())
      prisma.subject.findMany.mockResolvedValue([{ id: 'subj-1' }])
      prisma.proofOfClass.findMany
        .mockResolvedValueOnce([{ id: 'p1', photoUrl: '/uploads/p.jpg' }])
        .mockResolvedValue([])
      prisma.attendanceRecord.findMany.mockResolvedValue([{ id: 'r1', excuseEvidencePath: '/uploads/e.jpg' }])

      await expect(service.purgeDueEvidence(now)).resolves.toBe(1)

      expect(storage.remove.mock.calls.map((call) => call[0])).toEqual(['/uploads/p.jpg', '/uploads/e.jpg'])
      expect(prisma.proofOfClass.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { excuseEvidencePath: null },
      })
      const changes = prisma.attendanceRecord.updateMany.mock.calls.map((call) => call[0].data)
      expect(changes).toContainEqual({ latitude: null, longitude: null })
      // Nothing that decides attendance, or feeds the hash chain, is rewritten.
      for (const data of changes) {
        expect(Object.keys(data)).not.toEqual(expect.arrayContaining(['status']))
        expect(data).not.toHaveProperty('timestamp')
      }
      expect(prisma.scanAttempt.deleteMany).toHaveBeenCalled()
      expect(prisma.attendanceRecord.deleteMany).not.toHaveBeenCalled()
      expect(prisma.session.deleteMany).not.toHaveBeenCalled()
      expect(prisma.subject.update).toHaveBeenCalledWith({
        where: { id: 'subj-1' },
        data: { evidencePurgedAt: expect.any(Date) },
      })
    })

    it('keeps the row and tries again later when a file cannot be removed', async () => {
      const { service, prisma, storage } = setup(old())
      prisma.subject.findMany.mockResolvedValue([{ id: 'subj-1' }])
      prisma.proofOfClass.findMany.mockResolvedValueOnce([{ id: 'p1', photoUrl: 's3://b/p.jpg' }]).mockResolvedValue([])
      storage.remove.mockRejectedValue(new Error('storage offline'))

      await expect(service.purgeDueEvidence(now)).resolves.toBe(0)

      expect(prisma.proofOfClass.delete).not.toHaveBeenCalled()
      expect(prisma.subject.update).not.toHaveBeenCalled()
    })

    it('does nothing to a subject restored before its turn', async () => {
      const { service, prisma, storage } = setup(subject({ archivedAt: null }))
      prisma.subject.findMany.mockResolvedValue([{ id: 'subj-1' }])
      await expect(service.purgeDueEvidence(now)).resolves.toBe(0)
      expect(storage.remove).not.toHaveBeenCalled()
      expect(prisma.scanAttempt.deleteMany).not.toHaveBeenCalled()
    })
  })
})
