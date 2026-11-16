import { Catch, ArgumentsHost, HttpException, HttpStatus, ExceptionFilter, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const responseData = exception.getResponse()
      const responseObject =
        typeof responseData === 'object' && responseData !== null
          ? (responseData as {
              message?: unknown
              code?: unknown
              error?: unknown
              remainingMinutes?: unknown
              remainingSeconds?: unknown
              activeDeviceKind?: unknown
              activeSessionLastActiveAt?: unknown
              distanceMeters?: unknown
              allowedDistanceMeters?: unknown
              canRequestOverride?: unknown
              estimatedEnd?: unknown
              designation?: unknown
            })
          : null

      const message = responseObject && 'message' in responseObject ? responseObject.message : responseData
      response.status(status).json({
        statusCode: status,
        error: exception.name,
        message,
        // Preserve machine-readable markers (password_change_required,
        // device_cooldown_active, import_checksum_mismatch, idempotency codes,
        // ...) that clients branch on instead of matching human-readable
        // messages. remainingMinutes travels with device cooldown rejections so
        // clients can render an accurate countdown without re-deriving clocks.
        ...(responseObject && typeof responseObject.code === 'string' ? { code: responseObject.code } : {}),
        ...(responseObject && typeof responseObject.remainingMinutes === 'number'
          ? { remainingMinutes: responseObject.remainingMinutes }
          : {}),
        ...(responseObject && typeof responseObject.remainingSeconds === 'number'
          ? { remainingSeconds: responseObject.remainingSeconds }
          : {}),
        // Active-session rejections identify the device that holds the login
        // (null for legacy rows) and when it was last active so clients can
        // render the explainer without guessing.
        ...(responseObject &&
        (responseObject.activeDeviceKind === null || typeof responseObject.activeDeviceKind === 'string')
          ? { activeDeviceKind: responseObject.activeDeviceKind }
          : {}),
        ...(responseObject && typeof responseObject.activeSessionLastActiveAt === 'string'
          ? { activeSessionLastActiveAt: responseObject.activeSessionLastActiveAt }
          : {}),
        // Teacher activation geofence rejections carry measured distances so
        // the override dialog can state them without re-deriving the math.
        ...(responseObject && typeof responseObject.distanceMeters === 'number'
          ? { distanceMeters: responseObject.distanceMeters }
          : {}),
        ...(responseObject && typeof responseObject.allowedDistanceMeters === 'number'
          ? { allowedDistanceMeters: responseObject.allowedDistanceMeters }
          : {}),
        ...(responseObject && typeof responseObject.canRequestOverride === 'boolean'
          ? { canRequestOverride: responseObject.canRequestOverride }
          : {}),
        // Maintenance 503s carry the announced resumption estimate; suite 403s
        // carry the missing designation so clients can explain the denial.
        ...(responseObject && typeof responseObject.estimatedEnd === 'string'
          ? { estimatedEnd: responseObject.estimatedEnd }
          : {}),
        ...(responseObject && typeof responseObject.designation === 'string'
          ? { designation: responseObject.designation }
          : {}),
        path: request.originalUrl,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const possibleStatus =
      typeof exception === 'object' && exception !== null && 'status' in exception
        ? Number((exception as { status?: unknown }).status)
        : NaN
    if (possibleStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: 'Request payload is too large',
        path: request.originalUrl,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (isDatabaseCapacityError(exception)) {
      // Resource exhaustion is retryable, not a server fault. Students' clients
      // (and the offline sync classifier) treat 5xx as "try again later", while a
      // 500 pollutes error budgets and looks like a bug. The stack is logged so
      // the saturation is still diagnosable.
      this.logger.error(
        'Database capacity exhausted',
        exception instanceof Error ? exception.stack : String(exception),
      )
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .header('retry-after', String(DATABASE_BUSY_RETRY_AFTER_SECONDS))
        .json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'The service is temporarily at capacity. Please retry shortly.',
          code: 'database_busy',
          retryAfterSeconds: DATABASE_BUSY_RETRY_AFTER_SECONDS,
          path: request.originalUrl,
          timestamp: new Date().toISOString(),
        })
      return
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception))
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    })
  }
}

/** Peer connection cap of the Postgres pool (see `prisma/client.ts`). */
const DATABASE_BUSY_RETRY_AFTER_SECONDS = 5

/**
 * True for the connection-pool exhaustion shapes `pg`/`@prisma/adapter-pg`
 * throw when every pooled connection is busy or dies mid-acquire:
 *   - `timeout exceeded when trying to connect` (pg-pool acquire timeout)
 *   - `Connection terminated due to connection timeout`
 *   - Prisma's `P2024` (pool timeout) when the engine surfaces it instead
 *
 * Only these capacity signals map to 503. A plain `connection refused` or
 * `terminated unexpectedly` is a real outage and stays a 500 so it alerts.
 */
const DATABASE_CAPACITY_PATTERNS = [
  /timeout exceeded when trying to connect/i,
  /connection terminated due to connection timeout/i,
  /pool timeout/i,
]

function isDatabaseCapacityError(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false
  const candidate = exception as { code?: unknown; message?: unknown }
  if (candidate.code === 'P2024') return true
  return typeof candidate.message === 'string' && DATABASE_CAPACITY_PATTERNS.some((pattern) => pattern.test(candidate.message as string))
}
