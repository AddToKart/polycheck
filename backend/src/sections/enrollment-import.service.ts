import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { computeRowChecksum, type EnrollImportResult, type ImportIssue, type ImportIssueCode } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { ErrorCode } from '../common/constants/error-codes'
import { lockSection } from '../common/student-section-lock'
import { generateTemporaryPassword, hashPasswords } from '../common/utils/password'
import { MetricsService } from '../observability/metrics.service'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../prisma/client'
import { SettingsService } from '../settings/settings.service'
import type { EnrollImportRequestDto, EnrollImportRowDto } from './dto/import-enrollments.dto'

const IMPORT_BATCH_KIND = 'section_enrollment'
const IMPORT_RETENTION_DAYS = 90
const MAX_RETURNED_ISSUES = 50
const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-[A-Z]{2}-\d$/
const DEFAULT_PROGRAM = 'Unspecified'
const DEFAULT_YEAR_LEVEL = 1

type EnrollDb = Pick<Prisma.TransactionClient, 'section' | 'user' | 'enrollment'>

interface OwnedSection {
  id: string
  teacherId: string
  teacher: { department: string | null }
}

interface NormalizedEnrollRow {
  rowNumber: number
  studentId: string
  studentName?: string
  expectedProgram?: string
  expectedYearLevel?: number
  issues: ImportIssue[]
  blocked: boolean
}

type PlannedAction = 'enroll' | 'provision' | 'skip' | 'invalid'

interface PlannedEnrollRow {
  row: NormalizedEnrollRow
  action: PlannedAction
  userId?: string
}

interface EnrollmentImportPlan {
  rows: PlannedEnrollRow[]
  summary: {
    total: number
    valid: number
    enrollable: number
    skip: number
    invalid: number
    provisioning?: number
  }
  issues: ImportIssue[]
  hasMoreIssues: boolean
  rowChecksum: string
}

interface PreparedProvision {
  password: string
  passwordHash: string
}

