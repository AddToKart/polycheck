import type { User, Student, Teacher, Subject, Section, Session, AttendanceRecord, AttendanceSummary, AttendanceStatus, Enrollment } from './index'

export interface CreateSubjectInput {
  name: string
  code: string
  description?: string
}

export interface CreateSectionInput {
  subjectId: string
  section: string
  room: string
  schedule: { day: string; startTime: string; endTime: string; room?: string }[]
  semester: string
  teacherId: string
  teacherName: string
}

export interface CreateSessionInput {
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
}

export interface SubmitAttendanceResult {
  success: boolean
  status: AttendanceStatus
  reason?: string
  message?: string
}

export interface DisputeInput {
  recordId: string
  reason: string
  description: string
}

export interface EnrollStudentInput {
  sectionId: string
  studentId: string
  studentName: string
}

export interface BulkSessionInput {
  sectionId: string
  subjectName: string
  startDate: string
  endDate: string
  daysOfWeek: string[]
  startTime: string
  endTime: string
  room?: string
  qrValidityMinutes: number
  gracePeriodMinutes: number
  geofence: { latitude: number; longitude: number; radiusMeters: number }
  teacherId: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  room?: string
  sectionId: string
  subjectName: string
  sectionName: string
  type: 'session' | 'schedule'
  status?: 'active' | 'inactive' | 'completed'
  studentStatus?: 'present' | 'late' | 'absent'
  attendanceCounts?: { present: number; late: number; absent: number; disputed: number }
  teacherName?: string
  subjectCode?: string
}

export interface ApiClient {
  loginStudent(studentId: string, password?: string): User | null
  loginFaculty(email: string, password?: string): User | null
  logout(): void
  getCurrentUser(): User | null

  getSubjects(): Subject[]
  getSubject(id: string): Subject | undefined
  createSubject(data: CreateSubjectInput): Subject

  getSections(subjectId?: string): Section[]
  getSection(id: string): Section | undefined
  createSection(data: CreateSectionInput): Section
  getSectionStudents(sectionId: string): (Student & { attendance: { present: number; late: number; absent: number } })[]
  getStudentSections(studentId: string): Section[]
  getStudentsForSection(sectionId: string): Student[]
  resetEnrollmentCode(sectionId: string): string
  disableEnrollmentCode(sectionId: string): void
  removeStudentFromSection(sectionId: string, studentId: string): boolean
  getEnrollments(sectionId?: string): Enrollment[]

  getSessions(sectionId?: string): Session[]
  getSession(id: string): Session | undefined
  createSession(data: CreateSessionInput): Session
  generateQrCode(sessionId: string, validityMinutes: number): Session | undefined
  endSession(sessionId: string): Session | undefined

  getAttendanceRecords(sessionId?: string): AttendanceRecord[]
  getAttendanceSummaries(teacherId?: string): AttendanceSummary[]
  getAttendanceForStudent(studentId: string): AttendanceRecord[]
  getStudentAttendanceForSection(studentId: string, sectionId: string): AttendanceRecord[]
  addAttendanceRecord(record: AttendanceRecord): AttendanceRecord
  updateAttendanceStatus(recordId: string, status: AttendanceStatus): AttendanceRecord | undefined
  submitAttendance(sessionId: string, sectionId: string, studentId: string, coordinates: { latitude: number; longitude: number }, deviceId: string): SubmitAttendanceResult
  submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string): AttendanceRecord | { error: string }
  checkAttendance(sessionId: string, studentId: string, lat: number, lon: number): SubmitAttendanceResult

  getDisputedRecords(sessionId?: string): AttendanceRecord[]
  resolveDispute(recordId: string, resolution: 'accept' | 'reject' | 'override', newStatus?: AttendanceStatus): AttendanceRecord | undefined
  submitDispute(data: DisputeInput): AttendanceRecord | undefined

  getStudents(): Student[]
  getStudent(id: string): Student | undefined
  getTeachers(): Teacher[]
  getMyAttendance(studentId: string): AttendanceRecord[]
  getMySubjects(studentId: string): Subject[]

  getSectionSessions(sectionId: string): Session[]

  enrollStudent(data: EnrollStudentInput): boolean
  getCalendarEvents(userId: string, startDate: string, endDate: string): CalendarEvent[]
  createBulkSessions(data: BulkSessionInput): Session[]
  exportAttendanceCsv(sectionId?: string, sessionId?: string): string
}
