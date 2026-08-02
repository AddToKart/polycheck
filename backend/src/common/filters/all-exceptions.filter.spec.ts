import type { ArgumentsHost } from '@nestjs/common'
import { BadRequestException, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AllExceptionsFilter } from './all-exceptions.filter'

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let response: { status: jest.Mock; json: jest.Mock }
  let loggerErrorSpy: jest.SpyInstance

  const makeHost = (originalUrl = '/api/attendance/sessions'): ArgumentsHost => {
    const request = { originalUrl } as unknown as Request
    const res = response as unknown as Response
    return {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => res }),
    } as never
  }

  beforeEach(() => {
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    filter = new AllExceptionsFilter()
  })

  afterEach(() => jest.restoreAllMocks())

  it('formats HttpExceptions with status, error, message, path, and timestamp', () => {
    const exception = new BadRequestException(['username must be a string', 'password is too short'])

    filter.catch(exception, makeHost('/auth/login/student'))

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BadRequestException',
      message: ['username must be a string', 'password is too short'],
      path: '/auth/login/student',
      timestamp: expect.any(String),
    })
  })

  it('returns a 413 Payload Too Large response for status-marked payloads', () => {
    filter.catch({ status: 413 }, makeHost())

    expect(response.status).toHaveBeenCalledWith(413)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Request payload is too large',
      path: expect.any(String),
      timestamp: expect.any(String),
    })
  })

  it('returns a 500 response and logs the stack for unknown errors', () => {
    const error = new Error('boom')

    filter.catch(error, makeHost())

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: expect.any(String),
      timestamp: expect.any(String),
    })
    expect(loggerErrorSpy).toHaveBeenCalledWith('Unhandled exception', error.stack)
  })

  it('returns a 500 response without crashing on non-Error exceptions', () => {
    filter.catch('something went wrong', makeHost())

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: expect.any(String),
      timestamp: expect.any(String),
    })
    expect(loggerErrorSpy).toHaveBeenCalledWith('Unhandled exception', 'something went wrong')
  })
})
