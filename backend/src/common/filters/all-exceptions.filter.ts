import { Catch, ArgumentsHost, HttpException, HttpStatus, ExceptionFilter } from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const responseData = exception.getResponse()
      
      if (typeof responseData === 'object' && responseData !== null) {
        response.status(status).json(responseData)
      } else {
        response.status(status).json({
          statusCode: status,
          message: responseData,
        })
      }
      return
    }

    console.error('Unhandled exception:', exception)
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    })
  }
}
