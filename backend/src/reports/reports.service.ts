import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { RequestUser } from '../auth/authenticated-principal'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import type { CreateSystemReportDto, SystemReportQueryDto, UpdateSystemReportStatusDto } from './dto/report.dto'
import { decodeImageDataUrl } from '../proofs/image-evidence'
import { ProofStorageService } from '../proofs/proof-storage.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { SystemReport, SystemReportStats } from '@polycheck/shared'
import type { Prisma } from '../prisma/client'
import { paginate, parsePagination, type PaginatedResult, type PaginationParams } from '../common/utils/pagination'
import { parseIsoDate } from '../common/utils/iso-date'
import { ErrorCode } from '../common/constants/error-codes'

const REPORT_LIST_LIMIT = 100

// Submissions are rate limited per account (default 5/hour) so a frustrated
// classroom cannot flood the triage stream; admin triage updates are likewise
// bounded. Both are env-tunable for local development and E2E automation.
const REPORT_CREATE_RATE_LIMIT = positiveInt(process.env.REPORT_CREATE_RATE_LIMIT, 5)
const REPORT_CREATE_RATE_WINDOW_SECONDS = positiveInt(process.env.REPORT_CREATE_RATE_WINDOW_SECONDS, 3600)
const REPORT_ADMIN_UPDATE_RATE_LIMIT = positiveInt(process.env.REPORT_ADMIN_UPDATE_RATE_LIMIT, 30)
const REPORT_ADMIN_UPDATE_RATE_WINDOW_SECONDS = positiveInt(process.env.REPORT_ADMIN_UPDATE_RATE_WINDOW_SECONDS, 3600)

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const REPORT_USER_SELECT = {
  id: true,
  fullName: true,
  role: true,
  studentId: true,
  email: true,
  department: true,
} satisfies Prisma.UserSelect

type ReportRow = Prisma.SystemReportGetPayload<{
  include: { user: { select: typeof REPORT_USER_SELECT } }
}>

interface ReportAccessUser extends RequestUser {
  scope?: string | null
}