@Injectable()
export class EnrollmentImportService {
  private readonly logger = new Logger(EnrollmentImportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async importEnrollments(
    sectionId: string,
    dto: EnrollImportRequestDto,
    user: RequestUser,
  ): Promise<EnrollImportResult> {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can import section enrollments')
    }
    const provisioningEnabled = await this.settings.getBoolean('allow_teacher_student_provisioning', false)

    if (dto.mode === 'validate') {
      const section = await this.loadOwnedSection(this.prisma, sectionId, user.id)
      const plan = await this.analyze(this.prisma, section, dto.rows, provisioningEnabled)
      return this.present(plan, 'validate')
    }

    this.assertChecksum(dto)
    const preliminarySection = await this.loadOwnedSection(this.prisma, sectionId, user.id)
    const preliminary = await this.analyze(this.prisma, preliminarySection, dto.rows, provisioningEnabled)
    const prepared = await this.prepareProvisioning(preliminary.rows, provisioningEnabled)

    let committed: {
      plan: EnrollmentImportPlan
      created: number
      provisioned: Array<{ userId: string; studentId: string }>
    }
    try {
      committed = await this.prisma.$transaction(async (tx) => {
        await lockSection(tx, sectionId)
        const section = await this.loadOwnedSection(tx, sectionId, user.id)
        const plan = await this.analyze(tx, section, dto.rows, provisioningEnabled)
        const now = new Date()
        const authAccounts: Prisma.AuthAccountCreateManyInput[] = []
        const provisionedForAudit: Array<{ userId: string; studentId: string }> = []
        const userIdByStudentId = new Map<string, string>()

        for (const planned of plan.rows) {
          if (planned.action !== 'provision') continue
          const preparedProvision =
            prepared.get(planned.row.studentId) ??
            (await this.prepareProvisioning([planned], provisioningEnabled)).get(planned.row.studentId)
          if (!preparedProvision || !section.teacher.department) continue

          const userId = randomUUID()
          await tx.user.create({
            data: {
              id: userId,
              studentId: planned.row.studentId,
              fullName: planned.row.studentName?.trim() || `Student ${planned.row.studentId}`,
              email: null,
              authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
              password: preparedProvision.passwordHash,
              role: 'student',
              program: planned.row.expectedProgram ?? DEFAULT_PROGRAM,
              yearLevel: planned.row.expectedYearLevel ?? DEFAULT_YEAR_LEVEL,
              department: section.teacher.department,
              isActive: false,
              mustChangePassword: true,
            },
          })
          authAccounts.push({
            id: randomUUID(),
            accountId: userId,
            providerId: 'credential',
            userId,
            password: preparedProvision.passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          userIdByStudentId.set(planned.row.studentId, userId)
          provisionedForAudit.push({ userId, studentId: planned.row.studentId })
        }

        if (authAccounts.length > 0) {
          await tx.authAccount.createMany({ data: authAccounts })
        }

        for (const planned of plan.rows) {
          if (planned.action === 'enroll' && planned.userId) {
            userIdByStudentId.set(planned.row.studentId, planned.userId)
          }
        }

        const enrollmentData = plan.rows
          .filter((planned) => planned.action === 'enroll' || planned.action === 'provision')
          .map((planned) => {
            const studentId = userIdByStudentId.get(planned.row.studentId)
            if (!studentId) return null
            return { studentId, sectionId }
          })
          .filter((entry): entry is { studentId: string; sectionId: string } => entry !== null)

        const created = enrollmentData.length
          ? (await tx.enrollment.createMany({ data: enrollmentData, skipDuplicates: true })).count
          : 0

        // Reconcile the cached counter with the authoritative row count in a
        // single write — also self-heals prior drift and idempotent re-runs.
        const studentCount = await tx.enrollment.count({ where: { sectionId } })
        await tx.section.update({ where: { id: sectionId }, data: { studentCount } })

        return { plan, created, provisioned: provisionedForAudit }
      })
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new ConflictException('The roster changed while this import was running. Validate the rows again.')
      }
      throw error
    }

    // Audit availability must not turn a committed enrollment into an apparent
    // failure (repo-wide fail-open audit policy).
    if (committed.provisioned.length > 0) {
      try {
        await this.prisma.auditLog.createMany({
          data: committed.provisioned.map((provisioned) => ({
            actorId: user.id,
            actorRole: user.role,
            action: 'bulk_provision',
            entityType: 'user',
            entityId: provisioned.userId,
            metadata: { studentId: provisioned.studentId, sectionId },
          })),
        })
      } catch (error) {
        this.logger.error(
          `Could not write bulk-provision audit rows for section ${sectionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    await this.recordImport(
      committed.plan,
      committed.created,
      dto,
      user,
      sectionId,
      preliminarySection.teacher.department,
    )
    this.recordMetrics(committed.plan)
    return this.present(committed.plan, 'execute')
  }

  assertChecksum(dto: EnrollImportRequestDto): string {
    const checksum = this.computeChecksum(dto.rows)
    if (!dto.rowChecksum || dto.rowChecksum !== checksum) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: ErrorCode.IMPORT_CHECKSUM_MISMATCH,
        message: 'The validated row set no longer matches this request. Run validation again before importing.',
      })
    }
    return checksum
  }

  private async loadOwnedSection(db: EnrollDb, sectionId: string, teacherId: string): Promise<OwnedSection> {
    const section = await db.section.findUnique({
      where: { id: sectionId },
      select: { id: true, teacherId: true, teacher: { select: { department: true } } },
    })
    if (!section) throw new NotFoundException('Section not found')
    if (section.teacherId !== teacherId) {
      throw new ForbiddenException('You can only import students into your own sections')
    }
    return section
  }

  private async analyze(
    db: EnrollDb,
    section: OwnedSection,
    rows: EnrollImportRowDto[],
    provisioningEnabled: boolean,
  ): Promise<EnrollmentImportPlan> {
    const normalized = this.normalizeRows(rows)
    const studentIds = [...new Set(normalized.map((row) => row.studentId))]
    const [students, enrollments] = await Promise.all([
      db.user.findMany({
        where: { studentId: { in: studentIds } },
        select: {
          id: true,
          studentId: true,
          fullName: true,
          program: true,
          yearLevel: true,
          role: true,
          isActive: true,
        },
      }),
      db.enrollment.findMany({ where: { sectionId: section.id }, select: { studentId: true } }),
    ])

    const studentByNumber = new Map(
      students.filter((student) => student.studentId).map((student) => [student.studentId!, student]),
    )
    const enrolled = new Set(enrollments.map((enrollment) => enrollment.studentId))

    const planned: PlannedEnrollRow[] = normalized.map((row) => {
      if (row.blocked) return { row, action: 'invalid' }
      const student = studentByNumber.get(row.studentId)

      if (!student) {
        if (provisioningEnabled && section.teacher.department) return { row, action: 'provision' }
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'studentId',
          code: 'STUDENT_NOT_FOUND',
          message:
            provisioningEnabled && !section.teacher.department
              ? 'This section teacher has no department configured, so a minimal account cannot be provisioned. Ask a Super Admin to import the roster.'
              : 'No Polycheck account exists for this student number. Ask a Super Admin to import the department roster first.',
        })
        return { row, action: 'invalid' }
      }

      // Membership precedes activation checks so idempotent re-runs report an
      // already-applied row as a skip, not as an inactive-account failure.
      if (enrolled.has(student.id)) {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'studentId',
          code: 'ALREADY_ENROLLED',
          message: 'This student is already enrolled in this section. This row will be skipped.',
        })
        return { row, action: 'skip', userId: student.id }
      }

      if (student.role !== 'student' || !student.isActive) {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'studentId',
          code: 'STUDENT_INACTIVE',
          message: 'This student account is inactive. Ask a Super Admin to activate it first.',
        })
        return { row, action: 'invalid' }
      }

      if (
        (row.expectedProgram &&
          this.normalizeText(row.expectedProgram) !== this.normalizeText(student.program ?? '')) ||
        (row.expectedYearLevel !== undefined && row.expectedYearLevel !== student.yearLevel)
      ) {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'program',
          code: 'PROGRAM_YEAR_MISMATCH',
          message: `The master list does not match the account (${student.program ?? 'unknown program'}, year ${
            student.yearLevel ?? 'unknown'
          }). Enrollment will continue.`,
        })
      }

      return { row, action: 'enroll', userId: student.id }
    })

    const summary = {
      total: planned.length,
      valid: 0,
      enrollable: 0,
      skip: 0,
      invalid: 0,
      ...(provisioningEnabled ? { provisioning: 0 } : {}),
    }
    for (const item of planned) {
      if (item.action === 'enroll') summary.enrollable += 1
      else if (item.action === 'provision') summary.provisioning = (summary.provisioning ?? 0) + 1
      else if (item.action === 'skip') summary.skip += 1
      else summary.invalid += 1
    }
    summary.valid = summary.enrollable + (summary.provisioning ?? 0) + summary.skip

    const allIssues = planned
      .flatMap((item) => item.row.issues)
      .sort((left, right) => left.rowNumber - right.rowNumber || left.code.localeCompare(right.code))

    return {
      rows: planned,
      summary,
      issues: allIssues.slice(0, MAX_RETURNED_ISSUES),
      hasMoreIssues: allIssues.length > MAX_RETURNED_ISSUES,
      rowChecksum: computeRowChecksum(normalized.map((row) => this.canonicalRow(row))),
    }
  }

  private normalizeRows(rows: EnrollImportRowDto[]): NormalizedEnrollRow[] {
    const seen = new Map<string, number>()
    return rows.map((raw) => {
      const issues: ImportIssue[] = []
      let blocked = false
      const rowNumber = raw.rowNumber
      const studentId = String(raw.studentId ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()
      const studentName = raw.studentName?.replace(/\s+/g, ' ').trim() || undefined
      const expectedProgram = raw.expectedProgram?.replace(/\s+/g, ' ').trim() || undefined
      const expectedYearLevel = raw.expectedYearLevel

      if (!STUDENT_ID_PATTERN.test(studentId)) {
        issues.push({
          rowNumber,
          column: 'studentId',
          code: 'INVALID_STUDENT_NUMBER',
          message: 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
        })
        blocked = true
      }
      if (
        expectedYearLevel !== undefined &&
        (!Number.isInteger(expectedYearLevel) || expectedYearLevel < 1 || expectedYearLevel > 8)
      ) {
        issues.push({
          rowNumber,
          column: 'expectedYearLevel',
          code: 'YEAR_LEVEL_OUT_OF_RANGE',
          message: 'Year level must be between 1 and 8.',
        })
        blocked = true
      }

      const firstRow = seen.get(studentId)
      if (firstRow !== undefined) {
        issues.push({
          rowNumber,
          column: 'studentId',
          code: 'DUPLICATE_IN_FILE',
          message: `Duplicate of row ${firstRow}.`,
        })
        blocked = true
      } else if (studentId) {
        seen.set(studentId, rowNumber)
      }

      return {
        rowNumber,
        studentId,
        ...(studentName ? { studentName } : {}),
        ...(expectedProgram ? { expectedProgram } : {}),
        ...(expectedYearLevel !== undefined ? { expectedYearLevel } : {}),
        issues,
        blocked,
      }
    })
  }

  private canonicalRow(row: NormalizedEnrollRow): Record<string, unknown> {
    return {
      rowNumber: row.rowNumber,
      studentId: row.studentId,
      ...(row.studentName ? { studentName: row.studentName } : {}),
      ...(row.expectedProgram ? { expectedProgram: row.expectedProgram } : {}),
      ...(row.expectedYearLevel !== undefined ? { expectedYearLevel: row.expectedYearLevel } : {}),
    }
  }

  private computeChecksum(rows: EnrollImportRowDto[]): string {
    return computeRowChecksum(this.normalizeRows(rows).map((row) => this.canonicalRow(row)))
  }

  private async prepareProvisioning(
    rows: PlannedEnrollRow[],
    provisioningEnabled: boolean,
  ): Promise<Map<string, PreparedProvision>> {
    if (!provisioningEnabled) return new Map()
    const creating = rows.filter((row) => row.action === 'provision')
    const passwords = creating.map(() => generateTemporaryPassword())
    const hashes = await hashPasswords(passwords)
    const prepared = new Map<string, PreparedProvision>()
    creating.forEach((row, index) => {
      prepared.set(row.row.studentId, { password: passwords[index], passwordHash: hashes[index] })
    })
    return prepared
  }

  private normalizeText(value: string) {
    return value.replace(/\s+/g, ' ').trim().toLowerCase()
  }

  private present(plan: EnrollmentImportPlan, mode: 'validate' | 'execute'): EnrollImportResult {
    return {
      mode,
      rowChecksum: plan.rowChecksum,
      summary: plan.summary,
      issues: plan.issues,
      hasMoreIssues: plan.hasMoreIssues,
    }
  }

  private recordMetrics(plan: EnrollmentImportPlan) {
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'enrolled', plan.summary.enrollable)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'provisioned', plan.summary.provisioning ?? 0)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'skipped', plan.summary.skip)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'invalid', plan.summary.invalid)
  }

  private async recordImport(
    plan: EnrollmentImportPlan,
    created: number,
    dto: EnrollImportRequestDto,
    user: RequestUser,
    sectionId: string,
    department: string | null,
  ) {
    const issueCodes = [...new Set(plan.rows.flatMap((row) => row.row.issues.map((issue) => issue.code)))]
    const summaryJson = {
      mode: dto.mode,
      enrollable: plan.summary.enrollable,
      provisioning: plan.summary.provisioning ?? 0,
      skip: plan.summary.skip,
      invalid: plan.summary.invalid,
      issueCodes,
    }
    let batchId: string | null = null
    try {
      const batch = await this.prisma.importBatch.create({
        data: {
          kind: IMPORT_BATCH_KIND,
          actorId: user.id,
          department,
          total: plan.summary.total,
          created,
          updated: 0,
          skipped: plan.summary.skip,
          failed: plan.summary.invalid,
          summary: summaryJson,
          rowChecksum: plan.rowChecksum,
        },
        select: { id: true },
      })
      batchId = batch.id
    } catch (error) {
      this.logger.error(
        `Could not persist enrollment import batch for actor ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action: 'bulk_enrollment_import',
          entityType: 'section',
          entityId: sectionId,
          metadata: {
            batchId,
            importSummary: {
              kind: IMPORT_BATCH_KIND,
              total: plan.summary.total,
              created,
              skipped: plan.summary.skip,
              failed: plan.summary.invalid,
              provisioning: plan.summary.provisioning ?? 0,
            },
            issueCodes,
          },
        },
      })
    } catch (error) {
      this.logger.error(
        `Could not write enrollment import audit summary for actor ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    await this.pruneOldBatches()
  }

  private async pruneOldBatches() {
    const cutoff = new Date(Date.now() - IMPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    try {
      await this.prisma.importBatch.deleteMany({ where: { createdAt: { lt: cutoff } } })
    } catch (error) {
      this.logger.warn(
        `Could not prune import batches older than ${IMPORT_RETENTION_DAYS} days: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}

export type { ImportIssueCode }
