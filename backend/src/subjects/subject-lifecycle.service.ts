import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { archiveEvidencePurgeAt, ARCHIVE_EVIDENCE_RETENTION_DAYS, type SubjectLifecycle } from '@polycheck/shared'
import { ledgerDateOf } from '@polycheck/shared/ledger'
import type { RequestUser } from '../auth/authenticated-principal'
import { LEDGER_RECORDS_REMOVED_ACTION } from '../common/constants/ledger'
import { adminSubjectWhere } from '../common/admin-scope'
import { RedisService } from '../infrastructure/redis.service'
import { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ProofStorageService } from '../proofs/proof-storage.service'

const LOCK_TTL_SECONDS = 10 * 60
const PURGE_BATCH_SIZE = 500
const DELETE_TRANSACTION_TIMEOUT_MS = 120_000
const MS_PER_DAY = 24 * 60 * 60 * 1000

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  createdById: true,
  archivedAt: true,
  evidencePurgedAt: true,
  sections: { select: { id: true, teacherId: true } },
} satisfies Prisma.SubjectSelect

type LifecycleSubject = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>

export interface EvidencePurgeSummary {
  classPhotos: number
  excusePhotos: number
  locations: number
  scanAttempts: number
  /** Files that could not be removed. The purge is retried until this reaches zero. */
  failedFiles: number
}

@Injectable()
export class SubjectLifecycleService {
  private readonly logger = new Logger(SubjectLifecycleService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: ProofStorageService,
  ) {}

  async lifecycle(subjectId: string, user: RequestUser): Promise<SubjectLifecycle> {
    const subject = await this.readableSubject(subjectId, user)
    return this.describe(subject)
  }

  async archive(subjectId: string, user: RequestUser): Promise<SubjectLifecycle> {
    return this.withLock(subjectId, async () => {
      const subject = await this.managedSubject(subjectId, user)
      if (subject.archivedAt) throw new ConflictException('This subject is already archived')
      // One statement, so a class cannot start between the check and the archive.
      const archived = await this.prisma.subject.updateMany({
        where: { id: subjectId, archivedAt: null, sections: { none: { sessions: { some: { isActive: true } } } } },
        data: { archivedAt: new Date(), archivedById: user.id, evidencePurgedAt: null },
      })
      if (archived.count !== 1) {
        throw new ConflictException({
          message: 'A class under this subject is still running. End it before archiving.',
          code: 'subject_has_live_session',
        })
      }
      await this.audit(user.id, user.role, 'subject.archived', subjectId, {
        code: subject.code,
        evidenceRetentionDays: ARCHIVE_EVIDENCE_RETENTION_DAYS,
      })
      return this.describe(await this.requireSubject(subjectId))
    })
  }

