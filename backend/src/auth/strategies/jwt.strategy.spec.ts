import { UnauthorizedException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { JwtStrategy } from './jwt.strategy'
import type { PrismaService } from '../../prisma/prisma.service'

describe('JwtStrategy', () => {
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: 'a-production-length-secret-for-tests-only',
        JWT_ISSUER: 'polycheck-api',
        JWT_AUDIENCE: 'polycheck-clients',
      }
      return values[key]
    }),
  } as unknown as ConfigService

  const prisma = {
    user: { findUnique: jest.fn() },
  }

  let strategy: JwtStrategy

  beforeEach(() => {
    jest.clearAllMocks()
    strategy = new JwtStrategy(config, prisma as unknown as PrismaService)
  })

  it('loads the current account role and authorization scope', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true,
      authVersion: 4,
      role: 'teacher',
      email: 'teacher@pup.edu.ph',
      studentId: null,
      department: 'CCIS',
      scope: 'department',
    })

    await expect(
      strategy.validate({
        sub: 'teacher-1',
        role: 'student',
        sessionVersion: 4,
        iat: 1,
        exp: 2,
      }),
    ).resolves.toEqual({
      id: 'teacher-1',
      role: 'teacher',
      email: 'teacher@pup.edu.ph',
      studentId: null,
      department: 'CCIS',
      scope: 'department',
    })
  })

  it.each([
    ['missing account', null, 4],
    ['disabled account', { isActive: false, authVersion: 4 }, 4],
    ['replaced session', { isActive: true, authVersion: 5 }, 4],
  ])('rejects a %s', async (_case, account, sessionVersion) => {
    prisma.user.findUnique.mockResolvedValue(account)

    await expect(strategy.validate({ sub: 'user-1', role: 'student', sessionVersion, iat: 1, exp: 2 })).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('extracts bearer and encoded cookie credentials', () => {
    const extract = (strategy as unknown as { _jwtFromRequest: (request: object) => string | null })._jwtFromRequest

    expect(extract({ headers: { authorization: 'Bearer bearer-token' } })).toBe('bearer-token')
    expect(extract({ headers: { cookie: 'theme=dark; polycheck_access=cookie%2Etoken' } })).toBe('cookie.token')
    expect(extract({ headers: { cookie: 'theme=dark' } })).toBeNull()
    expect(extract({ headers: { cookie: 'polycheck_access=%E0%A4%A' } })).toBeNull()
    expect(extract({ headers: {} })).toBeNull()
  })
})
