import { Logger, type CallHandler, type ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of, throwError } from 'rxjs'
import { AuditInterceptor } from './audit.interceptor'

describe('AuditInterceptor', () => {
  it('records authenticated state-changing requests without request body secrets', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        update: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    }
    const request = {
      method: 'POST',
      path: '/sessions',
      originalUrl: '/api/sessions',
      baseUrl: '/api',
      route: { path: '/sessions' },
      params: {},
      body: { password: 'must-not-be-logged' },
      user: { id: 'teacher-1', role: 'teacher' },
    }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
    const interceptor = new AuditInterceptor(prisma as never)

    await firstValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'session-1' }) } as CallHandler))
    await Promise.resolve()

    const data = prisma.auditLog.create.mock.calls[0][0].data
    expect(data).toEqual(expect.objectContaining({ actorId: 'teacher-1', action: 'POST /api/sessions' }))
    expect(JSON.stringify(data)).not.toContain('must-not-be-logged')
    expect(prisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'audit-1' },
        data: expect.objectContaining({ entityId: 'session-1' }),
      }),
    )
  })

  it('does not audit read-only requests', async () => {
    const prisma = { auditLog: { create: jest.fn() } }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET', user: { id: 'u1', role: 'student' } }) }),
    } as unknown as ExecutionContext
    const interceptor = new AuditInterceptor(prisma as never)

    await firstValueFrom(interceptor.intercept(context, { handle: () => of([]) } as CallHandler))
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('logs begin-audit failure and allows the business mutation to continue', async () => {
    const prisma = {
      auditLog: { create: jest.fn().mockRejectedValue(new Error('audit unavailable')), update: jest.fn() },
    }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/sessions', params: {}, user: { id: 'u1', role: 'teacher' } }),
      }),
    } as unknown as ExecutionContext
    const next = { handle: jest.fn(() => of({ id: 'session-1' })) } as CallHandler
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const interceptor = new AuditInterceptor(prisma as never)

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toEqual({ id: 'session-1' })
    expect(next.handle).toHaveBeenCalledTimes(1)
    expect(prisma.auditLog.update).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Could not begin audit for POST /sessions (actor u1)'),
    )
    logError.mockRestore()
  })

  it('preserves a business failure when no audit id could be created', async () => {
    const prisma = {
      auditLog: { create: jest.fn().mockRejectedValue(new Error('audit unavailable')), update: jest.fn() },
    }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/sessions', params: {}, user: { id: 'u1', role: 'teacher' } }),
      }),
    } as unknown as ExecutionContext
    const businessError = new Error('mutation failed')
    const next = { handle: jest.fn(() => throwError(() => businessError)) } as CallHandler
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const interceptor = new AuditInterceptor(prisma as never)

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toBe(businessError)
    expect(prisma.auditLog.update).not.toHaveBeenCalled()
    logError.mockRestore()
  })
})
