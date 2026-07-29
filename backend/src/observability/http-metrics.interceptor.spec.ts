import { HttpException } from '@nestjs/common'
import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { lastValueFrom, of, throwError } from 'rxjs'
import { HttpMetricsInterceptor } from './http-metrics.interceptor'
import { MetricsService } from './metrics.service'

describe('HttpMetricsInterceptor', () => {
  let metrics: MetricsService

  beforeEach(() => {
    metrics = new MetricsService()
  })

  afterEach(() => metrics.onModuleDestroy())

  it('uses the route template rather than the identifier in the raw URL', async () => {
    const interceptor = new HttpMetricsInterceptor(metrics)
    const context = httpContext(
      { method: 'GET', url: '/api/users/private-user-id', route: { path: '/users/:id' } },
      200,
    )

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({}) } as CallHandler))
    const output = await metrics.metrics()

    expect(output).toContain('route="/users/:id"')
    expect(output).not.toContain('private-user-id')
  })

  it('records the exception status without adding exception details as labels', async () => {
    const interceptor = new HttpMetricsInterceptor(metrics)
    const context = httpContext({ method: 'POST', route: { path: '/sync/attendance' } }, 201)
    const handler = { handle: () => throwError(() => new HttpException('sensitive detail', 503)) } as CallHandler

    await expect(lastValueFrom(interceptor.intercept(context, handler))).rejects.toThrow('sensitive detail')
    const output = await metrics.metrics()

    expect(output).toContain('status_code="503"')
    expect(output).not.toContain('sensitive detail')
  })
})

function httpContext(request: object, statusCode: number) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode }) }),
  } as ExecutionContext
}
