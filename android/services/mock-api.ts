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
