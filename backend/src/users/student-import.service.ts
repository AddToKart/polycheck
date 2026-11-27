import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { isEmail } from 'class-validator'
import {
  computeRowChecksum,
  type ImportCredential,
  type ImportIssue,
  type ImportIssueCode,
  type StudentImportResult,
  type StudentImportSummary,
  normalizeCourse,
} from '@polycheck/shared'
import { courseInScope, courseScopeMode } from '../common/course-scope'
import { PrismaService } from '../prisma/prisma.service'
import { AccountActivationService } from '../account-activation/account-activation.service'
import { MailService } from '../mail/mail.service'
import { SettingsService } from '../settings/settings.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'
import { accountAdminScope } from '../common/designations/department-pin'
import { ErrorCode } from '../common/constants/error-codes'
import { generateTemporaryPassword, hashPasswords } from '../common/utils/password'
import { MetricsService } from '../observability/metrics.service'
import type { StudentImportRequestDto, StudentImportRowDto } from './dto/import-students.dto'

const IMPORT_BATCH_KIND = 'student_registration'
const IMPORT_RETENTION_DAYS = 90
// A batch is at most 250 rows, so every skipped or rejected row can be listed.
const MAX_RETURNED_ISSUES = 1000
const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-[A-Z]{2}-\d$/
// The domain constraint requires every student to have these fields. Import
// rows are allowed to omit optional columns, so creation uses institution-safe
// defaults while updates never clear an existing value.
const DEFAULT_PROGRAM = 'Unspecified'
const DEFAULT_YEAR_LEVEL = 1
const DEFAULT_DEPARTMENT = 'Unspecified'

type ImportDb = Pick<Prisma.TransactionClient, 'user'>

type PlannedAction = 'create' | 'update' | 'skip' | 'invalid'

interface NormalizedStudentRow {
  rowNumber: number
  fullName: string
  studentId: string
  email?: string
  program?: string
  yearLevel?: number
  /** Effective department used when creating/updating the account. */
  department: string
  /** Department exactly as submitted (drives the row checksum). */
  submittedDepartment?: string
  issues: ImportIssue[]
  blocked: boolean
}

interface ExistingStudent {
  id: string
  studentId: string | null
  fullName: string
  email: string | null
  program: string | null
  yearLevel: number | null
  department: string | null
}

interface PlannedStudentRow {
  row: NormalizedStudentRow
  action: PlannedAction
  existing?: ExistingStudent
  changedFields: string[]
}

interface StudentImportPlan {
  rows: PlannedStudentRow[]
  summary: StudentImportSummary
  issues: ImportIssue[]
  hasMoreIssues: boolean
  rowChecksum: string
}

interface PreparedCredential {
  password: string
  passwordHash: string
}

@Injectable()
export class StudentImportService {
  private readonly logger = new Logger(StudentImportService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly activation?: AccountActivationService,
    @Optional() private readonly mail?: MailService,
  ) {}

  /**
   * `activation_email` is honored only when an administrator switched it on and a
   * mail provider is configured; otherwise the request is refused up front (at
   * validate time too) instead of silently falling back to a different mode.
   */
  async assertDeliveryModeAvailable(dto: Pick<StudentImportRequestDto, 'deliveryMode'>): Promise<void> {
    if (dto.deliveryMode !== 'activation_email') return
    const enabled = (await this.settings?.getBoolean('activation_email_enabled', false)) ?? false
    const configured = this.mail?.status().configured ?? false
    if (!enabled || !configured || !this.activation) {
      throw new BadRequestException({
        code: 'activation_email_unavailable',
        message: !enabled
          ? 'Email activation is switched off. Turn it on in Institution Settings, or import with temporary passwords.'
          : 'Email delivery is not configured on this server. Import with temporary passwords instead.',
      })
    }
  }

  async importStudents(dto: StudentImportRequestDto, user: RequestUser): Promise<StudentImportResult> {
    await this.assertDeliveryModeAvailable(dto)
    if (dto.mode === 'validate') {
      const plan = await this.analyze(this.prisma, dto, user)
      return this.present(plan, dto.conflictMode, 'validate')
    }
    return this.execute(dto, user)
  }

