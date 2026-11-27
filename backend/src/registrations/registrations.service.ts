import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hash } from '@node-rs/bcrypt'
import { createHash, randomUUID } from 'node:crypto'
import { CAMPUS_COURSES, campusCourseByCode } from '@polycheck/shared'
import type {
  RegistrationApprovalResult,
  RegistrationIssue,
  RegistrationList,
  RegistrationOpenStatus,
  RegistrationStatus,
} from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { SettingsService } from '../settings/settings.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { PASSWORD_HASH_COST, isStrongPassword } from '../auth/password-policy'
import { Prisma, type RegistrationRequest } from '../prisma/client'
import type { RegistrationSubmitDto } from './dto/registration.dto'

const HOUR = 3600
// A whole class may sign up from one school Wi-Fi address, so the per-address
// limit is generous; the per-person limit is the tight one.
export const PER_ADDRESS_PER_HOUR = 400
export const PER_PERSON_PER_HOUR = 5
export const ALL_PER_HOUR = 900
export const MAX_WAITING = 1000
const MAX_WAITING_PER_PERSON = 3
const STUDENT_ID = /^\d{4}-\d{5}-[A-Z]{2}-\d$/
const TAKEN = 'An account with this student number or email already exists'

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  async status(): Promise<RegistrationOpenStatus> {
    return {
      open: await this.isOpen(),
      programs: CAMPUS_COURSES.map(({ code, name }) => ({ code, name })),
    }
  }

  /**
   * Stores a request. The reply never says whether the student number or email
   * already has an account; the reviewer sees that instead.
   */
  async submit(dto: RegistrationSubmitDto, ip: string | undefined): Promise<{ received: true }> {
    if (!(await this.isOpen())) {
      throw new ForbiddenException({ message: 'Sign-up is closed.', code: 'registration_closed' })
    }
    if (dto.website?.trim()) return { received: true }
    await this.limit(`register:ip:${ip ?? 'unknown'}`, PER_ADDRESS_PER_HOUR)

    const fullName = dto.fullName.trim().replace(/\s+/g, ' ')
    if (fullName.length < 2) throw new BadRequestException('Enter your full name')
    if (!dto.consent) throw new BadRequestException('You need to accept the Privacy Policy to sign up')
    if (!isStrongPassword(dto.password)) {
      throw new BadRequestException(
        'Use at least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol',
      )
    }
    const email = dto.email.trim().toLowerCase()
    const student = dto.role === 'student' ? this.studentFields(dto) : null
    const identity = student?.studentId ?? email
    // Hashed so the rate-limit key holds no personal data.
    await this.limit(`register:person:${createHash('sha256').update(identity).digest('hex')}`, PER_PERSON_PER_HOUR)
    await this.limit('register:all', ALL_PER_HOUR)

    if ((await this.prisma.registrationRequest.count({ where: { status: 'pending' } })) >= MAX_WAITING) {
      throw new HttpException('Sign-up is full for now. Please try again later.', HttpStatus.SERVICE_UNAVAILABLE)
    }
    const waiting = await this.prisma.registrationRequest.count({
      where: {
        status: 'pending',
        role: dto.role,
        OR: [{ email }, ...(student ? [{ studentId: student.studentId }] : [])],
      },
    })
    if (waiting >= MAX_WAITING_PER_PERSON) return { received: true }

    await this.prisma.registrationRequest.create({
      data: {
        role: dto.role,
        fullName,
        email,
        studentId: student?.studentId ?? null,
        program: student?.program ?? null,
        yearLevel: student?.yearLevel ?? null,
        passwordHash: await hash(dto.password, { cost: PASSWORD_HASH_COST }),
        consentVersion: this.config.getOrThrow<string>('PRIVACY_NOTICE_VERSION'),
      },
    })
    return { received: true }
  }

  async list(actor: RequestUser, status: RegistrationStatus): Promise<RegistrationList> {
    this.assertReviewer(actor)
    const [requests, pendingCount, open] = await Promise.all([
      this.prisma.registrationRequest.findMany({
        where: { status },
        orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
        take: MAX_WAITING,
      }),
      this.prisma.registrationRequest.count({ where: { status: 'pending' } }),
      this.isOpen(),
    ])
    const issues = status === 'pending' ? await this.issuesFor(requests) : new Map<string, RegistrationIssue[]>()
    return {
      open,
      pendingCount,
      items: requests.map((request) => ({
        id: request.id,
        role: request.role as 'student' | 'teacher',
        fullName: request.fullName,
        email: request.email,
        ...(request.studentId ? { studentId: request.studentId } : {}),
        ...(request.program ? { program: request.program } : {}),
        ...(request.yearLevel ? { yearLevel: request.yearLevel } : {}),
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        ...(request.reviewedAt ? { reviewedAt: request.reviewedAt.toISOString() } : {}),
        issues: issues.get(request.id) ?? [],
      })),
    }
  }

  /** Creates the accounts. Each request succeeds or fails on its own. */
  async approve(actor: RequestUser, ids: string[]): Promise<RegistrationApprovalResult> {
    this.assertReviewer(actor)
    const requests = await this.prisma.registrationRequest.findMany({
      where: { id: { in: [...new Set(ids)] }, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
    // A teacher account can see student records, so each one is a separate decision.
    if (requests.length > 1 && requests.some((request) => request.role === 'teacher')) {
      throw new BadRequestException('Approve teachers one at a time')
    }
    const result: RegistrationApprovalResult = { approved: 0, failed: [] }
    for (const request of requests) {
      try {
        const userId = await this.createAccount(actor, request)
        result.approved += 1
        await this.audit(actor, 'admin.registration.approved', userId, { role: request.role })
      } catch (error) {
        const known = error instanceof AccountTaken || isUniqueConflict(error)
        if (!known) {
          this.logger.error(
            `Could not approve registration ${request.id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        result.failed.push({
          id: request.id,
          fullName: request.fullName,
          reason: known ? TAKEN : 'The account could not be created. Try again.',
        })
      }
    }
    return result
  }

  /** A rejected request is deleted: there is no reason to keep its details. */
  async reject(actor: RequestUser, ids: string[]): Promise<{ rejected: number }> {
    this.assertReviewer(actor)
    const { count } = await this.prisma.registrationRequest.deleteMany({
      where: { id: { in: ids }, status: 'pending' },
    })
    if (count) await this.audit(actor, 'admin.registration.rejected', null, { count })
    return { rejected: count }
  }

  private async createAccount(actor: RequestUser, request: RegistrationRequest) {
    const { passwordHash } = request
    if (!passwordHash) throw new Error('The request no longer holds a password')
    const id = randomUUID()
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      // Claim first, so two reviewers cannot both create the account.
      const claim = await tx.registrationRequest.updateMany({
        where: { id: request.id, status: 'pending' },
        data: { status: 'approved', passwordHash: null, reviewedAt: now, reviewedBy: actor.id, createdUserId: id },
      })
      if (claim.count !== 1) throw new Error('The request was already decided')
      const existing = await tx.user.findFirst({
        where: {
          OR: [{ email: request.email }, ...(request.studentId ? [{ studentId: request.studentId }] : [])],
        },
        select: { id: true },
      })
      if (existing) throw new AccountTaken()
      await tx.user.create({
        data: {
          id,
          role: request.role,
          fullName: request.fullName,
          email: request.email,
          authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
          password: passwordHash,
          ...(request.role === 'student'
            ? {
                studentId: request.studentId,
                program: request.program,
                yearLevel: request.yearLevel,
                // The campus has no departments; the column mirrors the program.
                department: request.program,
              }
            : {}),
          authAccounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: 'credential',
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        select: { id: true },
      })
    })
    return id
  }

  private async issuesFor(requests: RegistrationRequest[]) {
    const emails = requests.map((request) => request.email)
    const studentIds = requests.flatMap((request) => (request.studentId ? [request.studentId] : []))
    const accounts = await this.prisma.user.findMany({
      where: { OR: [{ email: { in: emails } }, { studentId: { in: studentIds } }] },
      select: { email: true, studentId: true },
    })
    const taken = new Set(accounts.flatMap((account) => [account.email, account.studentId]).filter(Boolean))
    const seen = new Map<string, number>()
    const keys = (request: RegistrationRequest) => [request.email, ...(request.studentId ? [request.studentId] : [])]
    for (const request of requests) for (const key of keys(request)) seen.set(key, (seen.get(key) ?? 0) + 1)
    return new Map(
      requests.map((request) => {
        const issues: RegistrationIssue[] = []
        if (keys(request).some((key) => taken.has(key))) issues.push('account_exists')
        if (keys(request).some((key) => (seen.get(key) ?? 0) > 1)) issues.push('duplicate_request')
        return [request.id, issues]
      }),
    )
  }

  private studentFields(dto: RegistrationSubmitDto) {
    const studentId = dto.studentId?.trim().toUpperCase() ?? ''
    if (!STUDENT_ID.test(studentId)) {
      throw new BadRequestException('Enter your student number like 2024-00001-MN-0')
    }
    const program = campusCourseByCode(dto.program ?? '')?.code
    if (!program) throw new BadRequestException('Choose your program')
    if (!dto.yearLevel) throw new BadRequestException('Choose your year level')
    return { studentId, program, yearLevel: dto.yearLevel }
  }

  private isOpen() {
    return this.settings.getBoolean('registration_enabled', false)
  }

  private async limit(key: string, limit: number) {
    if (!(await this.redis.consumeRateLimit(key, limit, HOUR))) {
      throw new HttpException('Too many sign-up attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  private assertReviewer(actor: RequestUser) {
    if (actor.role !== 'super_admin' || actor.scope !== 'institution') {
      throw new ForbiddenException('Only institution administrators can review sign-up requests')
    }
  }

  private async audit(actor: RequestUser, action: string, entityId: string | null, metadata: Prisma.InputJsonObject) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: actor.id, actorRole: actor.role, action, entityType: 'registration', entityId, metadata },
      })
    } catch (error) {
      this.logger.error(`Could not audit ${action}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

class AccountTaken extends Error {}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