/**
 * Structured issue intake for classroom workers. Students and teachers file
 * bug reports / feedback with auto-collected diagnostics; super admins triage,
 * annotate, and resolve. Every status change is audited, and the submitter is
 * notified when their report is resolved.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: ProofStorageService,
    private readonly config: ConfigService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async create(actor: RequestUser, dto: CreateSystemReportDto): Promise<SystemReport> {
    if (actor.role !== 'student' && actor.role !== 'teacher') {
      throw new ForbiddenException('Only students and teachers can submit system reports')
    }
    const withinLimit = await this.redis.consumeRateLimit(
      `reports:create:${actor.id}`,
      REPORT_CREATE_RATE_LIMIT,
      REPORT_CREATE_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many reports submitted. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    let screenshotReference: string | null = null
    if (dto.screenshotData) {
      try {
        const image = this.decodeScreenshot(dto.screenshotData)
        screenshotReference = await this.storage.store(image.buffer, image.extension, image.mime)
      } catch (error) {
        // Attachment storage must never block the report itself; exactly like
        // audits this fails open and the reason is observable in the logs.
        screenshotReference = null
        this.logger.warn(
          `Could not store report screenshot for user ${actor.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    const created = await this.prisma.systemReport.create({
      data: {
        userId: actor.id,
        userRole: actor.role,
        category: dto.category,
        severity: dto.severity ?? 'medium',
        title: dto.title.trim(),
        description: dto.description.trim(),
        deviceInfo: dto.deviceInfo?.trim() || null,
        appVersion: dto.appVersion?.trim() || null,
        route: dto.route?.trim() || null,
        networkType: dto.networkType?.trim() || null,
        ...(screenshotReference ? { screenshotUrl: screenshotReference } : {}),
      },
      include: { user: { select: REPORT_USER_SELECT } },
    })
    return this.present(created)
  }

  /** The submitter's own stream (latest first, bounded). */
  async myReports(actor: RequestUser): Promise<SystemReport[]> {
    if (actor.role !== 'student' && actor.role !== 'teacher') {
      throw new ForbiddenException('Only students and teachers submit system reports')
    }
    const rows = await this.prisma.systemReport.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: REPORT_LIST_LIMIT,
      include: { user: { select: REPORT_USER_SELECT } },
    })
    return rows.map((row) => this.present(row))
  }

  async stats(actor: ReportAccessUser): Promise<SystemReportStats> {
    this.assertSuperAdmin(actor)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const [total, statusRows, scannerAndGps, resolvedThisMonth, critical] = await Promise.all([
      this.prisma.systemReport.count(),
      this.prisma.systemReport.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.systemReport.count({ where: { category: { in: ['scanner_camera', 'geofence_gps'] } } }),
      this.prisma.systemReport.count({ where: { resolvedAt: { gte: monthStart } } }),
      this.prisma.systemReport.count({ where: { severity: 'critical' } }),
    ])
    const byStatus = new Map(statusRows.map((row) => [row.status, row._count._all]))
    const statusCount = (status: 'open' | 'in_review' | 'resolved' | 'dismissed') => byStatus.get(status) ?? 0
    return {
      total,
      open: statusCount('open'),
      inReview: statusCount('in_review'),
      resolved: statusCount('resolved'),
      dismissed: statusCount('dismissed'),
      scannerAndGps,
      resolvedThisMonth,
      critical,
    }
  }

  async list(actor: ReportAccessUser, query: SystemReportQueryDto, pagination?: PaginationParams) {
    this.assertSuperAdmin(actor)
    const params = pagination ?? parsePagination(query.limit, query.offset)
    const where = this.buildWhere(query)
    const [rows, total] = await Promise.all([
      this.prisma.systemReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
        include: { user: { select: REPORT_USER_SELECT } },
      }),
      this.prisma.systemReport.count({ where }),
    ])
    const result = paginate(rows, total, params)
    return { ...result, data: result.data.map((row) => this.present(row)) } satisfies PaginatedResult<SystemReport>
  }

  async findOne(actor: ReportAccessUser, id: string): Promise<SystemReport> {
    this.assertSuperAdmin(actor)
    const row = await this.prisma.systemReport.findUnique({
      where: { id },
      include: { user: { select: REPORT_USER_SELECT } },
    })
    if (!row) throw new NotFoundException('Report not found')
    return this.present(row)
  }

  /** Streams the stored screenshot. The submitter and super admins may read it. */
  async screenshot(actor: RequestUser, id: string) {
    const row = await this.prisma.systemReport.findUnique({
      where: { id },
      select: { userId: true, screenshotUrl: true },
    })
    if (!row || !row.screenshotUrl) throw new NotFoundException('Screenshot not found')
    if (actor.role !== 'super_admin' && actor.id !== row.userId) {
      throw new ForbiddenException('You can only access your own report attachments')
    }
    return this.storage.read(row.screenshotUrl)
  }

  async updateStatus(
    actor: ReportAccessUser,
    id: string,
    dto: UpdateSystemReportStatusDto,
    ipAddress?: string,
  ): Promise<SystemReport> {
    this.assertSuperAdmin(actor)
    // Department chairs retain read-only oversight: triage belongs to
    // institution-scope administrators.
    if (actor.scope !== 'institution') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ErrorCode.FORBIDDEN,
        message: 'Department administrators have read-only access to system reports',
      })
    }
    const withinLimit = await this.redis.consumeRateLimit(
      `reports:triage:${actor.id}`,
      REPORT_ADMIN_UPDATE_RATE_LIMIT,
      REPORT_ADMIN_UPDATE_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many triage updates. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const now = new Date()
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.systemReport.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('Report not found')
      const becameResolved = dto.status === 'resolved' && existing.status !== 'resolved'
      const updated = await tx.systemReport.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes.trim() || null } : {}),
          ...(becameResolved ? { resolvedAt: now, resolvedBy: actor.id } : {}),
          ...(existing.status === 'resolved' && dto.status !== 'resolved'
            ? { resolvedAt: null, resolvedBy: null }
            : {}),
        },
        include: { user: { select: REPORT_USER_SELECT } },
      })
      return { existing, updated }
    })

    await this.recordStatusAudit(actor, result.existing, result.updated, ipAddress)
    if (result.updated.status === 'resolved' && result.existing.status !== 'resolved') {
      await this.notifications?.notify(result.updated.userId, {
        type: 'system_report_resolved',
        title: 'Your report was resolved',
        body: `"${result.updated.title}" — thanks for helping improve Polycheck.`,
        link: '/profile',
      })
    }
    return this.present(result.updated)
  }

  // ── internals ──

  private buildWhere(query: SystemReportQueryDto): Prisma.SystemReportWhereInput {
    const and: Prisma.SystemReportWhereInput[] = []
    if (query.category) and.push({ category: query.category })
    if (query.severity) and.push({ severity: query.severity })
    if (query.status) and.push({ status: query.status })
    if (query.role) and.push({ userRole: query.role })
    const search = query.search?.trim()
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    const createdAt = this.dateRange(query.startDate, query.endDate)
    if (createdAt) and.push({ createdAt })

    return and.length > 0 ? { AND: and } : {}
  }

  private dateRange(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
    if (!startDate && !endDate) return undefined
    const start = startDate ? parseIsoDate(startDate) : undefined
    const end = endDate ? parseIsoDate(endDate) : undefined
    if ((startDate && !start) || (endDate && !end)) {
      throw new BadRequestException('Dates must use a real YYYY-MM-DD calendar date')
    }
    if (start && end && end < start) {
      throw new BadRequestException('endDate must be on or after startDate')
    }
    const exclusiveEnd = end ? new Date(end) : undefined
    exclusiveEnd?.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    return {
      ...(start ? { gte: start } : {}),
      ...(exclusiveEnd ? { lt: exclusiveEnd } : {}),
    }
  }

  private decodeScreenshot(value: string) {
    const maxBytes = this.config.get<number>('REPORT_MAX_BYTES') ?? 5_000_000
    return decodeImageDataUrl(value, maxBytes, 'Screenshot')
  }

  private present(row: ReportRow): SystemReport {
    return {
      id: row.id,
      category: row.category,
      severity: row.severity,
      title: row.title,
      description: row.description,
      status: row.status,
      deviceInfo: row.deviceInfo,
      appVersion: row.appVersion,
      route: row.route,
      networkType: row.networkType,
      screenshotUrl: row.screenshotUrl ? `/api/reports/${row.id}/screenshot` : null,
      adminNotes: row.adminNotes,
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      resolvedBy: row.resolvedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: {
        id: row.user.id,
        fullName: row.user.fullName,
        role: row.user.role,
        studentId: row.user.studentId,
        email: row.user.email,
        department: row.user.department,
      },
    }
  }

  private assertSuperAdmin(actor: ReportAccessUser) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can review system reports')
    }
  }

  /** Best-effort audit row; triage must stay available if the audit insert fails. */
  private async recordStatusAudit(
    actor: ReportAccessUser,
    existing: { status: string; title: string; category: string },
    updated: ReportRow,
    ipAddress?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'admin.report.status_changed',
          entityType: 'system_report',
          entityId: updated.id,
          metadata: {
            from: existing.status,
            to: updated.status,
            title: existing.title,
            category: existing.category,
            severity: updated.severity,
            noteUpdated: updated.adminNotes !== null,
            ipAddress: ipAddress ?? null,
          },
        },
      })
    } catch (error) {
      this.logger.error(
        `Could not write admin.report.status_changed audit row for actor ${actor.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
