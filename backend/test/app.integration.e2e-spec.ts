import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { hash } from 'bcryptjs'

const AUTH_USER_ID = 'e2e-auth-user'
const AUTH_STUDENT_ID = 'E2E-AUTH-001'
const AUTH_PASSWORD = 'E2eAuth1!Secure'

describe('Application integration (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.user.deleteMany({ where: { id: AUTH_USER_ID } })
    const password = await hash(AUTH_PASSWORD, 12)
    await prisma.user.create({
      data: {
        id: AUTH_USER_ID,
        studentId: AUTH_STUDENT_ID,
        fullName: 'E2E Auth Student',
        authEmail: 'u-e2e-auth@auth.polycheck.invalid',
        email: 'e2e-auth@iskolar.pup.edu.ph',
        password,
        role: 'student',
        program: 'BS Computer Science',
        yearLevel: 1,
        authAccounts: {
          create: {
            id: 'e2e-auth-account',
            accountId: AUTH_USER_ID,
            providerId: 'credential',
            password,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
    })
  }, 30_000)

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: AUTH_USER_ID } })
    await app?.close()
  }, 30_000)

  it('connects to infrastructure and serves readiness', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200)
    expect(response.body.checks.database).toBe('ok')
  })

  it('protects application resources without a Better Auth session', async () => {
    await request(app.getHttpServer()).get('/api/subjects').expect(401)
  })

  it('registers and protects the account-scoped enrollment resource', async () => {
    await request(app.getHttpServer()).get('/api/enrollments').expect(401)
  })

  it.each([
    ['post', '/api/users/students'],
    ['patch', '/api/users/student-1/password'],
  ] as const)('protects super-admin account management: %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](path).send({}).expect(401)
  })

  it('rejects malformed login bodies before reaching authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login/student')
      .send({ studentId: 'S-1', password: 'short', injected: true })
      .expect(400)
    expect(response.body.message).toBeDefined()
  })

  it('enforces one Better Auth session across web cookies and mobile bearer tokens', async () => {
    const credentials = { studentId: AUTH_STUDENT_ID, password: AUTH_PASSWORD }
    const browser = request.agent(app.getHttpServer())
    await browser.post('/api/auth/login/student').send(credentials).expect(201)
    await browser.get('/api/auth/me').expect(200).expect(({ body }) => expect(body.id).toBe(AUTH_USER_ID))

    const firstMobile = await request(app.getHttpServer())
      .post('/api/auth/mobile/login/student')
      .send(credentials)
      .expect(201)
    expect(firstMobile.body.token).toEqual(expect.any(String))
    await browser.get('/api/auth/me').expect(401)

    const secondMobile = await request(app.getHttpServer())
      .post('/api/auth/mobile/login/student')
      .send(credentials)
      .expect(201)
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${firstMobile.body.token}`)
      .expect(401)
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${secondMobile.body.token}`)
      .expect(200)

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${secondMobile.body.token}`)
      .expect(201)
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${secondMobile.body.token}`)
      .expect(401)
  })
})
