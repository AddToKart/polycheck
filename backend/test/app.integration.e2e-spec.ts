import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { hash } from '@node-rs/bcrypt'

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
    const password = await hash(AUTH_PASSWORD, { cost: 12 })
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
        department: 'CCIS',
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

  it('blocks a second student device, allows same-device re-login, and arms a logout cooldown', async () => {
    const credentials = { studentId: AUTH_STUDENT_ID, password: AUTH_PASSWORD }
    const browserA = request.agent(baseUrl)
    await browserA.post('/api/auth/login/student').send({ ...credentials, deviceId: 'web-a' }).expect(201)
    await browserA
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(AUTH_USER_ID))

    // A different device is rejected with the explainer payload; the first
    // device keeps its session untouched.
    const blocked = await request(baseUrl)
      .post('/api/auth/login/student')
      .send({ ...credentials, deviceId: 'web-b' })
      .expect(403)
    expect(blocked.body.code).toBe('active_session_elsewhere')
    expect(blocked.body.activeDeviceKind).toBe('web')
    expect(blocked.body.activeSessionLastActiveAt).toEqual(expect.any(String))
    await browserA.get('/api/auth/me').expect(200)

    // Same-device re-login passes and purges the stale same-device row.
    await browserA.post('/api/auth/login/student').send({ ...credentials, deviceId: 'web-a' }).expect(201)
    await browserA.get('/api/auth/me').expect(200)

    // A mobile login from another device is rejected while web-a holds the
    // session; logging out web-a arms a cooldown that exempts only web-a.
    await request(baseUrl)
      .post('/api/auth/mobile/login/student')
      .send({ ...credentials, deviceId: 'mobile-a' })
      .expect(403)
    await browserA.post('/api/auth/logout').send({ deviceId: 'web-a' }).expect(201)
    const cooled = await request(baseUrl)
      .post('/api/auth/mobile/login/student')
      .send({ ...credentials, deviceId: 'mobile-a' })
      .expect(403)
    expect(cooled.body.code).toBe('device_cooldown_active')
    expect(cooled.body.remainingSeconds).toEqual(expect.any(Number))
    await browserA.post('/api/auth/login/student').send({ ...credentials, deviceId: 'web-a' }).expect(201)
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
