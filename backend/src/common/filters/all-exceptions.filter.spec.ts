import type { ArgumentsHost } from '@nestjs/common'
import { BadRequestException, ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AllExceptionsFilter } from './all-exceptions.filter'

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let response: { status: jest.Mock; json: jest.Mock; header: jest.Mock }
  let loggerErrorSpy: jest.SpyInstance

  const makeHost = (originalUrl = '/api/attendance/sessions'): ArgumentsHost => {
    const request = { originalUrl } as unknown as Request
    const res = response as unknown as Response
    return {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => res }),
    } as never
  }

  beforeEach(() => {
    response = { status: jest.fn().mockReturnThis(), json: jest.fn(), header: jest.fn().mockReturnThis() }
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

  it('preserves machine-readable error codes from exception responses', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'import_checksum_mismatch',
      message: 'Run validation again',
    })

    filter.catch(exception, makeHost('/users/students/import'))

    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BadRequestException',
      message: 'Run validation again',
      code: 'import_checksum_mismatch',
      path: '/users/students/import',
      timestamp: expect.any(String),
    })
  })

  it('preserves remainingMinutes alongside a device-cooldown code', () => {
    const exception = new BadRequestException({
      statusCode: 403,
      error: 'Forbidden',
      code: 'device_cooldown_active',
      remainingMinutes: 42,
      message: 'Device change cooldown is active',
    })

    filter.catch(exception, makeHost('/auth/mobile/login/student'))

    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BadRequestException',
      message: 'Device change cooldown is active',
      code: 'device_cooldown_active',
      remainingMinutes: 42,
      path: '/auth/mobile/login/student',
      timestamp: expect.any(String),
    })
  })

  it('preserves the exact countdown and the blocking-device hint on login gates', () => {
    const cooldown = new ForbiddenException({
      code: 'device_cooldown_active',
      remainingMinutes: 42,
      remainingSeconds: 2513,
      message: 'Device change cooldown is active',
    })
    filter.catch(cooldown, makeHost('/auth/mobile/login/student'))
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'ForbiddenException',
      message: 'Device change cooldown is active',
      code: 'device_cooldown_active',
      remainingMinutes: 42,
      remainingSeconds: 2513,
      path: '/auth/mobile/login/student',
      timestamp: expect.any(String),
    })

    response.json.mockClear()
    const elsewhere = new ForbiddenException({
      code: 'active_session_elsewhere',
      activeDeviceKind: 'mobile',
      activeSessionLastActiveAt: '2026-11-10T09:15:00.000Z',
      message: 'This account is currently signed in on another device',
    })
    filter.catch(elsewhere, makeHost('/auth/login/student'))
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'ForbiddenException',
      message: 'This account is currently signed in on another device',
      code: 'active_session_elsewhere',
      activeDeviceKind: 'mobile',
      activeSessionLastActiveAt: '2026-11-10T09:15:00.000Z',
      path: '/auth/login/student',
      timestamp: expect.any(String),
    })
  })

  it('forwards a null activeDeviceKind for legacy blocking sessions', () => {
    const exception = new ForbiddenException({
      code: 'active_session_elsewhere',
      activeDeviceKind: null,
      activeSessionLastActiveAt: '2026-11-10T09:15:00.000Z',
      message: 'This device could not be identified',
    })

    filter.catch(exception, makeHost('/auth/login/student'))

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'active_session_elsewhere', activeDeviceKind: null }),
    )
  })

  it('preserves the maintenance 503 surface with its estimated resumption', () => {
    const exception = new ServiceUnavailableException({
      code: 'system_maintenance',
      message: 'Campus maintenance',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })

    filter.catch(exception, makeHost('/attendance/summaries'))

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 503,
      error: 'ServiceUnavailableException',
      message: 'Campus maintenance',
      code: 'system_maintenance',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
      path: '/attendance/summaries',
      timestamp: expect.any(String),
    })
  })

  it('preserves the missing designation on suite 403s', () => {
    const exception = new ForbiddenException({
      code: 'designation_required',
      designation: 'user_admin',
      message: 'This action requires the Registrar designation',
    })

    filter.catch(exception, makeHost('/users'))

    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'ForbiddenException',
      message: 'This action requires the Registrar designation',
      code: 'designation_required',
      designation: 'user_admin',
      path: '/users',
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

  it('maps connection-pool exhaustion to a retryable 503 so clients back off instead of failing', () => {
    const poolTimeout = new Error('timeout exceeded when trying to connect')

    filter.catch(poolTimeout, makeHost('/auth/mobile/login/student'))

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.header).toHaveBeenCalledWith('retry-after', '5')
    expect(response.header).toHaveBeenCalledWith('retry-after', '5')
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'The service is temporarily at capacity. Please retry shortly.',
      code: 'database_busy',
      retryAfterSeconds: 5,
      path: '/auth/mobile/login/student',
      timestamp: expect.any(String),
    })
    expect(loggerErrorSpy).toHaveBeenCalledWith('Database capacity exhausted', poolTimeout.stack)
  })

  it('maps an acquire-timeout that terminated an established connection to 503', () => {
    filter.catch(new Error('Connection terminated due to connection timeout'), makeHost())

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json.mock.calls[0][0]).toMatchObject({ code: 'database_busy', retryAfterSeconds: 5 })
  })

  it("maps Prisma's P2024 pool timeout to 503", () => {
    const prismaTimeout = Object.assign(new Error('Timed out fetching a new connection from the pool'), {
      code: 'P2024',
    })

    filter.catch(prismaTimeout, makeHost())

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json.mock.calls[0][0]).toMatchObject({ code: 'database_busy' })
  })

  it('keeps a genuine connection outage a 500 instead of masking it as capacity', () => {
    filter.catch(new Error('Connection terminated unexpectedly'), makeHost())

    expect(response.status).toHaveBeenCalledWith(500)
    expect(loggerErrorSpy).toHaveBeenCalledWith('Unhandled exception', expect.any(String))
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
