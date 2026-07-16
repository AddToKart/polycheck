import { Platform } from 'react-native'
import { isWithinGeofence, signQRToken, verifyQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type DisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput } from '@polycheck/shared'
import { API_BASE } from './api-config'
import { getOrCreateTeacherSigningKey } from './signing-key'
import { cacheSections, cacheSessions, drainOfflineQueue, enqueueOfflineOperation, getCachedSection, getCachedSections, getCachedSession, getCachedSessions, initializeOfflineStore, type OfflineOperationKind } from './offline-store'

const STORAGE_KEY = 'polycheck-user'
const TOKEN_KEY = 'polycheck-token'

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

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function isNetworkError(error: unknown) {
  return !(error instanceof ApiRequestError)
}

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
    throw new ApiRequestError(err.message || 'Request failed', res.status)
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
    if (currentUser.role === 'teacher') {
      const key = await getOrCreateTeacherSigningKey()
      await post('/auth/provision-key', { publicKey: key.publicKey })
    }
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
  async getSections(subjectId?: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(`/sections${subjectId ? `?subjectId=${subjectId}` : ''}`)
      await cacheSections(sections)
      return sections
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const sections = await getCachedSections()
      return subjectId ? sections.filter((section) => section.subjectId === subjectId) : sections
    }
  },
  async getSection(id: string): Promise<Section> {
    try {
      const section = await get<Section>(`/sections/${id}`)
      await cacheSections([section])
      return section
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const section = await getCachedSection(id)
      if (!section) throw new Error('Section is not available offline. Sync before class.')
      return section
    }
  },
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
  async getSessions(sectionId?: string): Promise<Session[]> {
    try {
      const sessions = await get<Session[]>(`/sessions${sectionId ? `?sectionId=${sectionId}` : ''}`)
      await cacheSessions(sessions)
      return sessions
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedSessions(sectionId)
    }
  },
  async getSession(id: string): Promise<Session> {
    try {
      const session = await get<Session>(`/sessions/${id}`)
      await cacheSessions([session])
      return session
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const session = await getCachedSession(id)
      if (!session) throw new Error('Session is not available offline. Sync before class.')
      return session
    }
  },
  createSession(data: CreateSessionInput): Promise<Session> {
    const { teacherId: _teacherId, ...body } = data
    return post('/sessions', body)
  },
  async generateQrCode(sessionId: string, validityMinutes: number): Promise<Session> {
    const [session, key] = await Promise.all([get<Session>(`/sessions/${sessionId}`), getOrCreateTeacherSigningKey()])
    const user = this.getCurrentUser()
    if (!user || user.role !== 'teacher') throw new Error('A teacher account is required to sign QR tokens')
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
    try {
      await post('/auth/provision-key', { publicKey: key.publicKey })
      const activated = await post<Session>(`/sessions/${sessionId}/activate`, { validityMinutes, token })
      await cacheSessions([activated])
      return activated
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const activated: Session = {
        ...session,
        isActive: true,
        qrToken: token,
        qrGeneratedAt: new Date().toISOString(),
        qrTokenExpiresAt: new Date(Date.now() + validityMinutes * 60_000).toISOString(),
        qrValidityMinutes: validityMinutes,
        teacherPublicKey: key.publicKey,
      }
      await enqueueOfflineOperation('session_activation', { sessionId, validityMinutes, token })
      await cacheSessions([activated])
      return activated
    }
  },
  async endSession(sessionId: string): Promise<Session> {
    try {
      const ended = await post<Session>(`/sessions/${sessionId}/end`)
      await cacheSessions([ended])
      return ended
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const session = await getCachedSession(sessionId)
      if (!session) throw new Error('Session is not available offline')
      const ended = { ...session, isActive: false, endedAt: new Date().toISOString() }
      await enqueueOfflineOperation('session_end', { sessionId })
      await cacheSessions([ended])
      return ended
    }
  },
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
  async submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string, qrToken?: string, scannedAt?: string): Promise<AttendanceRecord | { error: string }> {
    const payload = { sessionId, lat, lon, deviceId, qrToken, scannedAt: scannedAt ?? new Date().toISOString() }
    try {
      return await post('/attendance/scan', payload)
    } catch (error) {
      if (!isNetworkError(error)) throw error
      if (!qrToken) return { error: 'QR token is required' }
      const tokenPayload = verifyQRToken(qrToken, (await getCachedSession(sessionId))?.teacherPublicKey ?? '')
      if (!tokenPayload) return { error: 'QR token signature is invalid' }
      await enqueueOfflineOperation('attendance_scan', payload)
      const timestamp = payload.scannedAt
      return {
        id: `offline:${sessionId}:${studentId}`,
        sessionId,
        sectionId: tokenPayload.sectionId,
        studentId,
        studentName,
        timestamp,
        status: new Date(timestamp).getTime() <= tokenPayload.issuedAt + tokenPayload.validityMinutes * 60_000 ? 'present' : 'late',
        coordinates: { latitude: lat, longitude: lon },
        deviceId,
        tokenSnapshot: qrToken,
        isSynced: false,
      }
    }
  },
  async checkAttendance(sessionId: string, _studentId: string, lat: number, lon: number, qrToken?: string, scannedAt?: string): Promise<SubmitAttendanceResult> {
    try {
      return await post('/attendance/check', { sessionId, lat, lon, qrToken, scannedAt })
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const session = await getCachedSession(sessionId)
      const queueDenied = async (result: SubmitAttendanceResult) => {
        await enqueueOfflineOperation('scan_attempt', { sessionId, lat, lon, deviceId: 'device-mobile', qrToken, scannedAt })
        return result
      }
      if (!session || !qrToken || !session.teacherPublicKey) return queueDenied({ success: false, status: 'absent', reason: 'not_synced', message: 'Session security data is not available offline. Sync before class.' })
      const payload = verifyQRToken(qrToken, session.teacherPublicKey)
      if (!payload || payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== session.teacherId) {
        return queueDenied({ success: false, status: 'disputed', reason: 'invalid_signature', message: 'QR token signature is invalid' })
      }
      if (!isWithinGeofence(lat, lon, session.geofence.latitude, session.geofence.longitude, session.geofence.radiusMeters)) {
        return queueDenied({ success: false, status: 'absent', reason: 'outside_geofence', message: 'You are outside the session geofence' })
      }
      const capturedAt = new Date(scannedAt ?? Date.now()).getTime()
      if (session.endedAt && capturedAt > new Date(session.endedAt).getTime()) return queueDenied({ success: false, status: 'absent', reason: 'session_inactive', message: 'Session was not active at scan time' })
      const status = capturedAt <= payload.issuedAt + payload.validityMinutes * 60_000 ? 'present' : 'late'
      return { success: true, status, message: status === 'present' ? 'Check-in saved offline and queued for sync.' : 'Late check-in saved offline and queued for sync.' }
    }
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
  async syncOfflineQueue(): Promise<void> {
    await initializeOfflineStore()
    await drainOfflineQueue(async (kind: OfflineOperationKind, payload) => {
      if (kind === 'attendance_scan') {
        await post('/sync/attendance', { records: [payload] })
        return
      }
      if (kind === 'scan_attempt') {
        await post('/attendance/check', payload)
        return
      }
      const sessionId = String(payload.sessionId)
      if (kind === 'session_activation') {
        await post(`/sessions/${sessionId}/activate`, { validityMinutes: payload.validityMinutes, token: payload.token })
        return
      }
      await post(`/sessions/${sessionId}/end`)
    })
  },
  async preSyncOfflineData(): Promise<void> {
    await initializeOfflineStore()
    if (!this.getCurrentUser()) return
    try {
      await this.syncOfflineQueue()
      await Promise.all([this.getSections(), this.getSessions()])
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
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
