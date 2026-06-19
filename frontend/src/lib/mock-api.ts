import {
  mockUsers,
  mockTeachers,
  mockStudents,
  mockSubjects,
  mockEnrollments,
  mockSessions,
  mockAttendanceRecords,
  mockAttendanceSummaries,
  mockSuperAdmin,
} from '@polycheck/shared/mock'

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

import { isWithinGeofence } from '@polycheck/shared/utils'

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

  createSubject(data: {
    name: string
    code: string
    section: string
    room: string
    schedule: { day: string; startTime: string; endTime: string; room?: string }[]
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
      schedule: data.schedule.map((s) => ({ day: s.day as Subject['schedule'][0]['day'], startTime: s.startTime, endTime: s.endTime, room: s.room })),
      enrollmentCodeExpiry: expiry,
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    mockSubjects.push(subject)
    return subject
  },

  getSubjects(teacherId?: string): Subject[] {
    if (teacherId) {
      return mockSubjects.filter((s) => s.teacherId === teacherId)
    }
    return [...mockSubjects]
  },

  getSubject(id: string): Subject | undefined {
    return mockSubjects.find((s) => s.id === id)
  },

  getEnrollments(subjectId?: string) {
    if (subjectId) {
      return mockEnrollments.filter((e) => e.subjectId === subjectId)
    }
    return [...mockEnrollments]
  },

  getStudentsForSubject(subjectId: string): Student[] {
    const enrolledIds = mockEnrollments
      .filter((e) => e.subjectId === subjectId)
      .map((e) => e.studentId)
    return mockStudents.filter((s) => enrolledIds.includes(s.id))
  },

  getSessions(subjectId?: string): Session[] {
    if (subjectId) {
      return mockSessions.filter((s) => s.subjectId === subjectId)
    }
    return [...mockSessions]
  },

  getSession(id: string): Session | undefined {
    return mockSessions.find((s) => s.id === id)
  },

  createSession(data: {
    subjectId: string
    subjectName: string
    date: string
    startTime: string
    endTime: string
    room?: string
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

  activateSession(sessionId: string): Session | undefined {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (session) {
      session.isActive = true
    }
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
      const teacherSubjects = mockSubjects
        .filter((s) => s.teacherId === teacherId)
        .map((s) => s.id)
      return mockAttendanceSummaries.filter((s) => teacherSubjects.includes(s.subjectId))
    }
    return [...mockAttendanceSummaries]
  },

  getAttendanceForStudent(studentId: string): AttendanceRecord[] {
    return mockAttendanceRecords.filter((r) => r.studentId === studentId)
  },

  getStudentSubjects(studentId: string): Subject[] {
    const enrolledIds = mockEnrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.subjectId)
    return mockSubjects.filter((s) => enrolledIds.includes(s.id))
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

  addAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
    mockAttendanceRecords.push(record)
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

  submitAttendance(
    sessionId: string,
    subjectId: string,
    studentId: string,
    coordinates: { latitude: number; longitude: number },
    _deviceId: string
  ): { success: boolean; status: AttendanceStatus; reason?: string } {
    const session = mockSessions.find((s) => s.id === sessionId)
    if (!session) return { success: false, status: 'absent', reason: 'Session not found' }

    const geofence = session.geofence
    const inRange = isWithinGeofence(
      coordinates.latitude,
      coordinates.longitude,
      geofence.latitude,
      geofence.longitude,
      geofence.radiusMeters
    )

    if (!inRange) {
      return {
        success: false,
        status: 'absent',
        reason: `Outside geofence (${geofence.radiusMeters}m from classroom)`,
      }
    }

    return {
      success: true,
      status: 'present',
    }
  },
}
