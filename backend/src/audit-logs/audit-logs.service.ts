import { BadRequestException, Injectable } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { adminUserWhere } from '../common/admin-scope'
import { parseIsoDate } from '../common/utils/iso-date'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditLogQueryDto } from './audit-logs.controller'

const MAX_AUDIT_RANGE_DAYS = 366

type AuditMetadata = {
  outcome?: string
  ip?: string
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser, query: AuditLogQueryDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 25
    const where = await this.buildWhere(user, query)
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    const actorIds = [...new Set(items.map((item) => item.actorId))]
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true },
    })
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.fullName]))

    return {
      items: items.map((item) => {
        const metadata = this.metadata(item.metadata)
        const outcome = ['initiated', 'succeeded', 'failed'].includes(metadata.outcome ?? '')
          ? metadata.outcome
          : 'initiated'
        return {
          id: item.id,
          actorId: item.actorId,
          actorName: actorNames.get(item.actorId) ?? 'Unknown account',
          actorRole: item.actorRole,
          action: item.action,
          entityType: item.entityType,
          entityId: item.entityId ?? undefined,
          outcome,
          ipAddress: metadata.ip,
          createdAt: item.createdAt.toISOString(),
        }
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  private async buildWhere(user: RequestUser, query: AuditLogQueryDto): Promise<Prisma.AuditLogWhereInput> {
    const createdAt = this.dateRange(query.startDate, query.endDate)
    const accessibleUsers = adminUserWhere(user)
    const scopedActors = accessibleUsers
      ? await this.prisma.user.findMany({ where: accessibleUsers, select: { id: true } })
      : null
    const search = query.search?.trim()
    const matchingActors = search
      ? await this.prisma.user.findMany({
          where: {
            ...(accessibleUsers ?? {}),
            fullName: { contains: search, mode: 'insensitive' },
          },
          select: { id: true },
        })
      : []

    return {
      ...(scopedActors ? { actorId: { in: scopedActors.map((actor) => actor.id) } } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(query.action ? { action: { contains: query.action.trim(), mode: 'insensitive' } } : {}),
      ...(query.outcome ? { metadata: { path: ['outcome'], equals: query.outcome } } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              { actorId: { in: matchingActors.map((actor) => actor.id) } },
            ],
          }
        : {}),
    }
  }

  private dateRange(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
    if (!startDate && !endDate) return undefined
    const start = startDate ? parseIsoDate(startDate) : undefined
    const end = endDate ? parseIsoDate(endDate) : undefined
    if ((startDate && !start) || (endDate && !end)) {
      throw new BadRequestException('Dates must use a real YYYY-MM-DD calendar date')
    }
    if (start && end && end < start) throw new BadRequestException('endDate must be on or after startDate')
    if (start && end && end.getTime() - start.getTime() > MAX_AUDIT_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`Audit date ranges are limited to ${MAX_AUDIT_RANGE_DAYS} days`)
    }
    const exclusiveEnd = end ? new Date(end) : undefined
    exclusiveEnd?.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    return {
      ...(start ? { gte: start } : {}),
      ...(exclusiveEnd ? { lt: exclusiveEnd } : {}),
    }
  }

  private metadata(value: Prisma.JsonValue | null): AuditMetadata {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {}
    return value as AuditMetadata
  }
}