  async restore(subjectId: string, user: RequestUser): Promise<SubjectLifecycle> {
    return this.withLock(subjectId, async () => {
      const subject = await this.managedSubject(subjectId, user)
      if (!subject.archivedAt) throw new ConflictException('This subject is not archived')
      try {
        await this.prisma.subject.update({
          where: { id: subjectId },
          data: { archivedAt: null, archivedById: null, evidencePurgedAt: null },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(
            `Another active subject now uses the code ${subject.code}. Change that code before restoring this one.`,
          )
        }
        throw error
      }
      await this.audit(user.id, user.role, 'subject.restored', subjectId, {
        code: subject.code,
        evidenceAlreadyErased: Boolean(subject.evidencePurgedAt),
      })
      return this.describe(await this.requireSubject(subjectId))
    })
  }

  /** Deletes an archived subject and everything recorded under it. There is no way back. */
  async deletePermanently(subjectId: string, user: RequestUser, confirmCode: string): Promise<void> {
    await this.withLock(subjectId, async () => {
      const subject = await this.managedSubject(subjectId, user)
      if (!subject.archivedAt) {
        throw new ConflictException('Archive the subject first. Only an archived subject can be deleted for good.')
      }
      if (confirmCode.trim().toLowerCase() !== subject.code.trim().toLowerCase()) {
        throw new BadRequestException({
          message: `Type the subject code ${subject.code} to confirm`,
          code: 'subject_code_mismatch',
        })
      }
      const sectionIds = subject.sections.map((section) => section.id)
      const sessionIds = await this.sessionIds(sectionIds)
      const inSubject = { OR: [{ sectionId: { in: sectionIds } }, { sessionId: { in: sessionIds } }] }

      const files = await this.prisma.$transaction(
        async (tx) => {
          // Takes the row lock and re-checks that nobody restored the subject meanwhile.
          const claimed = await tx.subject.updateMany({
            where: { id: subjectId, archivedAt: { not: null } },
            data: { updatedAt: new Date() },
          })
          if (claimed.count !== 1) throw new ConflictException('This subject was restored. Nothing was deleted.')

          const records = await tx.attendanceRecord.findMany({
            where: inSubject,
            select: { timestamp: true, recordHash: true, excuseEvidencePath: true },
          })
          const proofs = await tx.proofOfClass.findMany({ where: inSubject, select: { photoUrl: true } })
          await this.noteRemovedLedgerRows(tx, subject, records)

          const counts = {
            sections: sectionIds.length,
            sessions: sessionIds.length,
            attendanceRecords: records.length,
            classPhotos: proofs.length,
          }
          await tx.attendanceRecord.deleteMany({ where: inSubject })
          await tx.scanAttempt.deleteMany({ where: { sessionId: { in: sessionIds } } })
          await tx.proofOfClass.deleteMany({ where: inSubject })
          await tx.session.deleteMany({ where: { id: { in: sessionIds } } })
          await tx.enrollment.deleteMany({ where: { sectionId: { in: sectionIds } } })
          await tx.sectionRole.deleteMany({ where: { sectionId: { in: sectionIds } } })
          await tx.sessionPermission.deleteMany({ where: { sectionId: { in: sectionIds } } })
          // Schedules, enrolment blocks and referrals go with their section.
          await tx.section.deleteMany({ where: { id: { in: sectionIds } } })
          await tx.subject.delete({ where: { id: subjectId } })
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              actorRole: user.role,
              action: 'subject.force_deleted',
              entityType: 'subject',
              entityId: subjectId,
              metadata: { code: subject.code, name: subject.name, ...counts },
            },
          })
          return [
            ...proofs.map((proof) => proof.photoUrl),
            ...records.flatMap((record) => (record.excuseEvidencePath ? [record.excuseEvidencePath] : [])),
          ]
        },
        { timeout: DELETE_TRANSACTION_TIMEOUT_MS },
      )
      // Files go after the commit: a rolled-back delete must not leave records pointing at nothing.
      for (const reference of files) await this.removeFile(reference)
    })
  }

  /** Erases the evidence of every subject archived for longer than the retention period. */
  async purgeDueEvidence(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ARCHIVE_EVIDENCE_RETENTION_DAYS * MS_PER_DAY)
    const due = await this.prisma.subject.findMany({
      where: { archivedAt: { lte: cutoff }, evidencePurgedAt: null },
      select: { id: true },
    })
    let purged = 0
    for (const { id } of due) {
      try {
        if (await this.purgeEvidence(id, cutoff)) purged += 1
      } catch (error) {
        this.logger.error(`Could not erase the evidence of archived subject ${id}: ${errorText(error)}`)
      }
    }
    return purged
  }

  private async purgeEvidence(subjectId: string, cutoff: Date): Promise<boolean> {
    return this.withLock(subjectId, async () => {
      const subject = await this.requireSubject(subjectId)
      // Re-read under the lock: a restore in the meantime cancels the erasure.
      if (!subject.archivedAt || subject.archivedAt > cutoff || subject.evidencePurgedAt) return false
      const sectionIds = subject.sections.map((section) => section.id)
      const sessionIds = await this.sessionIds(sectionIds)
      const summary: EvidencePurgeSummary = {
        classPhotos: 0,
        excusePhotos: 0,
        locations: 0,
        scanAttempts: 0,
        failedFiles: 0,
      }
      await this.purgeClassPhotos(sectionIds, summary)
      await this.purgeExcusePhotos(sectionIds, summary)

      const inSections = { sectionId: { in: sectionIds } }
      const [, , , locations, attempts] = await this.prisma.$transaction([
        // Records point at the scan that was accepted, so the links come off first.
        this.prisma.attendanceRecord.updateMany({
          where: { ...inSections, acceptedScanAttemptId: { not: null } },
          data: { acceptedScanAttemptId: null },
        }),
        this.prisma.attendanceRecord.updateMany({
          where: { ...inSections, checkInAttemptId: { not: null } },
          data: { checkInAttemptId: null },
        }),
        this.prisma.attendanceRecord.updateMany({
          where: { ...inSections, checkOutAttemptId: { not: null } },
          data: { checkOutAttemptId: null },
        }),
        this.prisma.attendanceRecord.updateMany({
          where: { ...inSections, OR: [{ latitude: { not: null } }, { longitude: { not: null } }] },
          data: { latitude: null, longitude: null },
        }),
        this.prisma.scanAttempt.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      ])
      summary.locations = locations.count
      summary.scanAttempts = attempts.count

      if (summary.failedFiles === 0) {
        await this.prisma.subject.update({ where: { id: subjectId }, data: { evidencePurgedAt: new Date() } })
      }
      await this.audit('system', 'system', 'subject.evidence_purged', subjectId, {
        code: subject.code,
        ...summary,
      })
      return summary.failedFiles === 0
    })
  }

  private async purgeClassPhotos(sectionIds: string[], summary: EvidencePurgeSummary) {
    let cursor: string | undefined
    while (true) {
      const proofs = await this.prisma.proofOfClass.findMany({
        where: { sectionId: { in: sectionIds }, ...(cursor ? { id: { gt: cursor } } : {}) },
        select: { id: true, photoUrl: true },
        orderBy: { id: 'asc' },
        take: PURGE_BATCH_SIZE,
      })
      if (proofs.length === 0) return
      cursor = proofs[proofs.length - 1].id
      for (const proof of proofs) {
        // The row stays until its file is gone, so a failed removal is retried.
        if (await this.removeFile(proof.photoUrl)) {
          await this.prisma.proofOfClass.delete({ where: { id: proof.id } })
          summary.classPhotos += 1
        } else summary.failedFiles += 1
      }
    }
  }

  private async purgeExcusePhotos(sectionIds: string[], summary: EvidencePurgeSummary) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sectionId: { in: sectionIds }, excuseEvidencePath: { not: null } },
      select: { id: true, excuseEvidencePath: true },
    })
    for (const record of records) {
      if (await this.removeFile(record.excuseEvidencePath as string)) {
        await this.prisma.attendanceRecord.update({ where: { id: record.id }, data: { excuseEvidencePath: null } })
        summary.excusePhotos += 1
      } else summary.failedFiles += 1
    }
  }

  private async noteRemovedLedgerRows(
    tx: Prisma.TransactionClient,
    subject: LifecycleSubject,
    records: ReadonlyArray<{ timestamp: Date; recordHash: string | null }>,
  ) {
    const chained = records.filter((record) => record.recordHash)
    if (chained.length === 0) return
    const anchors = await tx.auditLog.findMany({
      where: { action: 'ledger.anchored' },
      select: { metadata: true },
    })
    const anchored = new Set(
      anchors.map((anchor) => (anchor.metadata as { lastRecordHash?: string } | null)?.lastRecordHash),
    )
    const dates: Record<string, { count: number; anchoredHashes: string[] }> = {}
    for (const record of chained) {
      const day = (dates[ledgerDateOf(record.timestamp)] ??= { count: 0, anchoredHashes: [] })
      day.count += 1
      if (anchored.has(record.recordHash as string)) day.anchoredHashes.push(record.recordHash as string)
    }
    await tx.auditLog.create({
      data: {
        actorId: 'system',
        actorRole: 'system',
        action: LEDGER_RECORDS_REMOVED_ACTION,
        entityType: 'ledger',
        entityId: subject.id,
        metadata: { reason: 'subject_force_deleted', subjectCode: subject.code, dates },
      },
    })
  }

  private async describe(subject: LifecycleSubject): Promise<SubjectLifecycle> {
    const inSubject = { sectionId: { in: subject.sections.map((section) => section.id) } }
    const [sessions, attendanceRecords, classPhotos, excusePhotos] = await Promise.all([
      this.prisma.session.count({ where: inSubject }),
      this.prisma.attendanceRecord.count({ where: inSubject }),
      this.prisma.proofOfClass.count({ where: inSubject }),
      this.prisma.attendanceRecord.count({ where: { ...inSubject, excuseEvidencePath: { not: null } } }),
    ])
    return {
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      archivedAt: subject.archivedAt?.toISOString() ?? null,
      evidencePurgeAt: subject.archivedAt ? archiveEvidencePurgeAt(subject.archivedAt).toISOString() : null,
      evidencePurgedAt: subject.evidencePurgedAt?.toISOString() ?? null,
      counts: { sections: subject.sections.length, sessions, attendanceRecords, classPhotos, excusePhotos },
    }
  }

  private async requireSubject(subjectId: string): Promise<LifecycleSubject> {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: subjectSelect })
    if (!subject) throw new NotFoundException('Subject not found')
    return subject
  }

  private async readableSubject(subjectId: string, user: RequestUser): Promise<LifecycleSubject> {
    const subject = await this.requireSubject(subjectId)
    if (user.role === 'super_admin') {
      const scoped = adminSubjectWhere(user)
      if (scoped && !(await this.prisma.subject.findFirst({ where: { AND: [{ id: subjectId }, scoped] } }))) {
        throw new NotFoundException('Subject not found')
      }
      return subject
    }
    const teaches = subject.sections.some((section) => section.teacherId === user.id)
    if (user.role !== 'teacher' || (subject.createdById !== user.id && !teaches)) {
      throw new NotFoundException('Subject not found')
    }
    return subject
  }

  /**
   * Archiving and deleting reach every class under the subject, so only its creator may do it, and not
   * while another teacher has a class there.
   */
  private async managedSubject(subjectId: string, user: RequestUser): Promise<LifecycleSubject> {
    const subject = await this.requireSubject(subjectId)
    const others = subject.sections.some((section) => section.teacherId !== user.id)
    const owns = subject.createdById === user.id || (!subject.createdById && subject.sections.length > 0 && !others)
    if (user.role !== 'teacher' || !owns) {
      throw new ForbiddenException('Only the teacher who created this subject can archive, restore or delete it')
    }
    if (others) {
      throw new ConflictException(
        'Other teachers have classes under this subject, so it cannot be archived or deleted by one teacher',
      )
    }
    return subject
  }

  private async sessionIds(sectionIds: string[]): Promise<string[]> {
    const sessions = await this.prisma.session.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true },
    })
    return sessions.map((session) => session.id)
  }

  /** Archive, restore, delete and the nightly erasure never run on one subject at the same time. */
  private async withLock<T>(subjectId: string, work: () => Promise<T>): Promise<T> {
    const key = `subject-lifecycle:${subjectId}`
    const token = await this.redis.acquireLock(key, LOCK_TTL_SECONDS)
    if (!token) throw new ConflictException('This subject is being updated. Try again in a moment.')
    try {
      return await work()
    } finally {
      await this.redis.releaseLock(key, token)
    }
  }

  private async removeFile(reference: string): Promise<boolean> {
    try {
      await this.storage.remove(reference)
      return true
    } catch (error) {
      this.logger.error(`Could not remove a stored file: ${errorText(error)}`)
      return false
    }
  }

  private async audit(
    actorId: string,
    actorRole: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, actorRole, action, entityType: 'subject', entityId, metadata },
      })
    } catch (error) {
      this.logger.error(`Could not write the audit entry ${action} for subject ${entityId}: ${errorText(error)}`)
    }
  }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
