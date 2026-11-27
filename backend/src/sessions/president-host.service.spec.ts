import { ForbiddenException } from '@nestjs/common'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'
import type { RequestUser } from '../auth/authenticated-principal'
import { PresidentHostService } from './president-host.service'
import { presidentSessionKeyPair } from './president-signer'

process.env.BETTER_AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters'

const president: RequestUser = { id: 'pres-1', role: 'student' }
const AREA = { geofenceLatitude: 14.8697, geofenceLongitude: 120.9991, geofenceRadiusMeters: 40 }
const insideArea = {
  validityMinutes: 5,
  gracePeriodMinutes: 15,
  latitude: AREA.geofenceLatitude,
  longitude: AREA.geofenceLongitude,
  accuracyMeters: 10,
  deviceId: 'mobile-phone-1',
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    mode: 'in_person',
    isActive: false,
    endedAt: null,
    qrToken: null,
    qrTokenExpiresAt: null,
    gracePeriodMinutes: 15,
    hostStudentId: 'pres-1',
    hostPublicKey: presidentSessionKeyPair('sess-1').publicKey,
    hostStartedAt: null,
    ...AREA,
    ...overrides,
  }
}

const livePermission = () => ({ isActive: true, revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) })
const record = { id: 'rec-1', status: 'pending', timestamp: new Date('2026-11-27T01:00:00Z') }

