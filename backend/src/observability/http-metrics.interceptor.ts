import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import { catchError, finalize, throwError } from 'rxjs'
import { MetricsService } from './metrics.service'

const HTTP_METHODS = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'])

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle()

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const method = HTTP_METHODS.has(request.method) ? request.method : 'OTHER'
    const route = this.routeTemplate(request)
    const startedAt = process.hrtime.bigint()
    let errorStatus: number | undefined

    this.metrics.httpInFlight.inc({ method, route })
    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatus = error instanceof HttpException ? error.getStatus() : 500
        return throwError(() => error)
      }),
      finalize(() => {
        const statusCode = String(errorStatus ?? response.statusCode)
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
        const labels = { method, route, status_code: statusCode }
        this.metrics.httpInFlight.dec({ method, route })
        this.metrics.httpRequests.inc(labels)
        this.metrics.httpDuration.observe(labels, durationSeconds)
      }),
    )
  }

  private routeTemplate(request: Request) {
    const path = request.route?.path as unknown
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200) return 'unmatched'
    return path
  }
}
