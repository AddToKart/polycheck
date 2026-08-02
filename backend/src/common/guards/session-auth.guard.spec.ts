import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SessionAuthGuard } from './session-auth.guard'
import type { SessionAuthenticator } from '../../auth/session-authenticator.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

interface TestRequest {
  headers: Record<string, string | string[] | undefined>
  user?: unknown
}

describe('SessionAuthGuard', () => {
  let reflector: jest.Mocked<Reflector>
  let sessionAuthenticator: { authenticate: jest.Mock }
  let guard: SessionAuthGuard

  const makeRequest = (headers: Record<string, string | string[] | undefined> = {}, user?: unknown): TestRequest => ({
    headers,
    ...(user !== undefined ? { user } : {}),
  })

  const makeContext = (request: TestRequest): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
    }) as never

  beforeEach(() => {
    reflector = new Reflector() as jest.Mocked<Reflector>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    sessionAuthenticator = { authenticate: jest.fn() }
    guard = new SessionAuthGuard(reflector, sessionAuthenticator as unknown as SessionAuthenticator)
  })

  afterEach(() => jest.restoreAllMocks())

  it('allows access without authenticating when the route is marked public', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true)
    const request = makeRequest({ authorization: 'Bearer whatever' })

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.any(Function),
      expect.any(Function),
    ])
    expect(sessionAuthenticator.authenticate).not.toHaveBeenCalled()
    expect(request).not.toHaveProperty('user')
  })

  it('authenticates non-public requests and attaches the principal to the request', async () => {
    const principal = { id: 'stu-1', role: 'student' }
    sessionAuthenticator.authenticate.mockResolvedValue(principal)
    const request = makeRequest({ authorization: 'Bearer abc', 'x-forwarded-for': ['1.2.3.4', '5.6.7.8'] })

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

    expect(sessionAuthenticator.authenticate).toHaveBeenCalledTimes(1)
    expect(sessionAuthenticator.authenticate).toHaveBeenCalledWith(expect.any(Headers))
    const headersArg = sessionAuthenticator.authenticate.mock.calls[0][0]
    expect(headersArg).toBeInstanceOf(Headers)
    expect(headersArg.get('authorization')).toBe('Bearer abc')
    // Array-valued header entries are appended individually and combined by
    // Headers.get per the fetch spec (", "-joined).
    expect(headersArg.get('x-forwarded-for')).toBe('1.2.3.4, 5.6.7.8')
    expect(headersArg.has('x-forwarded-for')).toBe(true)
    expect(request.user).toBe(principal)
  })

  it('propagates authentication failures out of canActivate', async () => {
    const error = new UnauthorizedException('Invalid or expired session')
    sessionAuthenticator.authenticate.mockRejectedValue(error)
    const request = makeRequest({ authorization: 'Bearer abc' })

    await expect(guard.canActivate(makeContext(request))).rejects.toBe(error)
    expect(request).not.toHaveProperty('user')
  })
})
