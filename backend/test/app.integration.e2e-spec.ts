import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Application integration (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('connects to infrastructure and serves readiness', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200)
    expect(response.body.checks.database).toBe('ok')
  })

  it('protects application resources without a bearer token', async () => {
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
})