describe('PresidentHostService', () => {
  let prisma: any
  let tx: any
  let sessions: any
  let ledger: any
  let service: PresidentHostService

  beforeEach(() => {
    const membership = () => ({
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enr-1' }) },
      sectionRole: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }) },
      sessionPermission: { findUnique: jest.fn().mockResolvedValue(livePermission()) },
    })
    prisma = {
      ...membership(),
      session: { findUnique: jest.fn().mockResolvedValue(makeSession()) },
      user: { findUnique: jest.fn().mockResolvedValue({ fullName: 'Prof Test' }) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    }
    tx = {
      ...membership(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      attendanceRecord: {
        findUnique: jest.fn().mockResolvedValue(record),
        update: jest.fn().mockResolvedValue(record),
      },
    }
    sessions = {
      // Runs the hooks the way the real activation does.
      activateInPerson: jest.fn().mockImplementation(async (_s, _d, _u, _k, hooks) => {
        await hooks.beforeClaim(tx)
        await hooks.afterSeed(tx)
      }),
      closeSession: jest.fn().mockResolvedValue({}),
    }
    ledger = { appendLedger: jest.fn().mockResolvedValue('hash') }
    service = new PresidentHostService(prisma, sessions, ledger)
  })

  const started = () => sessions.activateInPerson.mock.calls[0] as any[]

  describe('who may act', () => {
    it.each([
      ['another student', () => prisma.session.findUnique.mockResolvedValue(makeSession({ hostStudentId: 'other' }))],
      [
        'a session no president created',
        () => prisma.session.findUnique.mockResolvedValue(makeSession({ hostStudentId: null })),
      ],
      ['a president who lost the role', () => prisma.sectionRole.findUnique.mockResolvedValue(null)],
      ['a student removed from the section', () => prisma.enrollment.findUnique.mockResolvedValue(null)],
      [
        'a revoked permission',
        () =>
          prisma.sessionPermission.findUnique.mockResolvedValue({ ...livePermission(), revokedAt: new Date() }),
      ],
    ])('refuses %s on every action', async (_case, arrange) => {
      arrange()
      await expect(service.state('sess-1', president)).rejects.toThrow(ForbiddenException)
      await expect(service.start('sess-1', insideArea, president)).rejects.toThrow(ForbiddenException)
      await expect(service.end('sess-1', president)).rejects.toThrow(ForbiddenException)
      expect(sessions.activateInPerson).not.toHaveBeenCalled()
      expect(sessions.closeSession).not.toHaveBeenCalled()
    })

    it('does not start after the time limit', async () => {
      prisma.sessionPermission.findUnique.mockResolvedValue({
        ...livePermission(),
        expiresAt: new Date(Date.now() - 1000),
      })
      await expect(service.start('sess-1', insideArea, president)).rejects.toThrow('time limit')
      expect((await service.state('sess-1', president)).canStart).toBe(false)
    })

    it('still ends a session already running after the time limit', async () => {
      prisma.sessionPermission.findUnique.mockResolvedValue({
        isActive: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      })
      prisma.session.findUnique.mockResolvedValue(
        makeSession({ isActive: true, qrToken: 'token', hostStartedAt: new Date() }),
      )
      await service.end('sess-1', president)
      expect(sessions.closeSession).toHaveBeenCalled()
    })

    it('cannot end a session the professor started', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ isActive: true, qrToken: 'token' }))
      await expect(service.end('sess-1', president)).rejects.toThrow('Only your professor')
      const state = await service.state('sess-1', president)
      expect(state).toEqual(expect.objectContaining({ canEnd: false, canStart: false }))
      expect(state.qrToken).toBeUndefined()
    })

    it('does not start an online session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ mode: 'online' }))
      await expect(service.start('sess-1', insideArea, president)).rejects.toThrow('in-person')
    })

    it('stops a start when the permission is revoked while starting', async () => {
      tx.sessionPermission.findUnique.mockResolvedValue({ ...livePermission(), revokedAt: new Date() })
      await expect(service.start('sess-1', insideArea, president)).rejects.toThrow(ForbiddenException)
      expect(tx.attendanceRecord.update).not.toHaveBeenCalled()
    })
  })

  describe('the QR code', () => {
    it("is signed with this session's key only", async () => {
      await service.start('sess-1', insideArea, president)

      const [, dto, actor, publicKey, hooks] = started()
      expect(actor.id).toBe('teacher-1')
      expect(publicKey).toBe(presidentSessionKeyPair('sess-1').publicKey)
      expect(hooks.claimData).toEqual({ hostPublicKey: publicKey, hostStartedAt: expect.any(Date) })
      expect(verifyQRTokenNative(dto.token, publicKey)).toEqual(
        expect.objectContaining({ sessionId: 'sess-1', sectionId: 'sec-1', teacherId: 'teacher-1' }),
      )
      // Neither another session's key nor a professor's device key accepts it.
      expect(verifyQRTokenNative(dto.token, presidentSessionKeyPair('sess-2').publicKey)).toBeNull()
      expect(verifyQRTokenNative(dto.token, createSigningKeyPair().publicKey)).toBeNull()
    })

    it("is not accepted as the professor's signature, and the reverse", () => {
      const professor = createSigningKeyPair()
      const session = presidentSessionKeyPair('sess-1')
      const payload = { version: 1, sessionId: 'sess-1' } as never
      expect(verifyQRTokenNative(signQRToken(payload, professor.secretKey), session.publicKey)).toBeNull()
      expect(verifyQRTokenNative(signQRToken(payload, session.secretKey), professor.publicKey)).toBeNull()
    })
  })

  describe("the president's own attendance", () => {
    it('marks them present inside the class area and adds the row to the ledger', async () => {
      const result = await service.start('sess-1', insideArea, president)

      expect(result.markedPresent).toBe(true)
      expect(tx.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({ status: 'present', latitude: AREA.geofenceLatitude }),
      })
      // The hashed timestamp is never rewritten.
      expect(tx.attendanceRecord.update.mock.calls[0][0].data).not.toHaveProperty('timestamp')
      expect(ledger.appendLedger).toHaveBeenCalledWith(tx, {
        id: 'rec-1',
        studentId: 'pres-1',
        sessionId: 'sess-1',
        timestamp: record.timestamp,
      })
    })

    it.each([
      ['no location', { latitude: undefined, longitude: undefined }, 'not shared'],
      ['outside the class area', { latitude: 14.88 }, 'away'],
      ['an inaccurate reading', { accuracyMeters: 400 }, 'not accurate enough'],
      ['a simulated location', { mocked: true }, 'simulated'],
      ['a rooted phone', { deviceSecurity: { rootDetected: true } }, 'security check'],
      [
        'an old reading',
        { locationCapturedAt: '2026-11-27T01:00:00Z', clientTime: '2026-11-27T01:10:00Z' },
        'too old',
      ],
    ])('starts but does not mark them with %s', async (_case, change, reason) => {
      const result = await service.start('sess-1', { ...insideArea, ...change }, president)

      expect(sessions.activateInPerson).toHaveBeenCalled()
      expect(result.markedPresent).toBe(false)
      expect(result.presenceMessage).toContain(reason)
      expect(tx.attendanceRecord.update).not.toHaveBeenCalled()
      expect(ledger.appendLedger).not.toHaveBeenCalled()
    })
  })

  it('shows names and check-in times only', async () => {
    prisma.session.findUnique.mockResolvedValue(
      makeSession({ isActive: true, qrToken: 'token', hostStartedAt: new Date() }),
    )
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { studentName: 'A Student', status: 'present', timestamp: new Date('2026-11-27T01:02:00Z') },
      { studentName: 'B Student', status: 'pending', timestamp: new Date('2026-11-27T01:00:00Z') },
    ])

    const state = await service.state('sess-1', president)

    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].select).toEqual({
      studentName: true,
      status: true,
      timestamp: true,
    })
    expect(state.qrToken).toBe('token')
    expect(state.roster).toEqual([
      { studentName: 'A Student', status: 'present', scannedAt: '2026-11-27T01:02:00.000Z' },
      { studentName: 'B Student', status: 'pending' },
    ])
  })
})
