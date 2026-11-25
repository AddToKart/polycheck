import { Test } from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import { SessionAuthenticator } from './session-authenticator.service'
import { BetterAuthService } from './better-auth.service'

describe('SessionAuthenticator', () => {
  let service: SessionAuthenticator
  let betterAuth: any

  beforeEach(async () => {
    betterAuth = { auth: { api: { getSession: jest.fn() } } }
    const module = await Test.createTestingModule({
      providers: [SessionAuthenticator, { provide: BetterAuthService, useValue: betterAuth }],
    }).compile()
    service = module.get(SessionAuthenticator)
    jest.clearAllMocks()
  })

  function makeHeaders(cookie = 'session=abc') {
    return new Headers({ cookie })
  }

  const resolved = {
    session: { id: 'auth-sess-1', generation: 2 },
    user: {
      id: 'user-1',
      isActive: true,
      authVersion: 2,
      role: 'teacher',
      email: 't@example.edu',
      studentId: null,
      department: 'CCIS',
      scope: null,
    },
  }

  it('throws UnauthorizedException when BetterAuth returns no session', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue(null)
    await expect(service.authenticate(makeHeaders())).rejects.toThrow(UnauthorizedException)
  })

  it('throws when user is inactive', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue({
      ...resolved,
      user: { ...resolved.user, isActive: false },
    })
    await expect(service.authenticate(makeHeaders())).rejects.toThrow(UnauthorizedException)
  })

  it('throws when authVersion mismatch (session was replaced)', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue({
      ...resolved,
      session: { ...resolved.session, generation: 1 },
    })
    await expect(service.authenticate(makeHeaders())).rejects.toThrow(UnauthorizedException)
  })

  it('returns RequestUser on valid session', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue(resolved)
    const user = await service.authenticate(makeHeaders())
    expect(user).toEqual({
      id: 'user-1',
      role: 'teacher',
      email: 't@example.edu',
      studentId: null,
      department: 'CCIS',
      scope: null,
      authSessionId: 'auth-sess-1',
      mustChangePassword: false,
      isItCoordinator: false,
      isDepartmentHead: false,
      isUserRegistrar: false,
      managedCourses: [],
      managesAllCourses: false,
    })
  })

  it('maps the course scope into the principal and normalizes missing values', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue({
      ...resolved,
      user: { ...resolved.user, isDepartmentHead: true, managedCourses: ['BSIT', 'BSHM'], managesAllCourses: false },
    })
    const scoped = await service.authenticate(makeHeaders())
    expect(scoped.managedCourses).toEqual(['BSIT', 'BSHM'])
    expect(scoped.managesAllCourses).toBe(false)

    betterAuth.auth.api.getSession.mockResolvedValue({
      ...resolved,
      user: { ...resolved.user, managedCourses: null, managesAllCourses: true },
    })
    const all = await service.authenticate(makeHeaders())
    expect(all.managedCourses).toEqual([])
    expect(all.managesAllCourses).toBe(true)
  })

  it('maps administrative designations into the principal', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue({
      ...resolved,
      user: { ...resolved.user, isItCoordinator: true, isDepartmentHead: true, isUserRegistrar: false },
    })
    const user = await service.authenticate(makeHeaders())
    expect(user.isItCoordinator).toBe(true)
    expect(user.isDepartmentHead).toBe(true)
    expect(user.isUserRegistrar).toBe(false)
  })

  it('passes headers to BetterAuth getSession', async () => {
    betterAuth.auth.api.getSession.mockResolvedValue(resolved)
    const headers = makeHeaders('session=xyz')
    await service.authenticate(headers)
    expect(betterAuth.auth.api.getSession).toHaveBeenCalledWith({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    })
  })
})
