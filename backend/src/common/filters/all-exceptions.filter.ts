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
