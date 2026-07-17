import 'dotenv/config'
import { PrismaClient, UserRole, DayOfWeek, AttendanceStatus, SectionRoleType } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true only for an intentional bootstrap.')
  }
  const seedPassword = process.env.SEED_PASSWORD
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('SEED_PASSWORD must be set to at least 12 characters')
  }
  const password = await hash(seedPassword, 12)

  // ── Users ──
  const users = [
    {
      id: 's-admin-001',
      fullName: 'Dr. Maria Concepcion Reyes',
      email: 'mcreyes@pup.edu.ph',
      password,
      role: UserRole.super_admin,
      department: 'CCIS',
      scope: 'institution',
    },
    {
      id: 't-001',
      fullName: 'Prof. Juan Miguel Dela Cruz',
      email: 'jmdelacruz@pup.edu.ph',
      password,
      role: UserRole.teacher,
      department: 'CCIS',
    },
    {
      id: 't-002',
      fullName: 'Prof. Maria Elena Santos',
      email: 'mesantos@pup.edu.ph',
      password,
      role: UserRole.teacher,
      department: 'CCIS',
    },
    {
      id: 's-001',
      studentId: '2024-00001-MN-0',
      fullName: 'Alexandra Marie Reyes',
      email: 'amreyes@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-002',
      studentId: '2024-00002-MN-0',
      fullName: 'Benjamin Lucas Santos',
      email: 'blsantos@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-003',
      studentId: '2024-00003-MN-0',
      fullName: 'Camille Andrea Villanueva',
      email: 'cavillanueva@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-004',
      studentId: '2024-00004-MN-0',
      fullName: 'Daniel Joseph Cruz',
      email: 'djcruz@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-005',
      studentId: '2024-00005-MN-0',
      fullName: 'Erika Mae Gonzales',
      email: 'emgonzales@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-006',
      studentId: '2024-00006-MN-0',
      fullName: 'Francis Dominic Reyes',
      email: 'fdreyes@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-007',
      studentId: '2024-00007-MN-0',
      fullName: 'Gabriella Sofia Mendoza',
      email: 'gsmendoza@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
    {
      id: 's-008',
      studentId: '2024-00008-MN-0',
      fullName: 'Henry William Tan',
      email: 'hwtan@iskolar.pup.edu.ph',
      password,
      role: UserRole.student,
      program: 'BS Computer Science',
      yearLevel: 2,
    },
  ]

  for (const user of users) {
    const { password: _password, ...profile } = user
    await prisma.user.upsert({ where: { id: user.id }, update: profile, create: user })
  }

  // ── Subjects ──
  const subjects = [
    {
      id: 'subj-001',
      name: 'Software Engineering',
      code: 'CCIS 3104',
      description:
        'Principles and practices of software engineering, including requirements, design, testing, and project management.',
    },
    {
      id: 'subj-002',
      name: 'Data Structures and Algorithms',
      code: 'CCIS 3102',
      description:
        'Study of fundamental data structures and algorithms, including arrays, linked lists, trees, graphs, and sorting.',
    },
    {
      id: 'subj-003',
      name: 'Human-Computer Interaction',
      code: 'CCIS 3106',
      description: 'Design, implementation, and evaluation of interactive computing systems for human use.',
    },
    {
      id: 'subj-004',
      name: 'Programming Languages',
      code: 'CCIS 3108',
      description:
        'Comparative study of programming language paradigms, including procedural, object-oriented, functional, and logic.',
    },
  ]

  for (const s of subjects) {
    await prisma.subject.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // ── Sections ──
  const sections = [
    {
      id: 'sec-001',
      subjectId: 'subj-001',
      section: 'A',
      room: 'CCIS Lab 3',
      semester: '2nd Semester AY 2025-2026',
      teacherId: 't-001',
      enrollmentCode: 'SE2026',
      enrollmentCodeExpiry: new Date('2026-02-15T23:59:59Z'),
      studentCount: 6,
    },
    {
      id: 'sec-002',
      subjectId: 'subj-001',
      section: 'B',
      room: 'CCIS Lecture 1',
      semester: '2nd Semester AY 2025-2026',
      teacherId: 't-001',
      enrollmentCode: 'SEB2026',
      enrollmentCodeExpiry: new Date('2026-02-15T23:59:59Z'),
      studentCount: 6,
    },
    {
      id: 'sec-003',
      subjectId: 'subj-002',
      section: 'A',
      room: 'CCIS Lecture 2',
      semester: '2nd Semester AY 2025-2026',
      teacherId: 't-001',
      enrollmentCode: 'DSA2026',
      enrollmentCodeExpiry: new Date('2026-02-15T23:59:59Z'),
      studentCount: 5,
    },
    {
      id: 'sec-004',
      subjectId: 'subj-003',
      section: 'A',
      room: 'CCIS Lab 1',
      semester: '2nd Semester AY 2025-2026',
      teacherId: 't-002',
      enrollmentCode: 'HCI2026',
      enrollmentCodeExpiry: new Date('2026-02-15T23:59:59Z'),
      studentCount: 4,
    },
    {
      id: 'sec-005',
      subjectId: 'subj-004',
      section: 'A',
      room: 'CCIS Lecture 1',
      semester: '2nd Semester AY 2025-2026',
      teacherId: 't-002',
      enrollmentCode: 'PL2026',
      enrollmentCodeExpiry: new Date('2026-02-15T23:59:59Z'),
      studentCount: 3,
    },
  ]

  for (const s of sections) {
    await prisma.section.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // ── Schedule Days ──
  const schedules = [
    { sectionId: 'sec-001', day: DayOfWeek.Mon, startTime: '09:00', endTime: '10:30' },
    { sectionId: 'sec-001', day: DayOfWeek.Wed, startTime: '09:00', endTime: '10:30' },
    { sectionId: 'sec-002', day: DayOfWeek.Tue, startTime: '09:00', endTime: '10:30' },
    { sectionId: 'sec-002', day: DayOfWeek.Thu, startTime: '09:00', endTime: '10:30' },
    { sectionId: 'sec-003', day: DayOfWeek.Tue, startTime: '13:00', endTime: '14:30', room: 'CCIS Lecture 2' },
    { sectionId: 'sec-003', day: DayOfWeek.Thu, startTime: '13:00', endTime: '14:30', room: 'CCIS Lecture 2' },
    { sectionId: 'sec-004', day: DayOfWeek.Mon, startTime: '13:00', endTime: '15:00', room: 'AVR' },
    { sectionId: 'sec-004', day: DayOfWeek.Fri, startTime: '10:00', endTime: '12:00', room: 'CCIS Lab 1' },
    { sectionId: 'sec-005', day: DayOfWeek.Wed, startTime: '13:00', endTime: '14:30', room: 'COM LAB 1' },
    { sectionId: 'sec-005', day: DayOfWeek.Fri, startTime: '13:00', endTime: '14:30', room: 'Room 205' },
  ]

  await prisma.scheduleDay.deleteMany({ where: { sectionId: { in: sections.map((section) => section.id) } } })
  await prisma.scheduleDay.createMany({ data: schedules })

  // ── Sessions ──
  const sessions = [
    {
      id: 'sess-001',
      sectionId: 'sec-001',
      teacherId: 't-001',
      subjectName: 'Software Engineering',
      date: '2026-06-16',
      startTime: '09:00',
      endTime: '10:30',
      room: 'CCIS Lab 3',
      qrValidityMinutes: 20,
      gracePeriodMinutes: 15,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 40,
      isActive: false,
    },
    {
      id: 'sess-002',
      sectionId: 'sec-001',
      teacherId: 't-001',
      subjectName: 'Software Engineering',
      date: '2026-06-18',
      startTime: '09:00',
      endTime: '10:30',
      qrValidityMinutes: 20,
      gracePeriodMinutes: 15,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 40,
      isActive: false,
    },
    {
      id: 'sess-003',
      sectionId: 'sec-003',
      teacherId: 't-001',
      subjectName: 'Data Structures and Algorithms',
      date: '2026-06-17',
      startTime: '13:00',
      endTime: '14:30',
      qrValidityMinutes: 15,
      gracePeriodMinutes: 10,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 50,
      isActive: false,
    },
    {
      id: 'sess-004',
      sectionId: 'sec-004',
      teacherId: 't-002',
      subjectName: 'Human-Computer Interaction',
      date: '2026-06-16',
      startTime: '13:00',
      endTime: '15:00',
      room: 'AVR',
      qrValidityMinutes: 30,
      gracePeriodMinutes: 15,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 30,
      isActive: false,
    },
    {
      id: 'sess-005',
      sectionId: 'sec-004',
      teacherId: 't-002',
      subjectName: 'Human-Computer Interaction',
      date: '2026-06-19',
      startTime: '10:00',
      endTime: '12:00',
      qrValidityMinutes: 20,
      gracePeriodMinutes: 15,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 30,
      isActive: false,
    },
    {
      id: 'sess-006',
      sectionId: 'sec-005',
      teacherId: 't-002',
      subjectName: 'Programming Languages',
      date: '2026-06-18',
      startTime: '13:00',
      endTime: '14:30',
      room: 'COM LAB 1',
      qrValidityMinutes: 20,
      gracePeriodMinutes: 10,
      geofenceLatitude: 14.5833,
      geofenceLongitude: 120.9769,
      geofenceRadiusMeters: 40,
      isActive: false,
    },
  ]

  for (const s of sessions) {
    await prisma.session.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // ── Enrollments ──
  const enrollments = [
    { studentId: 's-001', sectionId: 'sec-001' },
    { studentId: 's-001', sectionId: 'sec-003' },
    { studentId: 's-001', sectionId: 'sec-004' },
    { studentId: 's-002', sectionId: 'sec-001' },
    { studentId: 's-002', sectionId: 'sec-003' },
    { studentId: 's-002', sectionId: 'sec-005' },
    { studentId: 's-003', sectionId: 'sec-001' },
    { studentId: 's-003', sectionId: 'sec-004' },
    { studentId: 's-003', sectionId: 'sec-005' },
    { studentId: 's-004', sectionId: 'sec-001' },
    { studentId: 's-004', sectionId: 'sec-003' },
    { studentId: 's-004', sectionId: 'sec-004' },
    { studentId: 's-005', sectionId: 'sec-001' },
    { studentId: 's-005', sectionId: 'sec-003' },
    { studentId: 's-005', sectionId: 'sec-004' },
    { studentId: 's-006', sectionId: 'sec-003' },
    { studentId: 's-006', sectionId: 'sec-004' },
    { studentId: 's-006', sectionId: 'sec-005' },
    { studentId: 's-007', sectionId: 'sec-001' },
    { studentId: 's-007', sectionId: 'sec-004' },
    { studentId: 's-007', sectionId: 'sec-005' },
    { studentId: 's-008', sectionId: 'sec-001' },
    { studentId: 's-008', sectionId: 'sec-003' },
    { studentId: 's-008', sectionId: 'sec-005' },
  ]

  // Upsert by the unique constraint [studentId, sectionId]
  for (const e of enrollments) {
    const existing = await prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: e.studentId, sectionId: e.sectionId } },
    })
    if (!existing) {
      await prisma.enrollment.create({ data: e })
    }
  }

  // ── Attendance Records ──
  const records = [
    {
      id: 'a-001',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-001',
      studentName: 'Alexandra Marie Reyes',
      timestamp: new Date('2026-06-16T09:05:00Z'),
      status: AttendanceStatus.present,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-16T09:05:10Z'),
    },
    {
      id: 'a-002',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-002',
      studentName: 'Benjamin Lucas Santos',
      timestamp: new Date('2026-06-16T09:10:00Z'),
      status: AttendanceStatus.present,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-16T09:10:05Z'),
    },
    {
      id: 'a-003',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-003',
      studentName: 'Camille Andrea Villanueva',
      timestamp: new Date('2026-06-16T09:30:00Z'),
      status: AttendanceStatus.late,
      latitude: 14.5832,
      longitude: 120.977,
      isSynced: true,
      syncedAt: new Date('2026-06-16T09:30:05Z'),
    },
    {
      id: 'a-004',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-004',
      studentName: 'Daniel Joseph Cruz',
      timestamp: new Date('2026-06-16T10:00:00Z'),
      status: AttendanceStatus.absent,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-16T10:00:05Z'),
    },
    {
      id: 'a-005',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-005',
      studentName: 'Erika Mae Gonzales',
      timestamp: new Date('2026-06-16T09:02:00Z'),
      status: AttendanceStatus.present,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-16T09:02:05Z'),
    },
    {
      id: 'a-006',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-007',
      studentName: 'Gabriella Sofia Mendoza',
      timestamp: new Date('2026-06-16T09:25:00Z'),
      status: AttendanceStatus.late,
      latitude: 14.5834,
      longitude: 120.9771,
      isSynced: true,
      syncedAt: new Date('2026-06-16T09:25:05Z'),
    },
    {
      id: 'a-007',
      sessionId: 'sess-001',
      sectionId: 'sec-001',
      studentId: 's-008',
      studentName: 'Henry William Tan',
      timestamp: new Date('2026-06-16T08:58:00Z'),
      status: AttendanceStatus.present,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-16T08:58:10Z'),
    },
    {
      id: 'a-008',
      sessionId: 'sess-002',
      sectionId: 'sec-001',
      studentId: 's-001',
      studentName: 'Alexandra Marie Reyes',
      timestamp: new Date('2026-06-18T09:03:00Z'),
      status: AttendanceStatus.present,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-18T09:03:10Z'),
    },
    {
      id: 'a-009',
      sessionId: 'sess-002',
      sectionId: 'sec-001',
      studentId: 's-002',
      studentName: 'Benjamin Lucas Santos',
      timestamp: new Date('2026-06-18T09:35:00Z'),
      status: AttendanceStatus.late,
      latitude: 14.5833,
      longitude: 120.9769,
      isSynced: true,
      syncedAt: new Date('2026-06-18T09:35:05Z'),
    },
  ]

  for (const r of records) {
    await prisma.attendanceRecord.upsert({ where: { id: r.id }, update: r, create: r })
  }

  // ── Section Roles ──
  await prisma.sectionRole.upsert({
    where: { sectionId_studentId_role: { sectionId: 'sec-001', studentId: 's-001', role: SectionRoleType.president } },
    update: {},
    create: {
      sectionId: 'sec-001',
      studentId: 's-001',
      studentName: 'Alexandra Marie Reyes',
      role: SectionRoleType.president,
      grantedBy: 't-001',
    },
  })

  console.log(
    'Seed complete: users, subjects, sections, schedules, sessions, enrollments, attendance records, section roles',
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
