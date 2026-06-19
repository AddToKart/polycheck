import {
  mockUsers,
  mockSubjects,
  mockSections,
  mockSessions,
  mockAttendanceRecords,
  mockStudents,
  mockEnrollments,
  mockTeachers,
  mockAttendanceSummaries,
} from '@polycheck/shared/mock'
import { isWithinGeofence, isTokenInValidityWindow, createQRTokenData, decodeTokenPayload } from '@polycheck/shared/utils'
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
} from '@polycheck/shared'

let currentUser: User | null = null

export const api = {
  loginStudent(studentId: string): User | null {
    const user = mockStudents.find((s) => s.studentId === studentId)
    if (user) {
      currentUser = user
      return user
    }
    return null
  },

  loginFaculty(email: string): User | null {
    const user = mockUsers.find((u) => u.email === email && (u.role === 'teacher' || u.role === 'super_admin'))
    if (user) {
      currentUser = user
      return user
    }
    return null
  },

  login(studentId: string): User | null {
    return this.loginStudent(studentId)
  },

  logout() {
    currentUser = null
  },

  getCurrentUser(): User | null {
    return currentUser
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

  getSessions(): Session[] {
    return mockSessions
  },

  getSession(sessionId: string): Session | undefined {
    return mockSessions.find((s) => s.id === sessionId)
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

  getStudents(): Student[] {
    return mockStudents
  },

  getTeachers(): Teacher[] {
    return mockTeachers
  },

  getMyAttendance(studentId: string): AttendanceRecord[] {
    return mockAttendanceRecords.filter((r) => r.studentId === studentId)
  },

  getMySubjects(studentId: string): Subject[] {
    const enrolledSectionIds = mockEnrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.sectionId)
    const subjectIds = mockSections
      .filter((s) => enrolledSectionIds.includes(s.id))
      .map((s) => s.subjectId)
    return mockSubjects.filter((s) => subjectIds.includes(s.id))
  },

  getStudentSections(studentId: string): Section[] {
    const enrolledSectionIds = mockEnrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.sectionId)
    return mockSections.filter((s) => enrolledSectionIds.includes(s.id))
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

  addAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
    mockAttendanceRecords.push(record)
    return record
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

  checkAttendance(
    sessionId: string,
    studentId: string,
    lat: number,
    lon: number,
  ): { success: boolean; status: AttendanceStatus; message?: string } {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session)
      return { success: false, status: 'absent', message: 'Session not found' }
    if (!session.isActive)
      return { success: false, status: 'absent', message: 'Session is not active' }

    const inRange = isWithinGeofence(
      lat,
      lon,
      session.geofence.latitude,
      session.geofence.longitude,
      session.geofence.radiusMeters,
    )
    if (!inRange)
      return {
        success: false,
        status: 'absent',
        message: `You are outside the ${session.geofence.radiusMeters}m geofence`,
      }

    if (!session.qrTokenExpiresAt) {
      return { success: true, status: 'present', message: 'Check-in successful!' }
    }

    const qrExpiry = new Date(session.qrTokenExpiresAt).getTime()
    const now = Date.now()
    if (now <= qrExpiry) {
      return { success: true, status: 'present', message: 'Check-in successful!' }
    }

    const graceEnd = qrExpiry + session.gracePeriodMinutes * 60 * 1000
    if (now <= graceEnd) {
      return { success: true, status: 'late', message: 'You are late but within grace period.' }
    }

    return { success: false, status: 'absent', message: 'QR token expired and grace period has passed.' }
  },

  submitScan(
    sessionId: string,
    studentId: string,
    studentName: string,
    lat: number,
    lon: number,
    deviceId: string,
  ): AttendanceRecord | { error: string } {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session) return { error: 'Session not found' }

    const check = this.checkAttendance(sessionId, studentId, lat, lon)
    if (!check.success) return { error: check.message ?? 'Check-in rejected' }

    const existing = mockAttendanceRecords.find(
      (r) => r.sessionId === sessionId && r.studentId === studentId
    )
    if (existing) {
      existing.status = check.status
      existing.timestamp = new Date().toISOString()
      existing.coordinates = { latitude: lat, longitude: lon }
      return existing
    }

    const record: AttendanceRecord = {
      id: `a-${Date.now()}`,
      sessionId,
      sectionId: session.sectionId,
      studentId,
      studentName,
      timestamp: new Date().toISOString(),
      status: check.status,
      coordinates: { latitude: lat, longitude: lon },
      deviceId,
      isSynced: true,
      syncedAt: new Date().toISOString(),
    }
    mockAttendanceRecords.push(record)
    return record
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

  getDisputedRecords(sessionId?: string): AttendanceRecord[] {
    const disputed = mockAttendanceRecords.filter((r) => r.status === 'disputed')
    if (sessionId) return disputed.filter((r) => r.sessionId === sessionId)
    return disputed
  },

  resolveDispute(recordId: string, resolution: 'accept' | 'reject' | 'override', newStatus?: AttendanceStatus): AttendanceRecord | undefined {
    const record = mockAttendanceRecords.find((r) => r.id === recordId)
    if (!record || record.status !== 'disputed') return undefined

    if (resolution === 'accept') {
      record.status = 'present'
      record.disputeReason = undefined
      record.notes = record.notes ? `${record.notes}; Dispute accepted` : 'Dispute accepted'
    } else if (resolution === 'reject') {
      record.status = 'absent'
      record.disputeReason = undefined
      record.notes = record.notes ? `${record.notes}; Dispute rejected` : 'Dispute rejected'
    } else if (resolution === 'override' && newStatus) {
      record.status = newStatus
      record.disputeReason = undefined
      record.manuallySet = true
      record.notes = record.notes ? `${record.notes}; Dispute overridden to ${newStatus}` : `Dispute overridden to ${newStatus}`
    }
    return record
  },
}
