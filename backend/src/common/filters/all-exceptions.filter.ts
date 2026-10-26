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
          ? (responseData as { message?: unknown; code?: unknown; error?: unknown })
          : null

      const message = responseObject && 'message' in responseObject ? responseObject.message : responseData
      response.status(status).json({
        statusCode: status,
        error: exception.name,
        message,
        // Preserve machine-readable markers (password_change_required,
        // import_checksum_mismatch, idempotency codes, ...) that clients
        // branch on instead of matching human-readable messages.
        ...(responseObject && typeof responseObject.code === 'string' ? { code: responseObject.code } : {}),
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
