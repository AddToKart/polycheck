/**
 * Real database integration test for online dual-checkpoint scans.
 *
 * Verifies that scanning the start checkpoint records checkInTime and checkInStatus
 * in PostgreSQL, and scanning the end checkpoint records checkOutTime and checkOutStatus
 * in PostgreSQL.
 *
 * Opt-in: runs when DATABASE_URL is set (e.g. in CI with services or local test db).
 */
import { randomUUID } from 'node:crypto'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { PrismaService } from '../src/prisma/prisma.service'
import { AttendanceService } from '../src/attendance/attendance.service'
import { ScanValidatorService } from '../src/attendance/scan-validator.service'
import { GeofenceService } from '../src/attendance/geofence.service'
import { AttendanceScopeService } from '../src/attendance/attendance-scope.service'
import { AttendanceReportService } from '../src/attendance/attendance-report.service'
import { LedgerService } from '../src/attendance/ledger.service'
import type { RequestUser } from '../src/auth/authenticated-principal'

const databaseUrl = process.env.DATABASE_URL
const describeDb = databaseUrl ? describe : describe.skip

describeDb('Online dual-checkpoint scans (real PostgreSQL database)', () => {
  const teacherKeys = createSigningKeyPair(new Uint8Array(32).fill(77))
  const ids = {
    teacher: randomUUID(),
    student: randomUUID(),
    subject: randomUUID(),
    section: randomUUID(),
    session: randomUUID(),
    record: randomUUID(),
  }

  let prisma: PrismaService
  let service: AttendanceService

  const studentUser: RequestUser = {
    id: ids.student,
    role: 'student',
    email: `online-student-${ids.student.slice(0, 8)}@example.test`,
    studentId: `ONL-${ids.student.slice(0, 8)}`,
  }

  beforeAll(async () => {
    if (!databaseUrl) return
    prisma = new PrismaService()
    await prisma.$connect()

    // 1. Seed Teacher
    await prisma.user.create({
      data: {
        id: ids.teacher,
        fullName: 'Online Integration Teacher',
        password: 'hash',
        authEmail: `teacher-${ids.teacher.slice(0, 8)}@example.test`,
        email: `teacher-${ids.teacher.slice(0, 8)}@example.test`,
        role: 'teacher',
        teacherPublicKey: teacherKeys.publicKey,
      },
    })

    // 2. Seed Student
    await prisma.user.create({
      data: {
        id: ids.student,
        fullName: 'Online Integration Student',
        password: 'hash',
        authEmail: `student-${ids.student.slice(0, 8)}@example.test`,
        email: `student-${ids.student.slice(0, 8)}@example.test`,
        role: 'student',
        studentId: `ONL-${ids.student.slice(0, 8)}`,
        program: 'BSIT',
        yearLevel: 2,
        department: 'CCIS',
      },
    })

    // 3. Seed Subject & Section
    await prisma.subject.create({
      data: {
        id: ids.subject,
        name: 'Online Dual Checkpoint Subject',
        code: `ONL-${ids.subject.slice(0, 6)}`,
      },
    })
    await prisma.section.create({
      data: {
        id: ids.section,
        subjectId: ids.subject,
        section: 'ONL-1',
        room: 'Online Virtual',
        semester: '2026-1',
        teacherId: ids.teacher,
      },
    })

    // 4. Enroll Student
    await prisma.enrollment.create({
      data: {
        id: randomUUID(),
        sectionId: ids.section,
        studentId: ids.student,
      },
    })

    // 5. Seed Online Session (initially active with start checkpoint armed)
    await prisma.session.create({
      data: {
        id: ids.session,
        sectionId: ids.section,
        teacherId: ids.teacher,
        subjectName: 'Online Dual Checkpoint Subject',
        date: '2026-11-14',
        startTime: '08:00',
        endTime: '10:00',
        mode: 'online',
        isActive: true,
        qrValidityMinutes: 15,
        gracePeriodMinutes: 15,
        startQrValiditySeconds: 900,
        startGraceMinutes: 15,
        endQrValiditySeconds: 900,
        endGraceMinutes: 0,
      },
    })

    // 6. Seed initial AttendanceRecord for Student (pending)
    await prisma.attendanceRecord.create({
      data: {
        id: ids.record,
        sessionId: ids.session,
        sectionId: ids.section,
        studentId: ids.student,
        studentName: 'Online Integration Student',
        timestamp: new Date(),
        status: 'pending',
      },
    })

    // Build AttendanceService with real Prisma and mock peripherals
    const mockRedis = {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      acquireLock: jest.fn().mockResolvedValue('probe-lock-token'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    }
    const mockRealtime = {
      emitAttendanceUpdated: jest.fn(),
      emitSessionStudentScanned: jest.fn(),
    }
    const geofence = new GeofenceService(prisma)
    const scanValidator = new ScanValidatorService(prisma, mockRedis as never, geofence)
    const scope = new AttendanceScopeService(prisma)
    const reportService = new AttendanceReportService(prisma, scope)
    const ledger = new LedgerService(prisma)

    service = new AttendanceService(
      prisma,
      mockRealtime as never,
      mockRedis as never,
      scanValidator,
      scope,
      reportService,
      geofence,
      ledger,
    )
  })

  afterAll(async () => {
    if (!databaseUrl || !prisma) return
    await prisma.attendanceRecord.deleteMany({ where: { sessionId: ids.session } })
    await prisma.scanAttempt.deleteMany({ where: { sessionId: ids.session } })
    await prisma.session.deleteMany({ where: { id: ids.session } })
    await prisma.enrollment.deleteMany({ where: { sectionId: ids.section } })
    await prisma.section.deleteMany({ where: { id: ids.section } })
    await prisma.subject.deleteMany({ where: { id: ids.subject } })
    await prisma.user.deleteMany({ where: { id: { in: [ids.teacher, ids.student] } } })
    await prisma.$disconnect()
  })

  it('records checkInTime and checkInStatus on start scan, then checkOutTime and checkOutStatus on end scan in the real database', async () => {
    // ── Checkpoint 1: Start Check-in Scan ──
    const startToken = signQRToken(
      {
        version: 1,
        sessionId: ids.session,
        sectionId: ids.section,
        teacherId: ids.teacher,
        teacherName: 'Online Integration Teacher',
        issuedAt: Date.now(),
        validityMinutes: 15,
        gracePeriodMinutes: 15,
        mode: 'online',
        checkpoint: 'start',
        validitySeconds: 300,
        pinRequired: false,
      },
      teacherKeys.secretKey,
    )

    // Arm start checkpoint in database
    await prisma.session.update({
      where: { id: ids.session },
      data: {
        startQrToken: startToken,
        startTokenExpiresAt: new Date(Date.now() + 600_000),
        startQrGeneratedAt: new Date(),
      },
    })

    const startScanResult = (await service.scan(studentUser, {
      sessionId: ids.session,
      deviceId: 'device-online-1',
      clientAttemptId: randomUUID(),
      qrToken: startToken,
      inputChannel: 'camera',
    })) as any

    expect(startScanResult).toBeDefined()
    expect(startScanResult.error).toBeUndefined()

    // Verify row state in PostgreSQL after start scan
    const rowAfterStart = await prisma.attendanceRecord.findUniqueOrThrow({
      where: { id: ids.record },
    })
    expect(rowAfterStart.checkInTime).toBeInstanceOf(Date)
    expect(rowAfterStart.checkInStatus).toBe('present')
    expect(rowAfterStart.checkInToken).toBe(startToken)
    expect(rowAfterStart.checkOutTime).toBeNull()
    expect(rowAfterStart.checkOutStatus).toBeNull()
    expect(rowAfterStart.latitude).toBeNull()
    expect(rowAfterStart.longitude).toBeNull()

    // ── Checkpoint 2: End Check-out Scan ──
    const endToken = signQRToken(
      {
        version: 1,
        sessionId: ids.session,
        sectionId: ids.section,
        teacherId: ids.teacher,
        teacherName: 'Online Integration Teacher',
        issuedAt: Date.now(),
        validityMinutes: 15,
        gracePeriodMinutes: 0,
        mode: 'online',
        checkpoint: 'end',
        validitySeconds: 300,
        pinRequired: false,
      },
      teacherKeys.secretKey,
    )

    // Arm end checkpoint in database
    await prisma.session.update({
      where: { id: ids.session },
      data: {
        endQrToken: endToken,
        endTokenExpiresAt: new Date(Date.now() + 600_000),
        endQrGeneratedAt: new Date(),
        endGraceMinutes: 0,
      },
    })

    const endScanResult = (await service.scan(studentUser, {
      sessionId: ids.session,
      deviceId: 'device-online-1',
      clientAttemptId: randomUUID(),
      qrToken: endToken,
      inputChannel: 'camera',
    })) as any

    expect(endScanResult).toBeDefined()
    expect(endScanResult.error).toBeUndefined()

    // Verify row state in PostgreSQL after end scan: both checkpoints recorded!
    const rowAfterEnd = await prisma.attendanceRecord.findUniqueOrThrow({
      where: { id: ids.record },
    })
    expect(rowAfterEnd.checkInTime).toBeInstanceOf(Date)
    expect(rowAfterEnd.checkInStatus).toBe('present')
    expect(rowAfterEnd.checkInToken).toBe(startToken)
    expect(rowAfterEnd.checkOutTime).toBeInstanceOf(Date)
    expect(rowAfterEnd.checkOutStatus).toBe('present')
    expect(rowAfterEnd.checkOutToken).toBe(endToken)
  })
})
