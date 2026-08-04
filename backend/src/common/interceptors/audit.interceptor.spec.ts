import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of } from 'rxjs'
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

  it('fails closed before a mutation when the audit intent cannot be persisted', async () => {
    const prisma = { auditLog: { create: jest.fn().mockRejectedValue(new Error('audit unavailable')) } }
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/sessions', params: {}, user: { id: 'u1', role: 'teacher' } }),
      }),
    } as unknown as ExecutionContext
    const next = { handle: jest.fn(() => of({ id: 'must-not-run' })) } as CallHandler
    const interceptor = new AuditInterceptor(prisma as never)

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow('audit unavailable')
    expect(next.handle).not.toHaveBeenCalled()
  })
})
