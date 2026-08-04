import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { catchError, concatMap, switchMap } from 'rxjs/operators'
import { from, throwError, type Observable } from 'rxjs'
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

    return from(this.beginAudit(request)).pipe(
      switchMap((auditId) =>
        next.handle().pipe(
          concatMap((value) => from(this.completeAudit(auditId, request, value))),
          catchError((error: unknown) =>
            from(this.failAudit(auditId, error)).pipe(
              switchMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
    )
  }

  private auditContext(request: AuditedRequest) {
    const path = request.route?.path ? `${request.baseUrl}${request.route.path}` : request.path
    const segments = request.path.split('/').filter(Boolean)
    const entityId = request.params?.id ?? request.params?.sessionId
    return {
      path,
      entityType: segments[1] ?? segments[0] ?? 'unknown',
      entityId: Array.isArray(entityId) ? entityId[0] : entityId,
      metadata: {
        path: request.path,
        ip: request.ip,
        userAgent: request.get?.('user-agent')?.slice(0, 300),
      },
    }
  }

  private async beginAudit(request: AuditedRequest) {
    const context = this.auditContext(request)
    const audit = await this.prisma.auditLog.create({
      data: {
        actorId: request.user!.id,
        actorRole: request.user!.role,
        action: `${request.method} ${context.path}`,
        entityType: context.entityType,
        entityId: context.entityId,
        metadata: { ...context.metadata, outcome: 'initiated' },
      },
      select: { id: true },
    })
    return audit.id
  }

  private async completeAudit(auditId: string, request: AuditedRequest, responseValue: unknown) {
    const context = this.auditContext(request)
    const responseId =
      responseValue && typeof responseValue === 'object' && 'id' in responseValue ? String(responseValue.id) : undefined
    try {
      await this.prisma.auditLog.update({
        where: { id: auditId },
        data: {
          entityId: context.entityId ?? responseId,
          metadata: { ...context.metadata, outcome: 'succeeded' },
        },
      })
    } catch (error) {
      this.logger.error(`Audit ${auditId} remains initiated: ${error instanceof Error ? error.message : String(error)}`)
    }
    return responseValue
  }

  private async failAudit(auditId: string, error: unknown) {
    try {
      await this.prisma.auditLog.update({
        where: { id: auditId },
        data: { metadata: { outcome: 'failed', errorType: error instanceof Error ? error.name : 'UnknownError' } },
      })
    } catch (auditError) {
      this.logger.error(
        `Audit ${auditId} could not be marked failed: ${
          auditError instanceof Error ? auditError.message : String(auditError)
        }`,
      )
    }
  }
}
