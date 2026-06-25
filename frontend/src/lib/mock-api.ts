import {
  mockUsers,
  mockTeachers,
  mockStudents,
  mockSubjects,
  mockSections,
  mockEnrollments,
  mockSessions,
  mockAttendanceRecords,
  mockAttendanceSummaries,
  mockSuperAdmin,
  mockSectionRoles,
  mockSessionPermissions,
  mockProofsOfClass,
} from '@polycheck/shared/mock'

import type {
  User,
  Student,
  Teacher,
  Subject,
  Section,
  Session,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceStatus,
  Enrollment,
  CalendarEvent,
  BulkSessionInput,
  DisputeInput,
  SectionRole,
  SectionRoleType,
  SessionPermission,
  ProofOfClass,
} from '@polycheck/shared'

import { isWithinGeofence, createQRTokenData } from '@polycheck/shared/utils'

let currentUser: User | null = null

export const api = {
  loginStudent(studentId: string, _password: string): Student | null {
    const student = mockStudents.find((s) => s.studentId === studentId)
    if (student) {
      currentUser = student
      return student
    }
    return null
  },

  loginFaculty(email: string, _password: string): User | null {
    const teacher = mockTeachers.find((t) => t.email === email)
    if (teacher) {
      currentUser = teacher
      return teacher
    }
    if (email === mockSuperAdmin.email) {
      currentUser = mockSuperAdmin
      return mockSuperAdmin
    }
    return null
  },

  logout() {
    currentUser = null
  },

  getCurrentUser(): User | null {
    return currentUser
  },

  isStudent(): boolean {
    return currentUser?.role === 'student'
  },

  isFaculty(): boolean {
    return currentUser?.role === 'teacher' || currentUser?.role === 'super_admin'
  },

  isSuperAdmin(): boolean {
    return currentUser?.role === 'super_admin'
  },

  getStudents(): Student[] {
    return [...mockStudents]
  },

  getTeachers(): Teacher[] {
    return [...mockTeachers]
  },

  getSubjects(): Subject[] {
    return [...mockSubjects]
  },

  getSubject(id: string): Subject | undefined {
    return mockSubjects.find((s) => s.id === id)
  },

  createSubject(data: { name: string; code: string; description?: string }): Subject {
    const now = new Date().toISOString()
    const subject: Subject = { id: `subj-${Date.now()}`, ...data, createdAt: now, updatedAt: now }
    mockSubjects.push(subject)
    return subject
  },

  getSections(subjectId?: string): Section[] {
    if (subjectId) return mockSections.filter((s) => s.subjectId === subjectId)
    return [...mockSections]
  },

  getSection(id: string): Section | undefined {
    return mockSections.find((s) => s.id === id)
  },

  createSection(data: {
    subjectId: string
    section: string
    room: string
    schedule: { day: string; startTime: string; endTime: string; room?: string }[]
    semester: string
    teacherId: string
    teacherName: string
  }): Section {
    const now = new Date().toISOString()
    const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const section: Section = {
      id: `sec-${Date.now()}`,
      ...data,
      schedule: data.schedule.map((s) => ({ day: s.day as Section['schedule'][0]['day'], startTime: s.startTime, endTime: s.endTime, room: s.room })),
      enrollmentCode: '',
      enrollmentCodeExpiry: expiry,
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    mockSections.push(section)
    return section
  },

  getEnrollments(sectionId?: string): Enrollment[] {
    if (sectionId) {
      return mockEnrollments.filter((e) => e.sectionId === sectionId)
    }
    return [...mockEnrollments]
  },

  getStudentsForSection(sectionId: string): Student[] {
    const enrolledIds = mockEnrollments
      .filter((e) => e.sectionId === sectionId)
      .map((e) => e.studentId)
    return mockStudents.filter((s) => enrolledIds.includes(s.id))
  },

  getSessions(sectionId?: string): Session[] {
    if (sectionId) {
      return mockSessions.filter((s) => s.sectionId === sectionId)
    }
    return [...mockSessions]
  },

  getSession(id: string): Session | undefined {
    return mockSessions.find((s) => s.id === id)
  },

  createSession(data: {
    sectionId: string
    subjectName: string
    date: string
    startTime: string
    endTime: string
    room?: string
    qrValidityMinutes: number
    gracePeriodMinutes: number
    geofence: { latitude: number; longitude: number; radiusMeters: number }
    teacherId: string
    isRescheduled?: boolean
    rescheduledFromDate?: string
    originalScheduleTime?: string
    originalRoom?: string
  }): Session {
    const now = new Date().toISOString()
    const session: Session = {
      id: `sess-${Date.now()}`,
      ...data,
      isActive: false,
      createdAt: now,
    }
    mockSessions.push(session)
    return session
  },

  generateQrCode(sessionId: string, validityMinutes: number): Session | undefined {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session) return undefined
    const now = Date.now()
    const expiresAt = new Date(now + validityMinutes * 60 * 1000).toISOString()
    const user = currentUser
    const qrToken = createQRTokenData(
      sessionId, session.sectionId,
      user?.id ?? session.teacherId,
      user && 'fullName' in user ? (user as User).fullName : session.subjectName,
      validityMinutes,
      session.gracePeriodMinutes,
    )
    session.qrToken = qrToken
    session.qrTokenExpiresAt = expiresAt
    session.qrGeneratedAt = new Date(now).toISOString()
    session.isActive = true
    session.qrValidityMinutes = validityMinutes
    return session
  },

  getAttendanceRecords(sessionId?: string): AttendanceRecord[] {
    if (sessionId) {
      return mockAttendanceRecords.filter((r) => r.sessionId === sessionId)
    }
    return [...mockAttendanceRecords]
  },

  getAttendanceSummaries(teacherId?: string): AttendanceSummary[] {
    if (teacherId) {
      const teacherSectionIds = mockSections
        .filter((s) => s.teacherId === teacherId)
        .map((s) => s.id)
      return mockAttendanceSummaries.filter((s) => teacherSectionIds.includes(s.sectionId))
    }
    return [...mockAttendanceSummaries]
  },

  getAttendanceForStudent(studentId: string): AttendanceRecord[] {
    return mockAttendanceRecords.filter((r) => r.studentId === studentId)
  },

  getStudentSections(studentId: string): Section[] {
    const enrolledSectionIds = mockEnrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.sectionId)
    return mockSections.filter((s) => enrolledSectionIds.includes(s.id))
  },

  getStudentSubjects(studentId: string): Subject[] {
    const sections = this.getStudentSections(studentId)
    const subjectIds = [...new Set(sections.map((s) => s.subjectId))]
    return mockSubjects.filter((s) => subjectIds.includes(s.id))
  },

  getSectionStudents(sectionId: string): (Student & { attendance: { present: number; late: number; absent: number } })[] {
    const enrolledIds = mockEnrollments
      .filter((e) => e.sectionId === sectionId)
      .map((e) => e.studentId)
    const sectionSessionIds = mockSessions
      .filter((s) => s.sectionId === sectionId)
      .map((s) => s.id)
    return mockStudents
      .filter((s) => enrolledIds.includes(s.id))
      .map((student) => {
        const records = mockAttendanceRecords.filter(
          (r) => r.studentId === student.id && sectionSessionIds.includes(r.sessionId)
        )
        return {
          ...student,
          attendance: {
            present: records.filter((r) => r.status === 'present').length,
            late: records.filter((r) => r.status === 'late').length,
            absent: records.filter((r) => r.status === 'absent').length,
          },
        }
      })
  },

  getStudent(studentId: string): Student | undefined {
    return mockStudents.find((s) => s.id === studentId)
  },

  getSectionSessions(sectionId: string): Session[] {
    return mockSessions.filter((s) => s.sectionId === sectionId)
  },

  getStudentAttendanceForSection(studentId: string, sectionId: string): AttendanceRecord[] {
    const sectionSessionIds = mockSessions
      .filter((s) => s.sectionId === sectionId)
      .map((s) => s.id)
    return mockAttendanceRecords.filter(
      (r) => r.studentId === studentId && sectionSessionIds.includes(r.sessionId)
    )
  },

  updateAttendanceStatus(recordId: string, status: AttendanceStatus): AttendanceRecord | undefined {
    const record = mockAttendanceRecords.find((r) => r.id === recordId)
    if (record) {
      record.status = status
      record.timestamp = new Date().toISOString()
    }
    return record
  },

  addAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
    mockAttendanceRecords.push(record)
    return record
  },

  removeStudentFromSection(sectionId: string, studentId: string): boolean {
    const idx = mockEnrollments.findIndex(
      (e) => e.sectionId === sectionId && e.studentId === studentId
    )
    if (idx === -1) return false
    mockEnrollments.splice(idx, 1)
    const section = mockSections.find((s) => s.id === sectionId)
    if (section) section.studentCount = Math.max(0, section.studentCount - 1)
    return true
  },

  resetEnrollmentCode(sectionId: string): string {
    const section = mockSections.find((s) => s.id === sectionId)
    if (!section) return ''
    const prefix = mockSubjects.find((s) => s.id === section.subjectId)?.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 4) ?? 'CODE'
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const newCode = `${prefix}${suffix}`
    section.enrollmentCode = newCode
    section.enrollmentCodeExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    return newCode
  },

  disableEnrollmentCode(sectionId: string): void {
    const section = mockSections.find((s) => s.id === sectionId)
    if (section) {
      section.enrollmentCode = ''
      section.enrollmentCodeExpiry = new Date(0).toISOString()
    }
  },

  submitAttendance(
    sessionId: string,
    sectionId: string,
    studentId: string,
    coordinates: { latitude: number; longitude: number },
    _deviceId: string
  ): { success: boolean; status: AttendanceStatus; reason?: string } {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session) return { success: false, status: 'absent', reason: 'Session not found' }
    if (!session.isActive) return { success: false, status: 'absent', reason: 'Session is not active' }

    const inRange = isWithinGeofence(
      coordinates.latitude,
      coordinates.longitude,
      session.geofence.latitude,
      session.geofence.longitude,
      session.geofence.radiusMeters
    )
    if (!inRange) {
      return {
        success: false,
        status: 'absent',
        reason: `Outside geofence (${session.geofence.radiusMeters}m from classroom)`,
      }
    }

    if (session.qrTokenExpiresAt) {
      const qrExpiry = new Date(session.qrTokenExpiresAt).getTime()
      const now = Date.now()
      if (now <= qrExpiry) {
        return { success: true, status: 'present' }
      }
      const graceEnd = qrExpiry + session.gracePeriodMinutes * 60 * 1000
      if (now <= graceEnd) {
        return { success: true, status: 'late', reason: 'You are late but within grace period.' }
      }
      return { success: false, status: 'absent', reason: 'QR token expired and grace period has passed.' }
    }

    return { success: true, status: 'present' }
  },

  endSession(sessionId: string): Session | undefined {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session) return undefined
    session.isActive = false
    const sessionRecords = mockAttendanceRecords.filter(
      (r) => r.sessionId === sessionId && r.status === 'pending'
    )
    for (const record of sessionRecords) {
      record.status = 'absent'
    }
    return session
  },

  getDisputedRecords(sessionId?: string, filters?: { search?: string; status?: 'pending' | 'resolved' | 'all' }): AttendanceRecord[] {
    const statusFilter = filters?.status ?? 'pending'
    let records = mockAttendanceRecords

    if (statusFilter === 'pending') {
      records = records.filter((r) => r.status === 'disputed')
    } else if (statusFilter === 'resolved') {
      records = records.filter((r) => r.disputeResolved === true)
    } else if (statusFilter === 'all') {
      records = records.filter((r) => r.status === 'disputed' || r.disputeResolved === true)
    }

    if (sessionId) {
      records = records.filter((r) => r.sessionId === sessionId)
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      records = records.filter((r) => 
        r.studentName.toLowerCase().includes(searchLower) ||
        r.studentId.toLowerCase().includes(searchLower)
      )
    }

    return records
  },

  resolveDispute(recordId: string, resolution: 'accept' | 'reject' | 'override', newStatus?: AttendanceStatus): AttendanceRecord | undefined {
    const record = mockAttendanceRecords.find((r) => r.id === recordId)
    if (!record || record.status !== 'disputed') return undefined

    record.disputeResolved = true

    if (resolution === 'accept') {
      record.status = 'present'
    } else if (resolution === 'reject') {
      record.status = 'absent'
    } else if (resolution === 'override' && newStatus) {
      record.status = newStatus
      record.manuallySet = true
    }
    return record
  },

  enrollStudent(data: { sectionId: string; studentId: string; studentName: string }): boolean {
    const exists = mockEnrollments.find(e => e.sectionId === data.sectionId && e.studentId === data.studentId)
    if (exists) return false

    const enrollment: Enrollment = {
      id: `e-${Date.now()}`,
      studentId: data.studentId,
      sectionId: data.sectionId,
      enrolledAt: new Date().toISOString(),
    }
    mockEnrollments.push(enrollment)

    const section = mockSections.find(s => s.id === data.sectionId)
    if (section) section.studentCount++

    return true
  },

  getCalendarEvents(userId: string, startDate: string, endDate: string): CalendarEvent[] {
    const events: CalendarEvent[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    const userSections = mockSections.filter(s => s.teacherId === userId ||
      mockEnrollments.filter(e => e.studentId === userId).some(e => e.sectionId === s.id))

    for (const section of userSections) {
      const subject = mockSubjects.find(s => s.id === section.subjectId)
      const sectionSessions = mockSessions.filter(s => s.sectionId === section.id)

      let cursor = new Date(start)
      while (cursor <= end) {
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][cursor.getDay()]
        for (const sched of section.schedule) {
          if (sched.day === dayName) {
            const dateStr = cursor.toISOString().split('T')[0]
            const existingSession = sectionSessions.find(ss => ss.date === dateStr)
            events.push({
              id: `cal-${section.id}-${dateStr}-${sched.day}`,
              title: subject?.name ?? 'Unknown',
              date: dateStr,
              startTime: sched.startTime,
              endTime: sched.endTime,
              room: sched.room,
              sectionId: section.id,
              subjectName: subject?.name ?? 'Unknown',
              sectionName: section.section,
              type: existingSession ? 'session' : 'schedule',
              status: existingSession?.isActive ? 'active' : existingSession ? 'completed' : undefined,
            })
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    return events
  },

  createBulkSessions(data: BulkSessionInput): Session[] {
    const created: Session[] = []
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
    const targetDays = data.daysOfWeek.map(d => dayMap[d])

    let cursor = new Date(start)
    while (cursor <= end) {
      if (targetDays.includes(cursor.getDay())) {
        const now = new Date().toISOString()
        const session: Session = {
          id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          sectionId: data.sectionId,
          subjectName: data.subjectName,
          date: cursor.toISOString().split('T')[0],
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
          qrValidityMinutes: data.qrValidityMinutes,
          gracePeriodMinutes: data.gracePeriodMinutes,
          geofence: data.geofence,
          isActive: false,
          teacherId: data.teacherId,
          createdAt: now,
        }
        mockSessions.push(session)
        created.push(session)
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    return created
  },

  exportAttendanceCsv(sectionId?: string, _sessionId?: string): string {
    let records = [...mockAttendanceRecords]
    if (sectionId) records = records.filter(r => r.sectionId === sectionId)

    const header = 'ID,Student Name,Student ID,Date,Time,Status,Section,Session ID,Disputed,Notes'
    const rows = records.map(r => {
      const session = mockSessions.find(s => s.id === r.sessionId)
      const date = r.timestamp.split('T')[0]
      const time = r.timestamp.split('T')[1]?.slice(0, 5) ?? ''
      const section = mockSections.find(s => s.id === r.sectionId)
      return `${r.id},"${r.studentName}",${r.studentId},${date},${time},${r.status},${section?.section ?? ''},${r.sessionId},${r.status === 'disputed' ? 'Yes' : 'No'},"${r.notes ?? ''}"`
    })

    return [header, ...rows].join('\n')
  },

  submitDispute(data: DisputeInput): AttendanceRecord | undefined {
    const record = mockAttendanceRecords.find(r => r.id === data.recordId)
    if (!record) return undefined
    if (record.status === 'disputed') return record
    record.status = 'disputed'
    record.disputeReason = data.reason as any
    record.notes = data.description
    return record
  },

  // Section Roles
  mutableSectionRoles: [...mockSectionRoles],
  mutableSessionPermissions: [...mockSessionPermissions],
  mutableProofsOfClass: [...mockProofsOfClass],

  assignSectionRole(sectionId: string, studentId: string, role: SectionRoleType): SectionRole {
    const existing = this.mutableSectionRoles.find(
      (r) => r.sectionId === sectionId && r.studentId === studentId && r.role === role
    )
    if (existing) return existing
    const student = mockStudents.find((s) => s.id === studentId)
    const sr: SectionRole = {
      id: `sr-${Date.now()}`,
      sectionId,
      studentId,
      studentName: student?.fullName ?? 'Unknown',
      role,
      grantedBy: currentUser?.id ?? '',
      grantedAt: new Date().toISOString(),
    }
    this.mutableSectionRoles.push(sr)
    return sr
  },

  removeSectionRole(sectionId: string, studentId: string, role: SectionRoleType): boolean {
    const idx = this.mutableSectionRoles.findIndex(
      (r) => r.sectionId === sectionId && r.studentId === studentId && r.role === role
    )
    if (idx === -1) return false
    this.mutableSectionRoles.splice(idx, 1)
    return true
  },

  getSectionRoles(sectionId: string): SectionRole[] {
    return this.mutableSectionRoles.filter((r) => r.sectionId === sectionId)
  },

  getStudentRoles(studentId: string): SectionRole[] {
    return this.mutableSectionRoles.filter((r) => r.studentId === studentId)
  },

  // Session Permissions
  grantSessionPermission(sectionId: string, studentId: string): SessionPermission {
    const existing = this.mutableSessionPermissions.find(
      (p) => p.sectionId === sectionId && p.studentId === studentId && p.isActive
    )
    if (existing) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      existing.expiresAt = expiresAt
      existing.isActive = true
      existing.grantedAt = new Date().toISOString()
      return existing
    }
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const sp: SessionPermission = {
      id: `sp-${Date.now()}`,
      sectionId,
      studentId,
      grantedBy: currentUser?.id ?? '',
      grantedAt: now.toISOString(),
      expiresAt,
      isActive: true,
    }
    this.mutableSessionPermissions.push(sp)
    return sp
  },

  revokeSessionPermission(sectionId: string, studentId: string): boolean {
    const perm = this.mutableSessionPermissions.find(
      (p) => p.sectionId === sectionId && p.studentId === studentId && p.isActive
    )
    if (!perm) return false
    perm.isActive = false
    return true
  },

  checkSessionPermission(sectionId: string, studentId: string): boolean {
    const perm = this.mutableSessionPermissions.find(
      (p) => p.sectionId === sectionId && p.studentId === studentId && p.isActive
    )
    if (!perm) return false
    return Date.now() < new Date(perm.expiresAt).getTime()
  },

  getActiveSessionPermissions(sectionId: string): SessionPermission[] {
    return this.mutableSessionPermissions.filter(
      (p) => p.sectionId === sectionId && p.isActive && Date.now() < new Date(p.expiresAt).getTime()
    )
  },

  // Proof of Class
  uploadProofOfClass(data: { sectionId: string; sessionId: string; photoData: string; description?: string; uploadedBy: string; uploadedByStudentName: string }): ProofOfClass {
    const poc: ProofOfClass = {
      id: `poc-${Date.now()}`,
      sectionId: data.sectionId,
      sessionId: data.sessionId,
      uploadedBy: data.uploadedBy,
      uploadedByStudentName: data.uploadedByStudentName,
      photoData: data.photoData,
      uploadedAt: new Date().toISOString(),
      description: data.description,
    }
    this.mutableProofsOfClass.push(poc)
    return poc
  },

  getProofsOfClass(sessionId: string): ProofOfClass[] {
    return this.mutableProofsOfClass.filter((p) => p.sessionId === sessionId)
  },

  deleteProofOfClass(proofId: string): boolean {
    const idx = this.mutableProofsOfClass.findIndex((p) => p.id === proofId)
    if (idx === -1) return false
    this.mutableProofsOfClass.splice(idx, 1)
    return true
  },

  search(query: string): { students: Student[]; sections: Section[]; sessions: Session[] } {
    if (!query.trim()) return { students: [], sections: [], sessions: [] }
    const q = query.toLowerCase().trim()
    const students = mockStudents.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    ).slice(0, 10)
    const subjects = mockSubjects
    const sections = mockSections.filter((s) => {
      const subj = subjects.find((sub) => sub.id === s.subjectId)
      return (
        subj?.name.toLowerCase().includes(q) ||
        subj?.code.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q) ||
        s.room?.toLowerCase().includes(q)
      )
    }).slice(0, 8)
    const sessions = mockSessions.filter((s) =>
      s.subjectName.toLowerCase().includes(q) ||
      s.date.includes(q)
    ).slice(0, 8)
    return { students, sections, sessions }
  },
}
