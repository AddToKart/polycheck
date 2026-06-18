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
