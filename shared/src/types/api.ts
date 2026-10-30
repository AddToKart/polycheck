import type { User, Student, Teacher, Subject, Section, Session, AttendanceRecord, AttendanceSummary, AttendanceStatus, StudentDisputeReason, Enrollment, SectionRole, SectionRoleType, SessionPermission, ProofOfClass } from './index'
import type {
  AdminOverview,
  AdminUserFilters,
  AdminUserPage,
  AssignableRole,
  CreateAdminInput,
  ServerStatusSnapshot,
  UpdateUserInput,
} from './dashboard'
import type {
  EnrollImportRequest,
  EnrollImportResult,
  EnrollImportRow,
  ImportJobStatus,
  StudentImportRequest,
  StudentImportResult,
} from './bulk-import'
import type { AiCapabilities, AiChatSendInput, AiChatSendResult, AiChatThread, AiThreadSummary } from './ai'
import type { AttendanceStanding } from './standing'
import type { AppNotification, NotificationReadInput, PushTokenInput } from './notification'
import type { StudentAtRisk } from './at-risk'
import type { ExcuseDecision, ExcuseReason } from './attendance'
import type {
  CreateSystemReportInput,
  SystemReport,
  SystemReportFilters,
  SystemReportPage,
  SystemReportStats,
  UpdateSystemReportStatusInput,
} from './system-report'

export interface CreateSubjectInput {
  name: string
  code: string
  description?: string
}

export interface CreateTeacherInput {
  fullName: string
  email: string
  /** Optional. When omitted the server generates a temporary password and returns it once. */
  password?: string
  department?: string
}

export interface CreateStudentInput {
  fullName: string
  studentId: string
  email?: string
  /** Optional. When omitted the server generates a temporary password and returns it once. */
  password?: string
  program: string
  yearLevel: number
  department: string
}

export interface CreateTeacherResult extends Teacher {
  /** Present only when the server generated the credential; shown exactly once. */
  temporaryPassword?: string
}

export interface CreateStudentResult extends Student {
  /** Present only when the server generated the credential; shown exactly once. */
  temporaryPassword?: string
}

export interface ResetUserPasswordResult {
  message: string
  userId: string
  /** Present only when the server generated the credential; shown exactly once. */
  temporaryPassword?: string
}

export type EmergencyDeviceReleaseReason = 'dead_battery' | 'lost_or_damaged' | 'borrowed_device' | 'other'

export interface EmergencyDeviceReleaseInput {
  sectionId: string
  reason: EmergencyDeviceReleaseReason
  note?: string
}

export interface EmergencyDeviceReleaseResult {
  user: User
  clearedCooldown: boolean
  message: string
}

export interface TeacherResetStudentPasswordResult {
  userId: string
  /** Server-generated temporary password; shown exactly once. */
  temporaryPassword: string
  message: string
}

export interface UnregisterDeviceResult {
  user: User
  cooldownHours: number
  cooldownUntil: string
  message: string
}

export interface UpdateContactsInput {
  /** Empty string clears the stored value. */
  contactEmail?: string
  /** Empty string clears the stored value. */
  contactPhone?: string
}

