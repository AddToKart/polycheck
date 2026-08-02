import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { hash } from 'bcryptjs'

const AUTH_USER_ID = 'e2e-auth-user'
const AUTH_STUDENT_ID = 'E2E-AUTH-001'
const AUTH_PASSWORD = 'E2eAuth1!Secure'
const STARTUP_TIMEOUT_MS = 30_000

describe('Application integration (e2e)', () => {
  let prisma: PrismaService
  let server: ChildProcess
  let baseUrl: string
  let serverOutput = ''

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.$connect()
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

    const port = await findAvailablePort()
    baseUrl = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, ['dist/main.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout?.on('data', (chunk: Buffer) => {
      serverOutput = appendOutput(serverOutput, chunk)
    })
    server.stderr?.on('data', (chunk: Buffer) => {
      serverOutput = appendOutput(serverOutput, chunk)
    })
    try {
      await waitForReady(`${baseUrl}/api/health/ready`, server)
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : 'Backend startup failed'}\n${serverOutput}`)
    }
  }, 60_000)

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: AUTH_USER_ID } })
    await prisma?.$disconnect()
    if (server && !server.killed) {
      server.kill()
      await waitForExit(server, 5_000)
    }
  }, 30_000)

  it('connects to infrastructure and serves readiness', async () => {
    const response = await request(baseUrl).get('/api/health/ready').expect(200)
    expect(response.body.checks.database).toBe('ok')
  })

  it('protects application resources without a Better Auth session', async () => {
    await request(baseUrl).get('/api/subjects').expect(401)
  })

  it('registers and protects the account-scoped enrollment resource', async () => {
    await request(baseUrl).get('/api/enrollments').expect(401)
  })

  it.each([
    ['post', '/api/users/students'],
    ['patch', '/api/users/student-1/password'],
  ] as const)('protects super-admin account management: %s %s', async (method, path) => {
    await request(baseUrl)[method](path).send({}).expect(401)
  })

  it('rejects malformed login bodies before reaching authentication', async () => {
    const response = await request(baseUrl)
      .post('/api/auth/login/student')
      .send({ studentId: 'S-1', password: 'short', injected: true })
      .expect(400)
    expect(response.body.message).toBeDefined()
  })

  it('enforces one Better Auth session across web cookies and mobile bearer tokens', async () => {
    const credentials = { studentId: AUTH_STUDENT_ID, password: AUTH_PASSWORD }
    const browser = request.agent(baseUrl)
    await browser.post('/api/auth/login/student').send(credentials).expect(201)
    await browser
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(AUTH_USER_ID))

    const firstMobile = await request(baseUrl).post('/api/auth/mobile/login/student').send(credentials).expect(201)
    expect(firstMobile.body.token).toEqual(expect.any(String))
    await browser.get('/api/auth/me').expect(401)

    const secondMobile = await request(baseUrl).post('/api/auth/mobile/login/student').send(credentials).expect(201)
    await request(baseUrl).get('/api/auth/me').set('Authorization', `Bearer ${firstMobile.body.token}`).expect(401)
    await request(baseUrl).get('/api/auth/me').set('Authorization', `Bearer ${secondMobile.body.token}`).expect(200)

    await request(baseUrl)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${secondMobile.body.token}`)
      .expect(201)
    await request(baseUrl).get('/api/auth/me').set('Authorization', `Bearer ${secondMobile.body.token}`).expect(401)
  }, 20_000)
})

function findAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const reservation = createServer()
    reservation.once('error', reject)
    reservation.listen(0, '127.0.0.1', () => {
      const address = reservation.address()
      if (!address || typeof address === 'string') {
        reservation.close()
        reject(new Error('Unable to reserve an e2e server port'))
        return
      }
      reservation.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function waitForReady(url: string, child: ChildProcess) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited during startup with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The listener may not be bound yet.
    }
    await delay(250)
  }
  throw new Error(`Backend did not become ready within ${STARTUP_TIMEOUT_MS}ms`)
}

function appendOutput(current: string, chunk: Buffer) {
  return `${current}${chunk.toString()}`.slice(-10_000)
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function waitForExit(child: ChildProcess, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, timeoutMs)
    child.once('exit', finish)

    function finish() {
      clearTimeout(timeout)
      child.off('exit', finish)
      resolve()
    }
  })
}
