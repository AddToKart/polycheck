import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { concatMap } from 'rxjs/operators'
import { from, type Observable } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import type { RequestUser } from '../../auth/authenticated-principal'

type AuditedRequest = Request & { user?: RequestUser }

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name)

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const request = context.switchToHttp().getRequest<AuditedRequest>()
    if (!request.user || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next.handle()

    return next.handle().pipe(concatMap((value) => from(this.persistAudit(request, value))))
  }

  private async persistAudit(request: AuditedRequest, responseValue: unknown) {
    const path = request.route?.path ? `${request.baseUrl}${request.route.path}` : request.path
    const segments = request.path.split('/').filter(Boolean)
    const entityId = request.params?.id ?? request.params?.sessionId
    const responseId =
      responseValue && typeof responseValue === 'object' && 'id' in responseValue ? String(responseValue.id) : undefined

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: request.user!.id,
          actorRole: request.user!.role,
          action: `${request.method} ${path}`,
          entityType: segments[1] ?? segments[0] ?? 'unknown',
          entityId: (Array.isArray(entityId) ? entityId[0] : entityId) ?? responseId,
          metadata: {
            path: request.path,
            ip: request.ip,
            userAgent: request.get?.('user-agent')?.slice(0, 300),
          },
        },
      })
    } catch (error) {
      this.logger.error(`Failed to persist audit event: ${error instanceof Error ? error.message : String(error)}`)
    }
    return responseValue
  }
}
