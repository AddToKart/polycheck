import { Platform } from 'react-native'
import type { User, Subject, Section, Session, AttendanceRecord, AttendanceSummary, AttendanceStatus, Student, Teacher, Enrollment, DisputeReason, SectionRole, SectionRoleType, SessionPermission, ProofOfClass, CalendarEvent, CreateSubjectInput, CreateSectionInput, CreateSessionInput, SubmitAttendanceResult, EnrollStudentInput, BulkSessionInput } from '@polycheck/shared'

const STORAGE_KEY = 'polycheck-user'
const TOKEN_KEY = 'polycheck-token'
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api'

let SecureStoreModule: typeof import('expo-secure-store') | null = null
if (Platform.OS !== 'web') {
  try {
    SecureStoreModule = require('expo-secure-store')
  } catch { /* noop */ }
}

async function loadUserFromStore(): Promise<User | null> {
  if (!SecureStoreModule) return null
  try {
    const raw = await SecureStoreModule.getItemAsync(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch { return null }
}

async function saveUserToStore(user: User | null) {
  if (!SecureStoreModule) return
  try {
    if (user) await SecureStoreModule.setItemAsync(STORAGE_KEY, JSON.stringify(user))
    else await SecureStoreModule.deleteItemAsync(STORAGE_KEY)
  } catch { /* noop */ }
}

async function getTokenFromStore(): Promise<string | null> {
  if (!SecureStoreModule) return null
  try {
    return await SecureStoreModule.getItemAsync(TOKEN_KEY)
  } catch { return null }
}

async function setTokenInStore(token: string | null) {
  if (!SecureStoreModule) return
  try {
    if (token) await SecureStoreModule.setItemAsync(TOKEN_KEY, token)
    else await SecureStoreModule.deleteItemAsync(TOKEN_KEY)
  } catch { /* noop */ }
}

let currentUser: User | null = null

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getTokenFromStore()
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
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    currentUser = data.user as User
    await saveUserToStore(currentUser)
    await setTokenInStore(data.token)
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
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    currentUser = data.user as User
    await saveUserToStore(currentUser)
    await setTokenInStore(data.token)
    return currentUser
  },

  async login(studentId: string): Promise<User | null> {
    return this.loginStudent(studentId)
  },

  async restoreSession(): Promise<User | null> {
    const u = await loadUserFromStore()
    if (u) currentUser = u
    return u
  },

  logout() {
    currentUser = null
    saveUserToStore(null)
    setTokenInStore(null)
  },

  getCurrentUser(): User | null {
    return currentUser
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

  // ── Sessions ──
  getSessions(sectionId?: string): Promise<Session[]> {
    return get(`/sessions${sectionId ? `?sectionId=${sectionId}` : ''}`)
  },
  getSession(id: string): Promise<Session> { return get(`/sessions/${id}`) },
  createSession(data: CreateSessionInput): Promise<Session> { return post('/sessions', data) },
  generateQrCode(sessionId: string, validityMinutes: number): Promise<Session> {
    return post(`/sessions/${sessionId}/activate`, { validityMinutes })
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
    return post('/attendance', record)
  },
  updateAttendanceStatus(recordId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    return patch(`/attendance/${recordId}/status`, { status })
  },
  submitAttendance(sessionId: string, sectionId: string, studentId: string, coordinates: { latitude: number; longitude: number }, deviceId: string): Promise<SubmitAttendanceResult> {
    return post('/attendance/submit', { sessionId, sectionId, studentId, coordinates, deviceId })
  },
  submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string): Promise<AttendanceRecord | { error: string }> {
    return post('/attendance/scan', { sessionId, studentId, studentName, lat, lon, deviceId })
  },
  checkAttendance(sessionId: string, studentId: string, lat: number, lon: number): Promise<SubmitAttendanceResult> {
    return post('/attendance/check', { sessionId, studentId, lat, lon })
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
  getMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return get(`/attendance/student/${studentId}`)
  },
  getMySubjects(studentId: string): Promise<Subject[]> {
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
    return post('/proofs', data)
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
  createBulkSessions(data: BulkSessionInput): Promise<Session[]> { return post('/sessions/bulk', data) },
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
