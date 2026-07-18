import { Test } from '@nestjs/testing'
import { ForbiddenException, HttpException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { hashSync } from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { AuthService } from './auth.service'
import { BetterAuthService } from './better-auth.service'
import type { User } from '@prisma/client'

const VALID_PASSWORD = 'correct-horse-battery-staple'
const VALID_HASH = hashSync(VALID_PASSWORD, 10)

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    studentId: 'S-001',
    fullName: 'Jane Doe',
    email: null,
    authEmail: 'u-user-1@auth.polycheck.invalid',
    authEmailVerified: false,
    password: VALID_HASH,
    role: 'student',
    program: 'BSIT',
    yearLevel: 2,
    department: null,
    photoUrl: null,
    scope: null,
    teacherPublicKey: null,
    isActive: true,
    authVersion: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-07-01'),
    ...overrides,
  } as User
}

describe('AuthService', () => {
  let service: AuthService
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } }
  let redis: {
    consumeRateLimit: jest.Mock
    getJson: jest.Mock
    setJson: jest.Mock
    delete: jest.Mock
    setIfAbsent: jest.Mock
  }
  let betterAuth: { auth: { api: { signInEmail: jest.Mock; signOut: jest.Mock } } }
  let events: { emit: jest.Mock }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    }
    redis = {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      delete: jest.fn(),
      setIfAbsent: jest.fn().mockResolvedValue(true),
    }
    betterAuth = {
      auth: {
        api: {
          signInEmail: jest.fn().mockResolvedValue({
            headers: new Headers({ 'set-auth-token': 'signed-bearer-token' }),
          }),
          signOut: jest.fn().mockResolvedValue({
            headers: new Headers({ 'set-cookie': 'polycheck_access=; Max-Age=0; Path=/' }),
          }),
        },
      },
    }
    events = { emit: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: BetterAuthService, useValue: betterAuth },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile()

    service = moduleRef.get(AuthService)
  })

  describe('loginStudent', () => {
    it('returns token and sanitized user for valid student credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser())
      const result = await service.loginStudent('S-001', VALID_PASSWORD)
      expect(result.token).toBe('signed-bearer-token')
      expect(result.user.id).toBe('user-1')
      expect(result.user.role).toBe('student')
      expect(result.user).not.toHaveProperty('password')
      expect(betterAuth.auth.api.signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ email: 'u-user-1@auth.polycheck.invalid' }),
        }),
      )
      expect(events.emit).toHaveBeenCalledWith('auth.session-replaced', { userId: 'user-1', reason: 'new_login' })
    })

    it('rejects invalid password even when student exists', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser())
      await expect(service.loginStudent('S-001', 'wrong-password')).rejects.toThrow(UnauthorizedException)
      expect(betterAuth.auth.api.signInEmail).not.toHaveBeenCalled()
    })

    it('rejects unknown student and exercises DUMMY_HASH compare (timing safety)', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.loginStudent('S-999', VALID_PASSWORD)).rejects.toThrow(UnauthorizedException)
      expect(redis.consumeRateLimit).toHaveBeenCalledWith('login:student:identity:S-999:unknown', 10, 60)
      expect(redis.consumeRateLimit).toHaveBeenCalledWith('login:student:ip:unknown', 30, 60)
    })

    it('forbids when account role is not student', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: 'teacher', email: 't@pup.edu' }))
      await expect(service.loginStudent('S-001', VALID_PASSWORD)).rejects.toThrow(ForbiddenException)
    })

    it('forbids when account is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }))
      await expect(service.loginStudent('S-001', VALID_PASSWORD)).rejects.toThrow(ForbiddenException)
    })

    it('returns 429 when rate limit exceeded', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      await expect(service.loginStudent('S-001', VALID_PASSWORD)).rejects.toThrow(HttpException)
      try {
        await service.loginStudent('S-001', VALID_PASSWORD)
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
      }
    })
  })

  describe('loginFaculty', () => {
    const facultyUser = () =>
      buildUser({
        id: 'teacher-1',
        studentId: null,
        email: 'teacher@pup.edu',
        role: 'teacher',
        department: 'CS',
      })

    it('returns auth result for valid faculty credentials (email normalized lowercase)', async () => {
      prisma.user.findUnique.mockResolvedValue(facultyUser())
      const result = await service.loginFaculty('Teacher@PUP.edu', VALID_PASSWORD)
      expect(result.token).toBe('signed-bearer-token')
      expect(prisma.user.findUnique.mock.calls[0][0]).toEqual({ where: { email: 'teacher@pup.edu' } })
    })

    it('rejects invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(facultyUser())
      await expect(service.loginFaculty('teacher@pup.edu', 'bad')).rejects.toThrow(UnauthorizedException)
    })

    it('exercises DUMMY_HASH timing when faculty not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.loginFaculty('ghost@pup.edu', VALID_PASSWORD)).rejects.toThrow(UnauthorizedException)
    })

    it('forbids student trying to use faculty login', async () => {
      prisma.user.findUnique.mockResolvedValue(facultyUser())
      // override: a student email-but-student-role account
      prisma.user.findUnique.mockResolvedValueOnce(
        buildUser({ email: 'teacher@pup.edu', role: 'student', studentId: 'S-001' }),
      )
      await expect(service.loginFaculty('teacher@pup.edu', VALID_PASSWORD)).rejects.toThrow(ForbiddenException)
    })

    it('forbids disabled faculty account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...facultyUser(), isActive: false })
      await expect(service.loginFaculty('teacher@pup.edu', VALID_PASSWORD)).rejects.toThrow(ForbiddenException)
    })

    it('rate limits per normalized email and client address', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      await expect(service.loginFaculty('Teacher@PUP.edu', VALID_PASSWORD, '127.0.0.1')).rejects.toThrow(HttpException)
      expect(redis.consumeRateLimit).toHaveBeenCalledWith('login:faculty:identity:teacher@pup.edu:127.0.0.1', 10, 60)
      expect(redis.consumeRateLimit).toHaveBeenCalledWith('login:faculty:ip:127.0.0.1', 30, 60)
    })
  })

  describe('getProfile', () => {
    it('returns sanitized user for existing id', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser())
      const profile = await service.getProfile('user-1')
      expect(profile.id).toBe('user-1')
      expect(profile).not.toHaveProperty('password')
    })

    it('throws NotFoundException when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('provisionKey', () => {
    it('stores the public key and returns a message', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser())
      prisma.user.update.mockResolvedValue({ ...buildUser(), teacherPublicKey: 'pubkey' })
      const result = await service.provisionKey('user-1', 'pubkey')
      expect(result.message).toBe('Public key provisioned successfully')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { teacherPublicKey: 'pubkey' },
      })
    })

    it('throws NotFoundException when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.provisionKey('missing', 'pubkey')).rejects.toThrow(NotFoundException)
    })
  })

  describe('logout', () => {
    it('revokes the Better Auth session and returns response headers', async () => {
      const headers = new Headers({ authorization: 'Bearer token' })
      const result = await service.logout(headers)
      expect(result.message).toBe('Logged out successfully')
      expect(betterAuth.auth.api.signOut).toHaveBeenCalledWith({ headers, returnHeaders: true })
      expect(result.headers.get('set-cookie')).toContain('polycheck_access=')
    })
  })
})