  /**
   * Verifies the execute request is bound to the exact row set that was
   * validated. Public so the BullMQ producer can reject a bad request before
   * enqueueing it.
   */
  assertChecksum(dto: StudentImportRequestDto, user: RequestUser): string {
    const checksum = this.computeChecksum(dto, user)
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

  private async execute(dto: StudentImportRequestDto, user: RequestUser): Promise<StudentImportResult> {
    this.assertChecksum(dto, user)

    // Hash outside the transaction from the preliminary plan, then re-plan
    // inside the transaction for authoritative rows. If a row races into
    // existence between the two reads it becomes an update/skip and its
    // prepared credential is discarded.
    const preliminary = await this.analyze(this.prisma, dto, user)
    const prepared = await this.prepareCredentials(preliminary.rows)

    const activationMode = dto.deliveryMode === 'activation_email'
    let committed: {
      plan: StudentImportPlan
      credentials: ImportCredential[]
      mailIds: string[]
      fallbackTemporary: number
    }
    try {
      committed = await this.prisma.$transaction(async (tx) => {
        const plan = await this.analyze(tx, dto, user)
        const credentials: ImportCredential[] = []
        const mailIds: string[] = []
        let fallbackTemporary = 0
        const authAccounts: Prisma.AuthAccountCreateManyInput[] = []
        const now = new Date()

        for (const planned of plan.rows) {
          if (planned.action !== 'create') continue
          const preparedCredential =
            prepared.get(planned.row.studentId) ?? (await this.prepareCredentials([planned])).get(planned.row.studentId)
          if (!preparedCredential) continue

          const id = randomUUID()
          // Rows with an email get an activation link; the stored password is random and never
          // revealed, so the account simply cannot be logged into until the student activates it.
          const emailActivation = activationMode && Boolean(planned.row.email)
          const authEmail = `u-${randomUUID()}@auth.polycheck.invalid`
          await tx.user.create({
            data: {
              id,
              fullName: planned.row.fullName,
              studentId: planned.row.studentId,
              email: planned.row.email ?? null,
              authEmail,
              password: preparedCredential.passwordHash,
              role: 'student',
              program: planned.row.program ?? DEFAULT_PROGRAM,
              yearLevel: planned.row.yearLevel ?? DEFAULT_YEAR_LEVEL,
              department: planned.row.department || DEFAULT_DEPARTMENT,
              mustChangePassword: true,
              activationPending: emailActivation,
            },
          })
          authAccounts.push({
            id: randomUUID(),
            accountId: id,
            providerId: 'credential',
            userId: id,
            password: preparedCredential.passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          if (emailActivation && this.activation) {
            const queued = await this.activation.queueActivationMail(id, { db: tx, announce: false })
            mailIds.push(queued.id)
          } else {
            if (activationMode) fallbackTemporary += 1
            credentials.push({
              rowNumber: planned.row.rowNumber,
              studentId: planned.row.studentId,
              tempPassword: preparedCredential.password,
            })
          }
        }

        if (authAccounts.length > 0) {
          await tx.authAccount.createMany({ data: authAccounts })
        }

        for (const planned of plan.rows) {
          if (planned.action !== 'update' || !planned.existing) continue
          const data: Prisma.UserUpdateInput = {}
          if (planned.changedFields.includes('fullName')) data.fullName = planned.row.fullName
          if (planned.changedFields.includes('email')) data.email = planned.row.email ?? null
          if (planned.changedFields.includes('program')) data.program = planned.row.program ?? null
          if (planned.changedFields.includes('yearLevel')) data.yearLevel = planned.row.yearLevel ?? null
          if (planned.changedFields.includes('department')) data.department = planned.row.department
          else if (planned.changedFields.includes('program') && planned.row.program) {
            // Students have no department of their own: the column mirrors the course.
            const { department, program } = planned.existing
            if (courseScopeMode() === 'course' || !department?.trim() || department === program) {
              data.department = planned.row.program
            }
          }
          // Password, role, isActive, and studentId are intentionally never
          // changed by imports.
          if (Object.keys(data).length > 0) {
            await tx.user.update({ where: { id: planned.existing.id }, data })
          }
        }

        return { plan, credentials, mailIds, fallbackTemporary }
      })
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new ConflictException('The roster changed while this import was running. Validate the rows again.')
      }
      throw error
    }

    const { plan, credentials, mailIds, fallbackTemporary } = committed
    const batchId = await this.recordImport(plan, dto, user)
    this.recordMetrics(plan.summary)
    if (mailIds.length > 0) {
      // Tie the outbox rows to this import for the report, then wake the worker (the sweeper
      // would also find them). Neither step may fail the import: the accounts already exist.
      if (batchId) {
        await this.prisma.accountMail
          .updateMany({ where: { id: { in: mailIds } }, data: { batchId } })
          .catch((error: unknown) => this.logger.warn(`Could not tag activation mail with the import batch: ${error}`))
      }
      this.activation?.announceQueued(mailIds)
    }

    const base = this.present(plan, dto.conflictMode, 'execute')
    const result = activationMode ? { ...base, activation: { queued: mailIds.length, fallbackTemporary } } : base
    return credentials.length > 0
      ? { ...result, credentials: credentials.sort((left, right) => left.rowNumber - right.rowNumber) }
      : result
  }

  private async analyze(db: ImportDb, dto: StudentImportRequestDto, user: RequestUser): Promise<StudentImportPlan> {
    const rows = this.normalizeRows(dto.rows, user)
    const studentIds = [...new Set(rows.map((row) => row.studentId))]
    const emails = [...new Set(rows.map((row) => row.email).filter((email): email is string => Boolean(email)))]

    const [existingStudents, emailOwners] = await Promise.all([
      db.user.findMany({
        where: { studentId: { in: studentIds } },
        select: {
          id: true,
          studentId: true,
          fullName: true,
          email: true,
          program: true,
          yearLevel: true,
          department: true,
        },
      }),
      emails.length > 0
        ? db.user.findMany({
            where: { email: { in: emails } },
            select: { id: true, studentId: true, email: true },
          })
        : Promise.resolve([]),
    ])

    const existingByStudentId = new Map<string, ExistingStudent>(
      existingStudents
        .filter((student): student is ExistingStudent => Boolean(student.studentId))
        .map((student) => [student.studentId!, student]),
    )
    const emailOwnerByAddress = new Map<string, { id: string; studentId: string | null }>(
      emailOwners
        .filter((owner): owner is { id: string; studentId: string | null; email: string } => Boolean(owner.email))
        .map((owner) => [owner.email!, owner]),
    )
    const scope = accountAdminScope(user)

    const planned: PlannedStudentRow[] = rows.map((row) => {
      let blocked = row.blocked
      const existing = existingByStudentId.get(row.studentId)

      if (existing && scope.kind === 'courses' && !courseInScope(scope, existing.program)) {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'program',
          code: 'DEPARTMENT_MISMATCH',
          message: `This account is enrolled in ${existing.program ?? 'another course'}, which is outside your courses.`,
        })
        blocked = true
      }

      if (
        existing &&
        scope.kind === 'department' &&
        existing.department?.toLowerCase() !== scope.department.toLowerCase()
      ) {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'department',
          code: 'DEPARTMENT_MISMATCH',
          message: `This account belongs to ${existing.department ?? 'another department'} and is outside your administrative scope.`,
        })
        blocked = true
      }

      if (row.email) {
        const owner = emailOwnerByAddress.get(row.email)
        if (owner && owner.id !== existing?.id) {
          row.issues.push({
            rowNumber: row.rowNumber,
            column: 'email',
            code: 'ACCOUNT_ALREADY_EXISTS',
            message: `${row.email} is already linked to another PolyCheck account.`,
          })
          blocked = true
        }
      }

      if (blocked) return { row, action: 'invalid', existing, changedFields: [] }

      if (!existing) return { row, action: 'create', changedFields: [] }

      if (dto.conflictMode === 'skip_existing') {
        row.issues.push({
          rowNumber: row.rowNumber,
          column: 'studentId',
          code: 'ACCOUNT_ALREADY_EXISTS',
          message: 'A student account with this student number already exists. This row will be skipped.',
        })
        return { row, action: 'skip', existing, changedFields: [] }
      }

      const changedFields = this.changedFields(row, existing)
      if (changedFields.length > 0) {
        row.issues.push({
          rowNumber: row.rowNumber,
          code: 'FIELD_UPDATE_PREVIEW',
          message: `Updates: ${changedFields.join(', ')}`,
        })
      }
      return { row, action: 'update', existing, changedFields }
    })

    const summary: StudentImportSummary = {
      total: planned.length,
      valid: 0,
      new: 0,
      update: 0,
      skip: 0,
      invalid: 0,
    }
    for (const item of planned) {
      if (item.action === 'create') summary.new += 1
      else if (item.action === 'update') summary.update += 1
      else if (item.action === 'skip') summary.skip += 1
      else summary.invalid += 1
    }
    summary.valid = summary.new + summary.update + summary.skip

    return {
      rows: planned,
      summary,
      ...this.capIssues(planned),
      rowChecksum: this.checksumFor(rows, dto.deliveryMode),
    }
  }

  private normalizeRows(rows: StudentImportRowDto[], user: RequestUser): NormalizedStudentRow[] {
    const scope = accountAdminScope(user)
    if (scope.kind === 'none') {
      throw new ForbiddenException('Your administrator account has no department scope')
    }

    const seen = new Map<string, number>()
    const emailRow = new Map<string, number>()
    return rows.map((raw) => {
      const issues: ImportIssue[] = []
      let blocked = false
      const rowNumber = raw.rowNumber
      const fullName = String(raw.fullName ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      const studentId = String(raw.studentId ?? '')
        .replace(/\s+/g, '')
        .trim()
        .toUpperCase()
      const email = raw.email?.trim().toLowerCase() || undefined
      const submittedProgram = raw.program?.replace(/\s+/g, ' ').trim() || undefined
      // A program that matches the course catalog is stored as its code (BSIT);
      // anything else is kept exactly as submitted — never dropped or blocked.
      const matchedCourse = submittedProgram ? normalizeCourse(submittedProgram) : undefined
      const program = matchedCourse?.matched ? matchedCourse.code : submittedProgram
      const yearLevel = raw.yearLevel
      const providedDepartment = raw.department?.replace(/\s+/g, ' ').trim() || undefined

      if (fullName.length < 2 || fullName.length > 150) {
        issues.push({
          rowNumber,
          column: 'fullName',
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Full name is required (2-150 characters).',
        })
        blocked = true
      }
      if (!STUDENT_ID_PATTERN.test(studentId)) {
        issues.push({
          rowNumber,
          column: 'studentId',
          code: 'INVALID_STUDENT_NUMBER',
          message: 'Enter a valid student number (e.g. 2024-00001-MN-0).',
        })
        blocked = true
      }
      if (email && (!isEmail(email) || email.length > 254)) {
        issues.push({
          rowNumber,
          column: 'email',
          code: 'INVALID_EMAIL',
          message: 'Email address is invalid.',
        })
        blocked = true
      }
      if (program && (program.length < 2 || program.length > 150)) {
        issues.push({
          rowNumber,
          column: 'program',
          code: 'PROGRAM_TOO_SHORT',
          message: 'Program must be 2-150 characters.',
        })
        blocked = true
      }
      if (yearLevel !== undefined && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 8)) {
        issues.push({
          rowNumber,
          column: 'yearLevel',
          code: 'YEAR_LEVEL_OUT_OF_RANGE',
          message: 'Year level must be between 1 and 8.',
        })
        blocked = true
      }

      let department: string
      if (scope.kind === 'department') {
        if (providedDepartment && providedDepartment.toLowerCase() !== scope.department.toLowerCase()) {
          issues.push({
            rowNumber,
            column: 'department',
            code: 'DEPARTMENT_MISMATCH',
            message: `Rows for this import must belong to ${scope.department}.`,
          })
          blocked = true
        }
        department = scope.department
      } else if (scope.kind === 'courses') {
        // Course-pinned registrar: the program must be one of their courses. The legacy
        // `department` column is auto-filled with the course code.
        if (!matchedCourse?.matched || !courseInScope(scope, matchedCourse.code)) {
          issues.push({
            rowNumber,
            column: 'program',
            code: 'DEPARTMENT_MISMATCH',
            message: `Rows for this import must belong to one of your courses (${scope.courses.join(', ')}).`,
          })
          blocked = true
        }
        department = providedDepartment ?? matchedCourse?.code ?? DEFAULT_DEPARTMENT
      } else {
        // The campus has no departments: default to the course code when the program is in the catalog.
        department = providedDepartment ?? matchedCourse?.code ?? DEFAULT_DEPARTMENT
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

      // Emails are unique per account. Two rows sharing one would otherwise fail the whole batch.
      const sameEmail = email && !blocked ? emailRow.get(email) : undefined
      if (sameEmail !== undefined) {
        issues.push({
          rowNumber,
          column: 'email',
          code: 'DUPLICATE_IN_FILE',
          message: `Same email address as row ${sameEmail}. Each student needs their own email.`,
        })
        blocked = true
      } else if (email && !blocked) {
        emailRow.set(email, rowNumber)
      }

      return {
        rowNumber,
        fullName,
        studentId,
        ...(email ? { email } : {}),
        ...(program ? { program } : {}),
        ...(yearLevel !== undefined ? { yearLevel } : {}),
        department,
        ...(providedDepartment ? { submittedDepartment: providedDepartment } : {}),
        issues,
        blocked,
      }
    })
  }

  private changedFields(row: NormalizedStudentRow, existing: ExistingStudent): string[] {
    const changed: string[] = []
    if (row.fullName !== existing.fullName) changed.push('fullName')
    if (row.email !== undefined && (existing.email ?? undefined) !== row.email) changed.push('email')
    if (row.program !== undefined && (existing.program ?? undefined) !== row.program) changed.push('program')
    if (row.yearLevel !== undefined && existing.yearLevel !== row.yearLevel) changed.push('yearLevel')
    // `row.department` is always a string (the scope or 'Unspecified' default),
    // so only an explicitly submitted department may update an existing
    // account. Without this guard a re-import lacking the column would rewrite
    // every matched student's department to 'Unspecified'.
    if (row.submittedDepartment !== undefined && (existing.department ?? undefined) !== row.department) {
      changed.push('department')
    }
    return changed
  }

  private canonicalRow(row: NormalizedStudentRow): Record<string, unknown> {
    // Fingerprint the submitted normalized rows only. Server-side defaults
    // (department scope, missing program/year) are derived, not client input.
    return {
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      studentId: row.studentId,
      ...(row.email ? { email: row.email } : {}),
      ...(row.program ? { program: row.program } : {}),
      ...(row.yearLevel !== undefined ? { yearLevel: row.yearLevel } : {}),
      ...(row.submittedDepartment ? { department: row.submittedDepartment } : {}),
    }
  }

  private computeChecksum(dto: StudentImportRequestDto, user: RequestUser): string {
    return this.checksumFor(this.normalizeRows(dto.rows, user), dto.deliveryMode)
  }

  /**
   * Binds the delivery mode into the fingerprint so an execute cannot silently switch from
   * temporary passwords to emails (or back) after validate. Omitted/temporary requests hash
   * exactly as before.
   */
  private checksumFor(rows: NormalizedStudentRow[], deliveryMode: StudentImportRequestDto['deliveryMode']): string {
    const canonical: Record<string, unknown>[] = rows.map((row) => this.canonicalRow(row))
    if (deliveryMode === 'activation_email') canonical.push({ deliveryMode })
    return computeRowChecksum(canonical)
  }

  private async prepareCredentials(rows: PlannedStudentRow[]): Promise<Map<string, PreparedCredential>> {
    const creating = rows.filter((row) => row.action === 'create')
    const passwords = creating.map((row) => row.row.studentId).map(() => generateTemporaryPassword())
    const hashes = await hashPasswords(passwords)
    const prepared = new Map<string, PreparedCredential>()
    creating.forEach((row, index) => {
      prepared.set(row.row.studentId, { password: passwords[index], passwordHash: hashes[index] })
    })
    return prepared
  }

  private capIssues(rows: PlannedStudentRow[]) {
    const issues = rows
      .flatMap((row) => row.row.issues)
      .sort((left, right) => left.rowNumber - right.rowNumber || left.code.localeCompare(right.code))
    return {
      issues: issues.slice(0, MAX_RETURNED_ISSUES),
      hasMoreIssues: issues.length > MAX_RETURNED_ISSUES,
    }
  }

  private present(
    plan: StudentImportPlan,
    conflictMode: StudentImportRequestDto['conflictMode'],
    mode: StudentImportRequestDto['mode'],
  ): StudentImportResult {
    return {
      mode,
      conflictMode,
      rowChecksum: plan.rowChecksum,
      summary: plan.summary,
      issues: plan.issues,
      hasMoreIssues: plan.hasMoreIssues,
    }
  }

  private recordMetrics(summary: StudentImportSummary) {
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'created', summary.new)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'updated', summary.update)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'skipped', summary.skip)
    this.metrics?.recordImportRows(IMPORT_BATCH_KIND, 'invalid', summary.invalid)
  }

  private async recordImport(
    plan: StudentImportPlan,
    dto: StudentImportRequestDto,
    user: RequestUser,
  ): Promise<string | null> {
    const scope = accountAdminScope(user)
    const issueCodes = [...new Set(plan.rows.flatMap((row) => row.row.issues.map((issue) => issue.code)))]
    const summaryJson = {
      mode: dto.mode,
      conflictMode: dto.conflictMode,
      total: plan.summary.total,
      valid: plan.summary.valid,
      new: plan.summary.new,
      update: plan.summary.update,
      skip: plan.summary.skip,
      invalid: plan.summary.invalid,
      deliveryMode: dto.deliveryMode ?? 'temporary_password',
      issueCodes,
    }

    let batchId: string | null = null
    try {
      const batch = await this.prisma.importBatch.create({
        data: {
          kind: IMPORT_BATCH_KIND,
          actorId: user.id,
          department:
            scope.kind === 'department'
              ? scope.department
              : scope.kind === 'courses' && scope.courses.length === 1
                ? scope.courses[0]
                : null,
          total: plan.summary.total,
          created: plan.summary.new,
          updated: plan.summary.update,
          skipped: plan.summary.skip,
          failed: plan.summary.invalid,
          summary: summaryJson,
          rowChecksum: plan.rowChecksum,
        },
        select: { id: true },
      })
      batchId = batch.id
    } catch (error) {
      // The import has already committed; losing its tracking row must not
      // turn a successful import into an apparent failure.
      this.logger.error(
        `Could not persist import batch for actor ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action: 'bulk_import',
          entityType: 'import_batch',
          entityId: batchId,
          metadata: {
            importSummary: {
              kind: IMPORT_BATCH_KIND,
              total: plan.summary.total,
              created: plan.summary.new,
              updated: plan.summary.update,
              skipped: plan.summary.skip,
              failed: plan.summary.invalid,
              conflictMode: dto.conflictMode,
            },
            issueCodes,
          },
        },
      })
    } catch (error) {
      this.logger.error(
        `Could not write import audit summary for actor ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    await this.pruneOldBatches()
    return batchId
  }

  /** Opportunistic 90-day retention sweep after a successful import. */
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

// Re-exported for tests and future callers that need the exact outcome codes.
export type { ImportIssueCode }