export interface DelegatedTeacherPermissions {
  canResetStudentPasswords: boolean
  canEmergencyUnbindDevices: boolean
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

export interface DeviceSecurityEvidence {
  rootDetected?: boolean
  hookDetected?: boolean
  emulatorDetected?: boolean
}

export interface ScanEvidenceInput {
  clientAttemptId: string
  accuracyMeters?: number
  locationCapturedAt: string
  mocked?: boolean
  inputChannel: ScanInputChannel
  deviceSecurity?: DeviceSecurityEvidence
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
  /** Admin-only department filter for institution-wide reports. */
  department?: string
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
    excused: number
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
    excused: number
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

export type AuditOutcome = 'initiated' | 'succeeded' | 'failed'

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  actorRole: User['role'] | string
  action: string
  entityType: string
  entityId?: string
  outcome: AuditOutcome
  ipAddress?: string
  createdAt: string
}

export interface AuditLogFilters {
  page?: number
  pageSize?: number
  search?: string
  action?: string
  outcome?: AuditOutcome
  startDate?: string
  endDate?: string
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiClient {
  getPrivacyNotice(): Promise<PrivacyNotice>
  acceptPrivacyConsent(version: string): Promise<User>
  loginStudent(studentId: string, password?: string): Promise<User | null>
  loginFaculty(email: string, password?: string): Promise<User | null>
  logout(): Promise<void>
  restoreSession(): Promise<User | null>
  changePassword(currentPassword: string | undefined, newPassword: string): Promise<User>
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
  getAdminOverview(): Promise<AdminOverview>
  getServerStatus(): Promise<ServerStatusSnapshot>
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

  // ── Excuses (Wave 4) ──
  requestExcuse(
    recordId: string,
    input: { reason: ExcuseReason; description: string; evidenceData?: string },
  ): Promise<AttendanceRecord>
  listExcuses(filters?: {
    status?: 'requested' | 'approved' | 'rejected'
    sectionId?: string
    startDate?: string
    endDate?: string
  }): Promise<AttendanceRecord[]>
  decideExcuse(recordId: string, decision: ExcuseDecision, note?: string): Promise<AttendanceRecord>

  // ── At-risk oversight (Wave 4) ──
  getAtRiskStudents(filters?: { sectionId?: string; limit?: number }): Promise<StudentAtRisk[]>

  // ── Notifications (Wave 4) ──
  getNotifications(filters?: { unreadOnly?: boolean; limit?: number }): Promise<AppNotification[]>
  getUnreadNotificationCount(): Promise<number>
  markNotificationsRead(input?: NotificationReadInput): Promise<number>
  registerPushToken(input: PushTokenInput): Promise<boolean>

  getStudents(): Promise<Student[]>
  getStudent(id: string): Promise<Student>
  getTeachers(): Promise<Teacher[]>
  getUsers(filters?: AdminUserFilters): Promise<AdminUserPage>
  updateUser(id: string, input: UpdateUserInput): Promise<User>
  changeUserRole(id: string, role: AssignableRole): Promise<User>
  createAdmin(input: CreateAdminInput): Promise<User>
  createTeacher(data: CreateTeacherInput): Promise<CreateTeacherResult>
  createStudent(data: CreateStudentInput): Promise<CreateStudentResult>
  resetUserPassword(id: string, password?: string): Promise<ResetUserPasswordResult>
  setUserStatus(id: string, isActive: boolean): Promise<User>

  // ── Account governance (GOV) ──
  teacherResetStudentPassword(
    studentId: string,
    sectionId: string,
  ): Promise<TeacherResetStudentPasswordResult>
  emergencyReleaseDevice(
    studentId: string,
    input: EmergencyDeviceReleaseInput,
  ): Promise<EmergencyDeviceReleaseResult>
  unregisterDevice(deviceId: string): Promise<UnregisterDeviceResult>
  updateContacts(input: UpdateContactsInput): Promise<User>

  // ── System issue & feedback reporting (SR) ──
  createSystemReport(input: CreateSystemReportInput): Promise<SystemReport>
  getMySystemReports(): Promise<SystemReport[]>
  getSystemReports(filters?: SystemReportFilters, options?: { signal?: AbortSignal }): Promise<SystemReportPage>
  getSystemReportStats(): Promise<SystemReportStats>
  getSystemReport(id: string): Promise<SystemReport>
  updateSystemReportStatus(id: string, input: UpdateSystemReportStatusInput): Promise<SystemReport>

  // ── Bulk import ──
  importStudents(data: StudentImportRequest): Promise<StudentImportResult>
  getStudentImportJob(jobId: string): Promise<ImportJobStatus>
  previewEnrollImport(sectionId: string, rows: EnrollImportRow[]): Promise<EnrollImportResult>
  importSectionEnrollments(sectionId: string, data: EnrollImportRequest): Promise<EnrollImportResult>
  getSettings(): Promise<{ key: string; value: string; updatedAt: string }[]>
  setSetting(key: string, value: string): Promise<{ key: string; value: string; updatedAt: string }>
  getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogPage>
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

  // ── AI assistant (AI0) ──
  getAiCapabilities(): Promise<AiCapabilities>
  sendAiChatMessage(data: AiChatSendInput): Promise<AiChatSendResult>
  getAiThread(threadId: string): Promise<AiChatThread>
  listAiThreads(): Promise<AiThreadSummary[]>
  deleteAiThread(threadId: string): Promise<boolean>

  // ── Standing evaluation (AI4) ──
  getMyStanding(): Promise<AttendanceStanding[]>
}
