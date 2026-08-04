import type { User, Student, Teacher, Subject, Section, Session, AttendanceRecord, AttendanceSummary, AttendanceStatus, StudentDisputeReason, Enrollment, SectionRole, SectionRoleType, SessionPermission, ProofOfClass } from './index'

export interface CreateSubjectInput {
  name: string
  code: string
  description?: string
}

export interface CreateTeacherInput {
  fullName: string
  email: string
  password: string
  department?: string
}

export interface CreateStudentInput {
  fullName: string
  studentId: string
  email?: string
  password: string
  program: string
  yearLevel: number
  department: string
}

export interface ResetUserPasswordResult {
  message: string
  userId: string
}

export interface CreateSectionInput {
  subjectId: string
  section: string
  room: string
  schedule: { day: string; startTime: string; endTime: string; room?: string }[]
  semester: string
}

export interface CreateSessionInput {
  sectionId: string
  subjectName: string
  date: string
  startTime: string
  endTime: string
  room?: string
  /** Optional - set at QR generation time. Defaults to 15 if omitted. */
  qrValidityMinutes?: number
  /** Optional - set at QR generation time. Defaults to 15 if omitted. */
  gracePeriodMinutes?: number
  geofence: { latitude: number; longitude: number; radiusMeters: number }
  teacherId: string
  isRescheduled?: boolean
  rescheduledFromDate?: string
  originalScheduleTime?: string
  originalRoom?: string
}

export interface SubmitAttendanceResult {
  success: boolean
  status: AttendanceStatus
  reason?: string
  message?: string
}

export type ScanInputChannel = 'camera' | 'image' | 'manual'

export interface ScanEvidenceInput {
  clientAttemptId: string
  accuracyMeters?: number
  locationCapturedAt: string
  mocked?: boolean
  inputChannel: ScanInputChannel
}

export interface PrivacyNotice {
  version: string
  url: string
  summary: string
}

export interface DisputeInput {
  recordId: string
  reason: StudentDisputeReason
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
  /** Optional - set at QR generation time. Defaults to 15 if omitted. */
  qrValidityMinutes?: number
  /** Optional - set at QR generation time. Defaults to 15 if omitted. */
  gracePeriodMinutes?: number
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
  status?: 'active' | 'inactive' | 'completed' | 'moved'
  studentStatus?: 'present' | 'late' | 'absent'
  attendanceCounts?: { present: number; late: number; absent: number; disputed: number }
  teacherName?: string
  subjectCode?: string
  isRescheduled?: boolean
  rescheduledFromDate?: string
  rescheduledTo?: { date: string; startTime: string; endTime: string; room?: string }
}

export interface AttendanceReportFilters {
  startDate?: string
  endDate?: string
  teacherId?: string
  subjectId?: string
  sectionId?: string
  sessionId?: string
}

export interface AttendanceReportSummary extends AttendanceSummary {
  pending: number
}

export interface AttendanceReport {
  range: { startDate: string; endDate: string }
  totals: {
    totalRecords: number
    totalSessions: number
    present: number
    late: number
    absent: number
    pending: number
    disputed: number
  }
  summaries: AttendanceReportSummary[]
}

export interface DashboardOverview {
  counts: {
    faculty: number
    students: number
    subjects: number
    sections: number
    sessionsToday: number
    pendingDisputes: number
  }
  trendRange: { startDate: string; endDate: string }
  trends: Array<{
    date: string
    present: number
    late: number
    absent: number
    disputed: number
  }>
  recentAttendance: Array<{
    id: string
    sessionId: string
    sectionId: string
    studentName: string
    subjectName: string
    timestamp: string
    status: AttendanceStatus
  }>
  recentDisputes: Array<{
    id: string
    sectionId: string
    studentName: string
    timestamp: string
    disputeReason?: string
  }>
}

export interface ApiClient {
  getPrivacyNotice(): Promise<PrivacyNotice>
  acceptPrivacyConsent(version: string): Promise<User>
  loginStudent(studentId: string, password?: string): Promise<User | null>
  loginFaculty(email: string, password?: string): Promise<User | null>
  logout(): Promise<void>
  restoreSession(): Promise<User | null>
  getCurrentUser(): User | null

  getSubjects(): Promise<Subject[]>
  getSubject(id: string): Promise<Subject>
  createSubject(data: CreateSubjectInput): Promise<Subject>

