/**
 * Shared Mock API Core Implementation
 * 
 * This file contains the business logic for all mock API methods.
 * Platform-specific implementations (mobile/web) wrap this core with storage adapters.
 */

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
  mockSectionRoles,
  mockSessionPermissions,
  mockProofsOfClass,
} from './index'
import { isWithinGeofence, createQRTokenData } from '../utils'
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
  SubmitAttendanceResult,
  CalendarEvent,
  BulkSessionInput,
  DisputeInput,
  DisputeReason,
  SectionRole,
  SectionRoleType,
  SessionPermission,
  ProofOfClass,
} from '../types'

/**
 * Creates a mock API instance with all business logic methods.
 * This is platform-agnostic and operates purely on mock data.
 */
export function createMockApiCore() {
  return {
    // ========== Authentication Methods (require platform-specific wrappers) ==========
    
    loginStudent(studentId: string, _password?: string): User | null {
      const user = mockStudents.find((s) => s.studentId === studentId)
      return user || null
    },

    loginFaculty(email: string, _password?: string): User | null {
      const user = mockUsers.find((u) => u.email === email && (u.role === 'teacher' || u.role === 'super_admin'))
      return user || null
    },

    // ========== Subject Methods ==========
    
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

    // ========== Section Methods ==========
    
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

    getStudentsForSection(sectionId: string): Student[] {
      const enrolledIds = mockEnrollments
        .filter((e) => e.sectionId === sectionId)
        .map((e) => e.studentId)
      return mockStudents.filter((s) => enrolledIds.includes(s.id))
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

    // ========== Session Methods ==========
    
    getSessions(sectionId?: string): Session[] {
      if (sectionId) return mockSessions.filter((s) => s.sectionId === sectionId)
      return [...mockSessions]
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

      const section = mockSections.find((s) => s.id === session.sectionId)
      const subject = section ? mockSubjects.find((s) => s.id === section.subjectId) : undefined

      const qrData = createQRTokenData(
        session.id,
        session.sectionId,
        session.teacherId,
        subject?.name ?? session.subjectName,
        validityMinutes,
        session.gracePeriodMinutes
      )
      session.qrToken = qrData
      session.qrGeneratedAt = new Date().toISOString()
      session.qrTokenExpiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString()
      session.isActive = true

      const enrolledIds = mockEnrollments
        .filter((e) => e.sectionId === session.sectionId)
        .map((e) => e.studentId)

      for (const studentId of enrolledIds) {
        const existing = mockAttendanceRecords.find(
          (r) => r.sessionId === session.id && r.studentId === studentId
        )
        if (!existing) {
          const student = mockStudents.find((s) => s.id === studentId)
          mockAttendanceRecords.push({
            id: `a-${Date.now()}-${studentId}`,
            sessionId: session.id,
            sectionId: session.sectionId,
            studentId,
            studentName: student?.fullName ?? 'Unknown',
            timestamp: new Date().toISOString(),
            status: 'absent',
            coordinates: session.geofence, // Initialize with session geofence coordinates
            isSynced: true,
            syncedAt: new Date().toISOString(),
          })
        }
      }

      return session
    },

    endSession(sessionId: string): Session | undefined {
      const session = mockSessions.find((s) => s.id === sessionId)
      if (!session) return undefined

      session.isActive = false
      session.qrToken = undefined
      session.qrGeneratedAt = undefined
      session.qrTokenExpiresAt = undefined

      return session
    },

    // ========== Attendance Methods (with enrollment verification) ==========
    
    checkAttendance(
      sessionId: string,
      studentId: string,
      lat: number,
      lon: number,
    ): SubmitAttendanceResult {
      const session = mockSessions.find((s) => s.id === sessionId)
      if (!session)
        return { success: false, status: 'absent', reason: 'session_not_found', message: 'Session not found' }
      if (!session.isActive)
        return { success: false, status: 'absent', reason: 'session_inactive', message: 'Session is not active' }

      // Verify student is enrolled in the section
      const isEnrolled = mockEnrollments.find(
        (e) => e.sectionId === session.sectionId && e.studentId === studentId
      )
      if (!isEnrolled)
        return {
          success: false,
          status: 'absent',
          reason: 'not_enrolled',
          message: 'You are not enrolled in this section',
        }

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
          reason: 'out_of_bounds',
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
        return { success: true, status: 'late', reason: 'grace_period', message: 'You are late but within grace period.' }
      }

      return { success: false, status: 'absent', reason: 'token_expired', message: 'QR token expired and grace period has passed.' }
    },

    submitAttendance(
      sessionId: string,
      _sectionId: string,
      studentId: string,
      coordinates: { latitude: number; longitude: number },
      _deviceId: string,
    ): SubmitAttendanceResult {
      const session = mockSessions.find((s) => s.id === sessionId)
      if (!session) return { success: false, status: 'absent', reason: 'session_not_found', message: 'Session not found' }

      // Verify student is enrolled in the section
      const isEnrolled = mockEnrollments.find(
        (e) => e.sectionId === session.sectionId && e.studentId === studentId
      )
      if (!isEnrolled)
        return {
          success: false,
          status: 'absent',
          reason: 'not_enrolled',
          message: 'You are not enrolled in this section',
        }

      if (session.geofence) {
        const inRange = isWithinGeofence(
          coordinates.latitude,
          coordinates.longitude,
          session.geofence.latitude,
          session.geofence.longitude,
          session.geofence.radiusMeters,
        )
        if (!inRange) {
          return {
            success: false,
            status: 'absent',
            reason: 'out_of_bounds',
            message: `You are outside the ${session.geofence.radiusMeters}m geofence`,
          }
        }
      }

      const record = mockAttendanceRecords.find(
        (r) => r.sessionId === sessionId && r.studentId === studentId
      )
      if (record) {
        record.status = 'present'
        record.coordinates = coordinates
        record.timestamp = new Date().toISOString()
        return { success: true, status: 'present', message: 'Check-in successful!' }
      }

      const newRecord: AttendanceRecord = {
        id: `a-${Date.now()}`,
        sessionId,
        sectionId: _sectionId,
        studentId,
        studentName: mockStudents.find((s) => s.id === studentId)?.fullName ?? 'Unknown',
        timestamp: new Date().toISOString(),
        status: 'present',
        coordinates,
        deviceId: _deviceId,
        isSynced: true,
        syncedAt: new Date().toISOString(),
      }
      mockAttendanceRecords.push(newRecord)
      return { success: true, status: 'present', message: 'Check-in successful!' }
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

      const newRecord: AttendanceRecord = {
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
      mockAttendanceRecords.push(newRecord)
      return newRecord
    },

    getAttendanceRecords(sessionId?: string, studentId?: string): AttendanceRecord[] {
      let records = [...mockAttendanceRecords]
      if (sessionId) records = records.filter((r) => r.sessionId === sessionId)
      if (studentId) records = records.filter((r) => r.studentId === studentId)
      return records
    },

    updateAttendanceStatus(recordId: string, newStatus: AttendanceStatus): AttendanceRecord | undefined {
      const record = mockAttendanceRecords.find((r) => r.id === recordId)
      if (!record) return undefined
      record.status = newStatus
      record.manuallySet = true
      return record
    },

    // ========== Student Methods ==========
    
    getStudent(studentId: string): Student | undefined {
      return mockStudents.find((s) => s.id === studentId)
    },

    getMySubjects(studentId: string): Section[] {
      const enrolledSectionIds = mockEnrollments
        .filter((e) => e.studentId === studentId)
        .map((e) => e.sectionId)
      return mockSections.filter((s) => enrolledSectionIds.includes(s.id))
    },

    getMyAttendance(studentId: string, sectionId?: string): AttendanceRecord[] {
      let records = mockAttendanceRecords.filter((r) => r.studentId === studentId)
      if (sectionId) records = records.filter((r) => r.sectionId === sectionId)
      return records
    },

    getStudentAttendanceForSection(studentId: string, sectionId: string): AttendanceRecord[] {
      const sessionIds = mockSessions
        .filter((s) => s.sectionId === sectionId)
        .map((s) => s.id)
      return mockAttendanceRecords.filter(
        (r) => r.studentId === studentId && sessionIds.includes(r.sessionId)
      )
    },

    // ========== Enrollment Methods ==========
    
    getEnrollments(sectionId?: string): Enrollment[] {
      if (sectionId) return mockEnrollments.filter((e) => e.sectionId === sectionId)
      return [...mockEnrollments]
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

    // ========== Dispute Methods ==========
    
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
        record.disputeDescription = record.disputeDescription ? `${record.disputeDescription}; Dispute accepted` : 'Dispute accepted'
      } else if (resolution === 'reject') {
        record.status = 'absent'
        record.disputeDescription = record.disputeDescription ? `${record.disputeDescription}; Dispute rejected` : 'Dispute rejected'
      } else if (resolution === 'override' && newStatus) {
        record.status = newStatus
        record.manuallySet = true
        record.disputeDescription = record.disputeDescription ? `${record.disputeDescription}; Dispute overridden to ${newStatus}` : `Dispute overridden to ${newStatus}`
      }
      return record
    },

    submitDispute(input: DisputeInput): boolean {
      const record = mockAttendanceRecords.find(r => r.id === input.recordId)
      if (!record) return false
      
      record.status = 'disputed'
      record.disputeReason = input.reason
      record.disputeDescription = input.description
      return true
    },

    // ========== Calendar Methods ==========
    
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

    // ========== Bulk Operations ==========
    
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

    // ========== Export Methods ==========
    
    exportAttendanceCsv(sectionId?: string, _sessionId?: string): string {
      let records = [...mockAttendanceRecords]
      if (sectionId) records = records.filter(r => r.sectionId === sectionId)

      const header = 'ID,Student Name,Student ID,Date,Time,Status,Section,Session ID,Disputed,Notes'
      const rows = records.map(r => {
        const session = mockSessions.find(s => s.id === r.sessionId)
        const date = r.timestamp.split('T')[0]
        const time = r.timestamp.split('T')[1]?.slice(0, 5) ?? ''
        const section = mockSections.find(s => s.id === r.sectionId)
        return `${r.id},"${r.studentName}",${r.studentId},${date},${time},${r.status},${section?.section ?? ''},${r.sessionId},${r.status === 'disputed' ? 'Yes' : 'No'},"${r.disputeDescription ?? ''}"`
      })

      return [header, ...rows].join('\n')
    },

    // ========== Reports Methods ==========
    
    getAttendanceSummary(sectionId?: string): AttendanceSummary[] {
      if (sectionId) {
        return mockAttendanceSummaries.filter(summary => summary.sectionId === sectionId)
      }
      return mockAttendanceSummaries
    },
  }
}

export type MockApiCore = ReturnType<typeof createMockApiCore>
