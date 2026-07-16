import { signQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type DisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput } from '@polycheck/shared'
import { getOrCreateTeacherSigningKey } from './signing-key'
import { API_BASE } from './api-config'

const STORAGE_KEY = 'polycheck-user'
const TOKEN_KEY = 'polycheck-token'

function loadUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch { return null }
}

function saveUser(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* noop */ }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

let currentUser: User | null = loadUser()

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Request failed')
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse<T>(res)
}

export const api = {
  async loginStudent(studentId: string, password?: string): Promise<User | null> {
    const res = await fetch(`${API_BASE}/auth/login/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password: password ?? '' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      const msg = Array.isArray(err.message) ? err.message.join('. ') : (err.message || 'Login failed')
      throw new Error(msg)
    }
    const data = await res.json()
    currentUser = data.user as User
    saveUser(currentUser)
    setToken(data.token)
    return currentUser
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    const res = await fetch(`${API_BASE}/auth/login/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password ?? '' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      const msg = Array.isArray(err.message) ? err.message.join('. ') : (err.message || 'Login failed')
      throw new Error(msg)
    }
    const data = await res.json()
    currentUser = data.user as User
    saveUser(currentUser)
    setToken(data.token)
    return currentUser
  },

  logout() {
    currentUser = null
    saveUser(null)
    setToken(null)
  },

  getCurrentUser(): User | null {
    if (!currentUser) currentUser = loadUser()
    return currentUser
  },

  getToken(): string | null {
    return getToken()
  },

  // ── Subjects ──
  getSubjects(): Promise<Subject[]> { return get('/subjects') },
  getSubject(id: string): Promise<Subject> { return get(`/subjects/${id}`) },
  createSubject(data: CreateSubjectInput): Promise<Subject> { return post('/subjects', data) },

  // ── Sections ──
  getSections(subjectId?: string): Promise<Section[]> {
    return get(`/sections${subjectId ? `?subjectId=${subjectId}` : ''}`)
  },
  getSection(id: string): Promise<Section> { return get(`/sections/${id}`) },
  createSection(data: CreateSectionInput): Promise<Section> { return post('/sections', data) },
  getSectionStudents(sectionId: string): Promise<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]> {
    return get(`/sections/${sectionId}/students`)
  },
  getStudentsForSection(sectionId: string): Promise<Student[]> {
    return get(`/sections/${sectionId}/students`)
  },
  getStudentSections(studentId: string): Promise<Section[]> {
    return get(`/sections?studentId=${studentId}`)
  },
  resetEnrollmentCode(sectionId: string): Promise<{ enrollmentCode: string }> {
    return post(`/sections/${sectionId}/enrollment-code/reset`)
  },
  disableEnrollmentCode(sectionId: string): Promise<void> {
    return post(`/sections/${sectionId}/enrollment-code/disable`)
  },
  removeStudentFromSection(sectionId: string, studentId: string): Promise<boolean> {
    return del(`/sections/${sectionId}/students/${studentId}`)
  },
  getEnrollments(sectionId?: string): Promise<Enrollment[]> {
    return sectionId ? get(`/sections/${sectionId}/enrollments`) : get('/enrollments')
  },
  enrollByCode(enrollmentCode: string): Promise<Enrollment> {
    return post('/sections/enroll-by-code', { enrollmentCode })
  },

  // ── Sessions ──
  getSessions(sectionId?: string): Promise<Session[]> {
    return get(`/sessions${sectionId ? `?sectionId=${sectionId}` : ''}`)
  },
  getSession(id: string): Promise<Session> { return get(`/sessions/${id}`) },
  createSession(data: CreateSessionInput): Promise<Session> {
    const { teacherId: _teacherId, ...body } = data
    return post('/sessions', body)
  },
  async generateQrCode(sessionId: string, validityMinutes: number): Promise<Session> {
    const [session, key] = await Promise.all([get<Session>(`/sessions/${sessionId}`), Promise.resolve(getOrCreateTeacherSigningKey())])
    const user = this.getCurrentUser()
    if (!user || user.role !== 'teacher') throw new Error('A teacher account is required to sign QR tokens')
    await post('/auth/provision-key', { publicKey: key.publicKey })
    const token = signQRToken({
      version: 1,
      sessionId: session.id,
      sectionId: session.sectionId,
      teacherId: user.id,
      teacherName: user.fullName,
      issuedAt: Date.now(),
      validityMinutes,
      gracePeriodMinutes: session.gracePeriodMinutes,
    }, key.secretKey)
    return post(`/sessions/${sessionId}/activate`, { validityMinutes, token })
  },
  endSession(sessionId: string): Promise<Session> { return post(`/sessions/${sessionId}/end`) },
  getSectionSessions(sectionId: string): Promise<Session[]> {
    return get(`/sessions?sectionId=${sectionId}`)
  },

  // ── Attendance ──
  getAttendanceRecords(sessionId?: string): Promise<AttendanceRecord[]> {
    return get(`/attendance${sessionId ? `?sessionId=${sessionId}` : ''}`)
  },
  getAttendanceSummaries(teacherId?: string): Promise<AttendanceSummary[]> {
    return get(`/attendance/summaries${teacherId ? `?teacherId=${teacherId}` : ''}`)
  },
  getAttendanceForStudent(studentId: string): Promise<AttendanceRecord[]> {
    return get(`/attendance/student/${studentId}`)
  },
  getStudentAttendanceForSection(studentId: string, sectionId: string): Promise<AttendanceRecord[]> {
    return get(`/attendance/student/${studentId}?sectionId=${sectionId}`)
  },
  addAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
    return post('/attendance', { sessionId: record.sessionId, sectionId: record.sectionId, studentId: record.studentId, status: record.status })
  },
  updateAttendanceStatus(recordId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    return patch(`/attendance/${recordId}/status`, { status })
  },
  async submitAttendance(sessionId: string, sectionId: string, _studentId: string, coordinates: { latitude: number; longitude: number }, deviceId: string): Promise<SubmitAttendanceResult> {
    const session = await get<Session>(`/sessions/${sessionId}`)
    if (!session.qrToken) throw new Error('Session has no active QR token')
    return post('/attendance/submit', { sessionId, sectionId, latitude: coordinates.latitude, longitude: coordinates.longitude, deviceId, qrToken: session.qrToken, scannedAt: new Date().toISOString() })
  },
  submitScan(sessionId: string, _studentId: string, _studentName: string, lat: number, lon: number, deviceId: string, qrToken?: string, scannedAt?: string): Promise<AttendanceRecord | { error: string }> {
    return post('/attendance/scan', { sessionId, lat, lon, deviceId, qrToken, scannedAt })
  },
  checkAttendance(sessionId: string, studentId: string, lat: number, lon: number, qrToken?: string, scannedAt?: string): Promise<SubmitAttendanceResult> {
    return post('/attendance/check', { sessionId, lat, lon, qrToken, scannedAt })
  },

  // ── Disputes ──
  getDisputedRecords(sessionId?: string, filters?: { search?: string; status?: 'pending' | 'resolved' | 'all' }): Promise<AttendanceRecord[]> {
    let path = '/disputes'
    const params = new URLSearchParams()
    if (sessionId) params.set('sessionId', sessionId)
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    if (qs) path += `?${qs}`
    return get(path)
  },
  resolveDispute(recordId: string, resolution: 'accept' | 'reject' | 'override', newStatus?: AttendanceStatus): Promise<AttendanceRecord> {
    return post(`/disputes/${recordId}/resolve`, { resolution, newStatus })
  },
  submitDispute(data: { recordId: string; reason: DisputeReason; description: string }): Promise<AttendanceRecord> {
    return post('/disputes', data)
  },

  // ── Users ──
  getStudents(): Promise<Student[]> { return get('/users/students') },
  getStudent(id: string): Promise<Student> { return get(`/users/${id}`) },
  getTeachers(): Promise<Teacher[]> { return get('/users/teachers') },
  createTeacher(data: { fullName: string; email: string; password: string; department?: string }): Promise<Teacher> {
    return post('/users/teachers', data)
  },
  setUserStatus(id: string, isActive: boolean): Promise<User> {
    return patch(`/users/${id}/status`, { isActive })
  },
  getSettings(): Promise<{ key: string; value: string; updatedAt: string }[]> {
    return get('/settings')
  },
  setSetting(key: string, value: string): Promise<{ key: string; value: string; updatedAt: string }> {
    return put(`/settings/${encodeURIComponent(key)}`, { value })
  },
  getMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return get(`/attendance/student/${studentId}`)
  },
  async getMySubjects(studentId: string): Promise<Subject[]> {
    return get('/subjects')
  },

  // ── Section Roles ──
  assignSectionRole(sectionId: string, studentId: string, role: SectionRoleType): Promise<SectionRole> {
    return post('/section-roles', { sectionId, studentId, role })
  },
  removeSectionRole(sectionId: string, studentId: string, role: SectionRoleType): Promise<boolean> {
    return del(`/section-roles/${sectionId}/${studentId}/${role}`)
  },
  getSectionRoles(sectionId: string): Promise<SectionRole[]> { return get(`/section-roles/${sectionId}`) },
  getStudentRoles(studentId: string): Promise<SectionRole[]> { return get(`/section-roles/student/${studentId}`) },

  // ── Session Permissions ──
  grantSessionPermission(sectionId: string, studentId: string): Promise<SessionPermission> {
    return post('/session-permissions', { sectionId, studentId })
  },
  revokeSessionPermission(sectionId: string, studentId: string): Promise<boolean> {
    return del(`/session-permissions/${sectionId}/${studentId}`)
  },
  checkSessionPermission(sectionId: string, studentId: string): Promise<boolean> {
    return get(`/session-permissions/check/${sectionId}/${studentId}`)
  },
  getActiveSessionPermissions(sectionId: string): Promise<SessionPermission[]> {
    return get(`/session-permissions/${sectionId}`)
  },

  // ── Proof of Class ──
  uploadProofOfClass(data: { sectionId: string; sessionId: string; photoData: string; description?: string; uploadedBy: string; uploadedByStudentName: string }): Promise<ProofOfClass> {
    const { uploadedBy: _uploadedBy, uploadedByStudentName: _uploadedByStudentName, ...body } = data
    return post('/proofs', body)
  },
  getProofsOfClass(sessionId: string): Promise<ProofOfClass[]> { return get(`/proofs/${sessionId}`) },
  deleteProofOfClass(proofId: string): Promise<boolean> { return del(`/proofs/${proofId}`) },

  // ── Miscellaneous ──
  enrollStudent(data: EnrollStudentInput): Promise<boolean> {
    return post(`/sections/${data.sectionId}/enroll-student`, data)
  },
  getCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    return get(`/calendar/events?startDate=${startDate}&endDate=${endDate}`)
  },
  createBulkSessions(data: BulkSessionInput): Promise<Session[]> {
    const { teacherId: _teacherId, ...body } = data
    return post('/sessions/bulk', body)
  },
  async exportAttendanceCsv(sectionId?: string, sessionId?: string): Promise<string> {
    let path = '/reports/export'
    const params = new URLSearchParams()
    if (sectionId) params.set('sectionId', sectionId)
    if (sessionId) params.set('sessionId', sessionId)
    const qs = params.toString()
    if (qs) path += `?${qs}`
    const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() })
    return res.text()
  },
  search(query: string): Promise<{ students: Student[]; sections: Section[]; sessions: Session[] }> {
    return get(`/search?q=${encodeURIComponent(query)}`)
  },
}