  getSections(subjectId?: string): Promise<Section[]>
  getSection(id: string): Promise<Section>
  createSection(data: CreateSectionInput): Promise<Section>
  getSectionStudents(sectionId: string): Promise<
    (Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]
  >
  getStudentSections(studentId: string): Promise<Section[]>
  getStudentsForSection(sectionId: string): Promise<Student[]>
  resetEnrollmentCode(sectionId: string): Promise<{ enrollmentCode: string }>
  disableEnrollmentCode(sectionId: string): Promise<void>
  removeStudentFromSection(sectionId: string, studentId: string): Promise<boolean>
  getEnrollments(sectionId?: string): Promise<Enrollment[]>
  enrollByCode(enrollmentCode: string): Promise<Enrollment>

  getSessions(sectionId?: string): Promise<Session[]>
  getSession(id: string): Promise<Session>
  createSession(data: CreateSessionInput): Promise<Session>
  generateQrCode(sessionId: string, validityMinutes: number, gracePeriodMinutes?: number): Promise<Session>
  endSession(sessionId: string): Promise<Session>

  getAttendanceRecords(sessionId?: string): Promise<AttendanceRecord[]>
  getAttendanceSummaries(teacherId?: string): Promise<AttendanceSummary[]>
  getAttendanceReport(filters?: AttendanceReportFilters): Promise<AttendanceReport>
  getDashboardOverview(filters?: Pick<AttendanceReportFilters, 'startDate' | 'endDate'>): Promise<DashboardOverview>
  getAttendanceForStudent(studentId: string): Promise<AttendanceRecord[]>
  getStudentAttendanceForSection(studentId: string, sectionId: string): Promise<AttendanceRecord[]>
  addAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord>
  updateAttendanceStatus(recordId: string, status: AttendanceStatus): Promise<AttendanceRecord>
  submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string, qrToken: string, scannedAt?: string, evidence?: ScanEvidenceInput): Promise<AttendanceRecord | { error: string }>
  checkAttendance(
    sessionId: string,
    studentId: string,
    lat: number,
    lon: number,
    qrToken?: string,
    scannedAt?: string,
  ): Promise<SubmitAttendanceResult>

  getDisputedRecords(sessionId?: string, filters?: { search?: string; status?: 'pending' | 'resolved' | 'all' }): Promise<AttendanceRecord[]>
  resolveDispute(recordId: string, resolution: 'accept' | 'reject' | 'override', newStatus?: AttendanceStatus): Promise<AttendanceRecord>
  submitDispute(data: DisputeInput): Promise<AttendanceRecord>

  getStudents(): Promise<Student[]>
  getStudent(id: string): Promise<Student>
  getTeachers(): Promise<Teacher[]>
  createTeacher(data: CreateTeacherInput): Promise<Teacher>
  createStudent(data: CreateStudentInput): Promise<Student>
  resetUserPassword(id: string, password: string): Promise<ResetUserPasswordResult>
  setUserStatus(id: string, isActive: boolean): Promise<User>
  getSettings(): Promise<{ key: string; value: string; updatedAt: string }[]>
  setSetting(key: string, value: string): Promise<{ key: string; value: string; updatedAt: string }>
  getMyAttendance(studentId: string): Promise<AttendanceRecord[]>
  getMySubjects(studentId: string): Promise<Subject[]>

  getSectionSessions(sectionId: string): Promise<Session[]>

  assignSectionRole(sectionId: string, studentId: string, role: SectionRoleType): Promise<SectionRole>
  removeSectionRole(sectionId: string, studentId: string, role: SectionRoleType): Promise<boolean>
  getSectionRoles(sectionId: string): Promise<SectionRole[]>
  getStudentRoles(studentId: string): Promise<SectionRole[]>

  grantSessionPermission(sectionId: string, studentId: string): Promise<SessionPermission>
  revokeSessionPermission(sectionId: string, studentId: string): Promise<boolean>
  checkSessionPermission(sectionId: string, studentId: string): Promise<boolean>
  getActiveSessionPermissions(sectionId: string): Promise<SessionPermission[]>

  uploadProofOfClass(data: { sectionId: string; sessionId: string; photoData: string; description?: string; uploadedBy: string; uploadedByStudentName: string }): Promise<ProofOfClass>
  getProofsOfClass(sessionId: string): Promise<ProofOfClass[]>
  deleteProofOfClass(proofId: string): Promise<boolean>

  enrollStudent(data: EnrollStudentInput): Promise<boolean>
  getCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]>
  createBulkSessions(data: BulkSessionInput): Promise<Session[]>
  exportAttendanceCsv(filters?: AttendanceReportFilters): Promise<string>
  search(query: string): Promise<{ students: Student[]; sections: Section[]; sessions: Session[] }>
}
