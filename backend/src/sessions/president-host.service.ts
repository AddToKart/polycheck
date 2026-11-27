import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { signQRToken } from '@polycheck/shared'
import type { HostSessionState, HostStartResult, QRTokenPayload } from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { LedgerService, acquireSessionLedgerLock } from '../attendance/ledger.service'
import { lockStudentSection } from '../common/student-section-lock'
import type { Prisma, Session } from '../prisma/client'
import type { HostStartDto } from './dto/host-session.dto'
import { evaluatePresidentPresence, type PresidentPresence } from './president-presence'
import { presidentSessionKeyPair } from './president-signer'
import { SessionsService } from './sessions.service'

const PRESENT_NOTE = 'Marked present: started this session inside the class area.'
const REMOVED = 'Your professor removed your permission for this session.'
const TIME_UP = 'The time limit of your permission has ended, so this session can no longer be started.'

/**
 * What a section president may do with a session they created: start it, watch
 * who checks in, and end it. Nothing here edits attendance.
 *
 * Rules, checked on every call:
 * - only the student who created the session;
 * - still enrolled and still the section's president;
 * - the permission has not been revoked;
 * - starting also needs the permission's time limit to be running.
 */
@Injectable()
export class PresidentHostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly ledger: LedgerService,
  ) {}

  async state(sessionId: string, user: RequestUser): Promise<HostSessionState> {
    const { session, permissionLive } = await this.authorize(sessionId, user)
    const notStarted = !session.isActive && !session.endedAt && !session.qrToken
    const startedByPresident = Boolean(session.hostStartedAt)
    const running = session.isActive && startedByPresident
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      // Names and check-in times only: no location or device details.
      select: { studentName: true, status: true, timestamp: true },
      orderBy: { studentName: 'asc' },
    })

    let message: string | undefined
    if (notStarted && !permissionLive) message = TIME_UP
    else if (session.isActive && !startedByPresident) message = 'Your professor started this session.'
    else if (session.endedAt) message = 'This session has ended.'

    return {
      sessionId,
      isActive: session.isActive,
      ...(session.endedAt ? { endedAt: session.endedAt.toISOString() } : {}),
      canStart: notStarted && permissionLive,
      canEnd: running,
      ...(message ? { message } : {}),
      ...(running && session.qrToken ? { qrToken: session.qrToken } : {}),
      ...(running && session.qrTokenExpiresAt ? { qrTokenExpiresAt: session.qrTokenExpiresAt.toISOString() } : {}),
      gracePeriodMinutes: session.gracePeriodMinutes,
      roster: records.map((record) => ({
        studentName: record.studentName,
        status: record.status,
        ...(record.status === 'present' || record.status === 'late'
          ? { scannedAt: record.timestamp.toISOString() }
          : {}),
      })),
    }
  }

  async start(sessionId: string, dto: HostStartDto, user: RequestUser): Promise<HostStartResult> {
    const { session, permissionLive } = await this.authorize(sessionId, user)
    if (session.mode !== 'in_person') {
      throw new BadRequestException('A section president can only start in-person sessions')
    }
    if (session.isActive || session.endedAt || session.qrToken) {
      throw new ConflictException('Session is already active or was already ended')
    }
    if (!permissionLive) throw new ForbiddenException(TIME_UP)

    const teacher = await this.prisma.user.findUnique({
      where: { id: session.teacherId },
      select: { fullName: true },
    })
    const keys = presidentSessionKeyPair(session.id)
    const issuedAt = Date.now()
    // Same token a professor's device would sign, so students scan it the same way.
    const payload: QRTokenPayload = {
      version: 1,
      sessionId: session.id,
      sectionId: session.sectionId,
      issuedAt,
      validityMinutes: dto.validityMinutes,
      gracePeriodMinutes: dto.gracePeriodMinutes,
      teacherId: session.teacherId,
      teacherName: teacher?.fullName ?? 'Instructor',
      mode: 'in_person',
      pinRequired: false,
    }
    const presence = evaluatePresidentPresence(session, dto)

    await this.sessions.activateInPerson(
      session,
      {
        token: signQRToken(payload, keys.secretKey),
        validityMinutes: dto.validityMinutes,
        gracePeriodMinutes: dto.gracePeriodMinutes,
      },
      // The session still belongs to the professor; the checks above are what
      // let the president act on it.
      { id: session.teacherId, role: 'teacher' } as RequestUser,
      keys.publicKey,
      {
        claimData: { hostPublicKey: keys.publicKey, hostStartedAt: new Date(issuedAt) },
        beforeClaim: async (tx) => {
          // Same lock order as the scan path: session ledger, then student.
          await acquireSessionLedgerLock(tx, session.id)
          await lockStudentSection(tx, user.id, session.sectionId)
          // A revoke that arrived meanwhile wins.
          await this.assertStillAllowed(tx, session.sectionId, user.id)
        },
        afterSeed: (tx) => this.markPresident(tx, session, user.id, presence, dto.deviceId),
      },
    )

    return {
      ...(await this.state(sessionId, user)),
      markedPresent: presence.present,
      presenceMessage: presence.message,
    }
  }

  async end(sessionId: string, user: RequestUser): Promise<HostSessionState> {
    const { session } = await this.authorize(sessionId, user)
    if (!session.hostStartedAt) {
      throw new ForbiddenException('Only your professor can end a session they started')
    }
    await this.sessions.closeSession(session)
    return this.state(sessionId, user)
  }

  private async authorize(sessionId: string, user: RequestUser) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session not found')
    if (user.role !== 'student' || !session.hostStudentId || session.hostStudentId !== user.id) {
      throw new ForbiddenException('Only the section president who created this session can run it')
    }
    const permission = await this.assertStillAllowed(this.prisma, session.sectionId, user.id)
    const permissionLive = permission.isActive && permission.expiresAt.getTime() > Date.now()
    return { session, permissionLive }
  }

  private async assertStillAllowed(db: Prisma.TransactionClient, sectionId: string, studentId: string) {
    const [enrollment, role, permission] = await Promise.all([
      db.enrollment.findUnique({
        where: { studentId_sectionId: { studentId, sectionId } },
        select: { id: true },
      }),
      db.sectionRole.findUnique({
        where: { sectionId_studentId_role: { sectionId, studentId, role: 'president' } },
        select: { id: true },
      }),
      db.sessionPermission.findUnique({ where: { sectionId_studentId: { sectionId, studentId } } }),
    ])
    if (!enrollment || !role || !permission || permission.revokedAt) throw new ForbiddenException(REMOVED)
    return permission
  }

  private async markPresident(
    tx: Prisma.TransactionClient,
    session: Session,
    studentId: string,
    presence: PresidentPresence,
    deviceId: string | undefined,
  ) {
    if (!presence.present) return
    const record = await tx.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    })
    if (!record || record.status !== 'pending') return
    // The timestamp is part of the ledger hash and stays the activation time.
    await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: 'present',
        latitude: presence.latitude,
        longitude: presence.longitude,
        deviceId: deviceId ?? null,
        notes: PRESENT_NOTE,
      },
    })
    await this.ledger.appendLedger(tx, {
      id: record.id,
      studentId,
      sessionId: session.id,
      timestamp: record.timestamp,
    })
  }
}
