import {
  mockUsers,
  mockSubjects,
  mockSessions,
  mockAttendanceRecords,
  mockStudents,
  mockEnrollments,
  mockTeachers,
  mockAttendanceSummaries,
} from '@polycheck/shared/mock'
import { isWithinGeofence } from '@polycheck/shared/utils'
import type {
  User,
  Student,
  Teacher,
  Subject,
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

  getSubjects(teacherId?: string): Subject[] {
    if (teacherId) return mockSubjects.filter((s) => s.teacherId === teacherId)
    return mockSubjects
  },

  createSubject(data: {
    name: string
    code: string
    section: string
    room: string
    schedule: { day: string; startTime: string; endTime: string }[]
    semester: string
    enrollmentCode: string
    teacherId: string
    teacherName: string
  }): Subject {
    const now = new Date().toISOString()
    const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const subject: Subject = {
      id: `subj-${Date.now()}`,
      ...data,
      schedule: data.schedule.map((s) => ({ day: s.day as Subject['schedule'][0]['day'], startTime: s.startTime, endTime: s.endTime })),
      enrollmentCodeExpiry: expiry,
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    mockSubjects.push(subject)
    return subject
  },

  getSubject(id: string): Subject | undefined {
    return mockSubjects.find((s) => s.id === id)
  },

  getSubjectStudents(subjectId: string): (Student & { attendance: { present: number; late: number; absent: number } })[] {
    const enrolledIds = mockEnrollments
      .filter((e) => e.subjectId === subjectId)
      .map((e) => e.studentId)
    const subjectSessionIds = mockSessions
      .filter((s) => s.subjectId === subjectId)
      .map((s) => s.id)
    return mockStudents
      .filter((s) => enrolledIds.includes(s.id))
      .map((student) => {
        const records = mockAttendanceRecords.filter(
          (r) => r.studentId === student.id && subjectSessionIds.includes(r.sessionId)
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

  resetEnrollmentCode(subjectId: string): string {
    const subject = mockSubjects.find((s) => s.id === subjectId)
    if (!subject) return ''
    const prefix = subject.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 4)
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const newCode = `${prefix}${suffix}`
    subject.enrollmentCode = newCode
    subject.enrollmentCodeExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    return newCode
  },

  disableEnrollmentCode(subjectId: string): void {
    const subject = mockSubjects.find((s) => s.id === subjectId)
    if (subject) {
      subject.enrollmentCode = ''
      subject.enrollmentCodeExpiry = new Date(0).toISOString()
    }
  },

  getSessions(): Session[] {
    return mockSessions
  },

  getSession(sessionId: string): Session | undefined {
    return mockSessions.find((s) => s.id === sessionId)
  },

  createSession(data: {
    subjectId: string
    subjectName: string
    date: string
    startTime: string
    endTime: string
    gracePeriodMinutes: number
    tokenWindowSeconds: number
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

  activateSession(_sessionId: string): void {
    // Mock: session is activated
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
    const enrolledIds = mockEnrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.subjectId)
    return mockSubjects.filter((s) => enrolledIds.includes(s.id))
  },

  getAttendanceRecords(sessionId?: string): AttendanceRecord[] {
    if (sessionId) {
      return mockAttendanceRecords.filter((r) => r.sessionId === sessionId)
    }
    return [...mockAttendanceRecords]
  },

  getAttendanceSummaries(teacherId?: string): AttendanceSummary[] {
    if (teacherId) {
      const teacherSubjects = mockSubjects
        .filter((s) => s.teacherId === teacherId)
        .map((s) => s.id)
      return mockAttendanceSummaries.filter((s) => teacherSubjects.includes(s.subjectId))
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

  getSubjectSessions(subjectId: string): Session[] {
    return mockSessions.filter((s) => s.subjectId === subjectId)
  },

  getStudentAttendanceForSubject(studentId: string, subjectId: string): AttendanceRecord[] {
    const subjectSessionIds = mockSessions
      .filter((s) => s.subjectId === subjectId)
      .map((s) => s.id)
    return mockAttendanceRecords.filter(
      (r) => r.studentId === studentId && subjectSessionIds.includes(r.sessionId)
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

  removeStudentFromSubject(subjectId: string, studentId: string): boolean {
    const idx = mockEnrollments.findIndex(
      (e) => e.subjectId === subjectId && e.studentId === studentId
    )
    if (idx === -1) return false
    mockEnrollments.splice(idx, 1)
    const subject = mockSubjects.find((s) => s.id === subjectId)
    if (subject) subject.studentCount = Math.max(0, subject.studentCount - 1)
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

    return { success: true, status: 'present', message: 'Check-in successful!' }
  },
}
