import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      super.catch(exception, host)
      return
    }
    console.error('Unhandled exception:', exception)
    super.catch(
      new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR),
      host,
    )
  }
}
