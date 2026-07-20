import { Platform } from 'react-native'
import { isWithinGeofence, signQRToken, verifyQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type StudentDisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput, type CreateTeacherInput, type CreateStudentInput, type ResetUserPasswordResult, type ScanEvidenceInput, type AttendanceReport, type AttendanceReportFilters, type DashboardOverview } from '@polycheck/shared'
import { API_BASE } from './api-config'
import { getOrCreateTeacherSigningKey } from './signing-key'
import { cacheSections, cacheSessions, drainOfflineQueue, enqueueOfflineOperation, getCachedSection, getCachedSections, getCachedSession, getCachedSessions, getServerClockOffset, initializeOfflineStore, setServerClockOffset, type OfflineOperationKind, type OfflineSendResult } from './offline-store'

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
  if (tokenCache !== undefined) return tokenCache
  if (!SecureStoreModule) return null
  try {
    tokenCache = await SecureStoreModule.getItemAsync(TOKEN_KEY)
    return tokenCache
  } catch { return null }
}

async function setTokenInStore(token: string | null) {
  tokenCache = token
  if (!SecureStoreModule) return
  try {
    if (token) await SecureStoreModule.setItemAsync(TOKEN_KEY, token)
    else await SecureStoreModule.deleteItemAsync(TOKEN_KEY)
  } catch { /* noop */ }
}

let currentUser: User | null = null
let tokenCache: string | null | undefined
const authListeners = new Set<(user: User | null) => void>()

function recentDateRange(days = 30) {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

function queryPath(path: string, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function classifyAttendanceSyncError(error: string): OfflineSendResult {
  const message = error.toLowerCase()
  const terminalEvidenceFailures = [
    'signature is invalid',
    'does not match this session',
    'outside the session geofence',
    'mocked locations are not accepted',
    'location accuracy is too poor',
    'location fix is stale',
    'location uncertainty extends outside',
    'scan timestamp is invalid',
    'attendance window has expired',
    'already submitted for this session',
    'not enrolled in this section',
    'clientattemptid was already used',
  ]
  return terminalEvidenceFailures.some((failure) => message.includes(failure))
    ? { outcome: 'terminal', error }
    : { outcome: 'retryable', error }
}

function notifyAuthListeners() {
  for (const listener of authListeners) listener(currentUser)
}

export function subscribeToAuthChanges(listener: (user: User | null) => void) {
  authListeners.add(listener)
  listener(currentUser)
  return () => authListeners.delete(listener)
}

const FETCH_TIMEOUT = 10_000

const FALLBACK_SUBJECTS: Subject[] = [
  { id: 'subj-1', name: 'Data Structures and Algorithms', code: 'CS 201', description: 'Fundamental data structures and algorithmic problem solving.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'subj-2', name: 'Object-Oriented Programming', code: 'CS 102', description: 'Classes, inheritance, polymorphism, and software design.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'subj-3', name: 'Database Management Systems', code: 'CS 301', description: 'Relational databases, SQL, modeling, and transactions.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'subj-4', name: 'Web Development', code: 'CS 205', description: 'Full-stack web applications and modern web standards.', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
]

const FALLBACK_SECTIONS: Section[] = [
  {
    id: 'sec-101',
    subjectId: 'subj-1',
    section: 'BSCS 2-1',
    room: 'Room 304',
    schedule: [{ day: 'Mon', startTime: '08:00', endTime: '11:00', room: 'Room 304' }, { day: 'Wed', startTime: '08:00', endTime: '11:00', room: 'Room 304' }],
    semester: '1st Sem 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Miguel Dela Cruz',
    enrollmentCode: 'CS201A',
    enrollmentCodeExpiry: '2026-12-31T23:59:59.000Z',
    studentCount: 35,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sec-102',
    subjectId: 'subj-2',
    section: 'BSCS 2-1',
    room: 'Lab 2',
    schedule: [{ day: 'Tue', startTime: '13:00', endTime: '16:00', room: 'Lab 2' }, { day: 'Thu', startTime: '13:00', endTime: '16:00', room: 'Lab 2' }],
    semester: '1st Sem 2026-2027',
    teacherId: 't-001',
    teacherName: 'Prof. Juan Miguel Dela Cruz',
    enrollmentCode: 'CS102B',
    enrollmentCodeExpiry: '2026-12-31T23:59:59.000Z',
    studentCount: 32,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sec-103',
    subjectId: 'subj-3',
    section: 'BSCS 2-1',
    room: 'Room 402',
    schedule: [{ day: 'Fri', startTime: '09:00', endTime: '12:00', room: 'Room 402' }],
    semester: '1st Sem 2026-2027',
    teacherId: 't-002',
    teacherName: 'Prof. Maria Elena Santos',
    enrollmentCode: 'CS301C',
    enrollmentCodeExpiry: '2026-12-31T23:59:59.000Z',
    studentCount: 38,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const FALLBACK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'att-1', sessionId: 'sess-1', sectionId: 'sec-101', studentId: 's-001', studentName: 'Alexandra Marie Reyes', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'present', coordinates: { latitude: 14.5995, longitude: 120.9842 }, deviceId: 'dev-1', isSynced: true },
  { id: 'att-2', sessionId: 'sess-2', sectionId: 'sec-102', studentId: 's-001', studentName: 'Alexandra Marie Reyes', timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), status: 'present', coordinates: { latitude: 14.5995, longitude: 120.9842 }, deviceId: 'dev-1', isSynced: true },
  { id: 'att-3', sessionId: 'sess-3', sectionId: 'sec-103', studentId: 's-001', studentName: 'Alexandra Marie Reyes', timestamp: new Date(Date.now() - 86400000 * 6).toISOString(), status: 'late', coordinates: { latitude: 14.5995, longitude: 120.9842 }, deviceId: 'dev-1', isSynced: true },
]

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

function isNetworkError(error: unknown) {
  return !(error instanceof ApiRequestError) || error.status >= 500
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
  const text = await res.text()
  let data: any
  if (text && text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      currentUser = null
      await Promise.all([saveUserToStore(null), setTokenInStore(null)])
      notifyAuthListeners()
    }
    const message = data && typeof data === 'object' ? data.message : res.statusText
    throw new ApiRequestError(Array.isArray(message) ? message.join('. ') : message || 'Request failed', res.status)
  }
  return (data ?? {}) as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers: await authHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function del<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse<T>(res)
}

export const api = {
  async loginStudent(studentId: string, password?: string): Promise<User | null> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/mobile/login/student`, {
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
    notifyAuthListeners()
    return currentUser
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/mobile/login/faculty`, {
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
    notifyAuthListeners()
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
    const [cachedUser, token] = await Promise.all([loadUserFromStore(), getTokenFromStore()])
    if (!cachedUser || !token) return null
    currentUser = cachedUser
    try {
      const profile = await get<User>('/auth/me')
      currentUser = profile
      await saveUserToStore(profile)
      notifyAuthListeners()
      return profile
    } catch (error) {
      if (isNetworkError(error)) {
        notifyAuthListeners()
        return cachedUser
      }
      return null
    }
  },

  async logout() {
    const token = await getTokenFromStore()
    currentUser = null
    await Promise.all([saveUserToStore(null), setTokenInStore(null)])
    notifyAuthListeners()
    try {
      await fetchWithTimeout(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch { /* Local logout still succeeds while offline. */ }
  },

  getCurrentUser(): User | null {
    return currentUser
  },
  async getTrustedTimestamp(): Promise<string> {
    const offset = await getServerClockOffset()
    return new Date(Date.now() + (offset ?? 0)).toISOString()
  },

  // ── Subjects ──
  async getSubjects(): Promise<Subject[]> {
    try {
      return await get('/subjects')
    } catch {
      return FALLBACK_SUBJECTS
    }
  },
  async getSubject(id: string): Promise<Subject> {
    try {
      return await get(`/subjects/${id}`)
    } catch {
      return FALLBACK_SUBJECTS.find((s) => s.id === id) || FALLBACK_SUBJECTS[0]
    }
  },
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
      const list = sections.length > 0 ? sections : FALLBACK_SECTIONS
      return subjectId ? list.filter((section) => section.subjectId === subjectId) : list
    }
  },
  async getSection(id: string): Promise<Section> {
    try {
      const section = await get<Section>(`/sections/${id}`)
      await cacheSections([section])
      return section
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const section = (await getCachedSection(id)) || FALLBACK_SECTIONS.find((s) => s.id === id)
      if (!section) return FALLBACK_SECTIONS[0]
      return section
    }
  },
  createSection(data: CreateSectionInput): Promise<Section> { return post('/sections', data) },
  getSectionStudents(sectionId: string): Promise<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]> {
    return get<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]>(`/sections/${sectionId}/students`).catch(() => [])
  },
  getStudentsForSection(sectionId: string): Promise<Student[]> {
    return get<Student[]>(`/sections/${sectionId}/students`).catch(() => [])
  },
  async getStudentSections(studentId: string): Promise<Section[]> {
    try {
      return await get(`/sections?studentId=${studentId}`)
    } catch {
      const cached = await getCachedSections()
      return cached.length > 0 ? cached : FALLBACK_SECTIONS
    }
  },
  async resetEnrollmentCode(sectionId: string): Promise<{ enrollmentCode: string }> {
    try {
      const result = await post<{ enrollmentCode: string }>(`/sections/${sectionId}/enrollment-code/reset`)
      if (result && result.enrollmentCode) return result
    } catch { /* fallback below */ }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const section = FALLBACK_SECTIONS.find((s) => s.id === sectionId)
    if (section) section.enrollmentCode = code
    return { enrollmentCode: code }
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
  async generateQrCode(sessionId: string, validityMinutes: number, gracePeriodMinutes?: number): Promise<Session> {
    if (validityMinutes < 1 || validityMinutes > 15 || (gracePeriodMinutes ?? 0) > 60) {
      throw new Error('QR validity must be 1-15 minutes and grace must be 0-60 minutes')
    }
    const [session, key] = await Promise.all([this.getSession(sessionId), getOrCreateTeacherSigningKey()])
    const user = this.getCurrentUser()
    if (!user || user.role !== 'teacher') throw new Error('A teacher account is required to sign QR tokens')
    const issuedAt = new Date(await this.getTrustedTimestamp()).getTime()
    const effectiveGrace = gracePeriodMinutes ?? Math.min(session.gracePeriodMinutes, 60)
    if (effectiveGrace < 0 || effectiveGrace > 60) throw new Error('QR grace must be 0-60 minutes')
    const token = signQRToken({
      version: 1,
      sessionId: session.id,
      sectionId: session.sectionId,
      teacherId: user.id,
      teacherName: user.fullName,
      issuedAt,
      validityMinutes,
      gracePeriodMinutes: effectiveGrace,
    }, key.secretKey)
    try {
      await post('/auth/provision-key', { publicKey: key.publicKey })
      const activated = await post<Session>(`/sessions/${sessionId}/activate`, { validityMinutes, gracePeriodMinutes: effectiveGrace, token })
      await cacheSessions([activated])
      return activated
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const activated: Session = {
        ...session,
        isActive: true,
        qrToken: token,
        qrGeneratedAt: new Date(issuedAt).toISOString(),
        qrTokenExpiresAt: new Date(issuedAt + validityMinutes * 60_000).toISOString(),
        qrValidityMinutes: validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        teacherPublicKey: key.publicKey,
      }
      await enqueueOfflineOperation('session_activation', { sessionId, validityMinutes, gracePeriodMinutes: effectiveGrace, token })
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
      const clockOffset = await getServerClockOffset()
      if (!session) throw new Error('Session is not available offline')
      const ended = { ...session, isActive: false, endedAt: new Date(Date.now() + (clockOffset ?? 0)).toISOString() }
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
    const scope = sessionId ? { sessionId, limit: 1000 } : { ...recentDateRange(31), limit: 1000 }
    return get(queryPath('/attendance', scope))
  },
  getAttendanceSummaries(teacherId?: string): Promise<AttendanceSummary[]> {
    return get(queryPath('/attendance/summaries', { ...recentDateRange(), teacherId }))
  },
  getAttendanceReport(filters: AttendanceReportFilters = {}): Promise<AttendanceReport> {
    return get(queryPath('/attendance/report', { ...recentDateRange(), ...filters }))
  },
  getDashboardOverview(filters: Pick<AttendanceReportFilters, 'startDate' | 'endDate'> = {}): Promise<DashboardOverview> {
    return get(queryPath('/dashboard/overview', filters))
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
    void sessionId; void sectionId; void coordinates; void deviceId
    throw new Error('Attendance requires a freshly scanned, signed QR token')
  },
  async submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string, qrToken: string, scannedAt?: string, evidence?: ScanEvidenceInput): Promise<AttendanceRecord | { error: string }> {
    const payload = { sessionId, lat, lon, deviceId, qrToken, scannedAt: scannedAt ?? new Date().toISOString(), ...evidence }
    try {
      return await post('/attendance/scan', payload)
    } catch (error) {
      if (!isNetworkError(error)) throw error
      if (!qrToken) return { error: 'QR token is required' }
      const tokenPayload = verifyQRToken(qrToken, (await getCachedSession(sessionId))?.teacherPublicKey ?? '')
      if (!tokenPayload) return { error: 'QR token signature is invalid' }
      const timestamp = payload.scannedAt
      const capturedAt = new Date(timestamp).getTime()
      const validityEnd = tokenPayload.issuedAt + tokenPayload.validityMinutes * 60_000
      const graceEnd = validityEnd + tokenPayload.gracePeriodMinutes * 60_000
      await enqueueOfflineOperation('attendance_scan', payload)
      if (evidence?.mocked === true) return { error: 'Mocked locations are not accepted' }
      if ((evidence?.accuracyMeters ?? 0) > 50) return { error: 'Location accuracy is too poor to verify attendance' }
      if (evidence?.locationCapturedAt && Math.abs(capturedAt - new Date(evidence.locationCapturedAt).getTime()) > 2 * 60_000) {
        return { error: 'Location fix is stale. Acquire a fresh location and try again.' }
      }
      const cachedSession = await getCachedSession(sessionId)
      if (!cachedSession || !isWithinGeofence(lat, lon, cachedSession.geofence.latitude, cachedSession.geofence.longitude, cachedSession.geofence.radiusMeters)) {
        return { error: 'You are outside the session geofence' }
      }
      if (!Number.isFinite(capturedAt) || capturedAt < tokenPayload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return { error: 'The QR attendance window has expired' }
      }
      return {
        id: `offline:${sessionId}:${studentId}`,
        sessionId,
        sectionId: tokenPayload.sectionId,
        studentId,
        studentName,
        timestamp,
        status: capturedAt <= validityEnd ? 'present' : 'late',
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
      const clockOffset = await getServerClockOffset()
      const queueDenied = async (result: SubmitAttendanceResult) => {
        await enqueueOfflineOperation('scan_attempt', { sessionId, lat, lon, deviceId: 'device-mobile', qrToken, scannedAt })
        return result
      }
      if (!session || !qrToken || !session.teacherPublicKey || clockOffset === null) return queueDenied({ success: false, status: 'absent', reason: 'not_synced', message: 'Session security time and class data are not available offline. Sync before class.' })
      const payload = verifyQRToken(qrToken, session.teacherPublicKey)
      if (!payload || payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== session.teacherId) {
        return queueDenied({ success: false, status: 'disputed', reason: 'invalid_signature', message: 'QR token signature is invalid' })
      }
      if (!isWithinGeofence(lat, lon, session.geofence.latitude, session.geofence.longitude, session.geofence.radiusMeters)) {
        return queueDenied({ success: false, status: 'absent', reason: 'outside_geofence', message: 'You are outside the session geofence' })
      }
      const capturedAt = new Date(scannedAt ?? Date.now()).getTime()
      if (session.endedAt && capturedAt > new Date(session.endedAt).getTime()) return queueDenied({ success: false, status: 'absent', reason: 'session_inactive', message: 'Session was not active at scan time' })
      const validityEnd = payload.issuedAt + payload.validityMinutes * 60_000
      const graceEnd = validityEnd + payload.gracePeriodMinutes * 60_000
      if (!Number.isFinite(capturedAt) || capturedAt < payload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return queueDenied({ success: false, status: 'absent', reason: 'qr_expired', message: 'The QR attendance window has expired' })
      }
      const status = capturedAt <= validityEnd ? 'present' : 'late'
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
  submitDispute(data: { recordId: string; reason: StudentDisputeReason; description: string }): Promise<AttendanceRecord> {
    return post('/disputes', data)
  },

  // ── Users ──
  getStudents(): Promise<Student[]> { return get('/users/students') },
  getStudent(id: string): Promise<Student> { return get(`/users/${id}`) },
  getTeachers(): Promise<Teacher[]> { return get('/users/teachers') },
  createTeacher(data: CreateTeacherInput): Promise<Teacher> {
    return post('/users/teachers', data)
  },
  createStudent(data: CreateStudentInput): Promise<Student> {
    return post('/users/students', data)
  },
  resetUserPassword(id: string, password: string): Promise<ResetUserPasswordResult> {
    return patch(`/users/${id}/password`, { password })
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
  async getMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
    try {
      return await get(`/attendance/student/${studentId}`)
    } catch {
      return FALLBACK_ATTENDANCE
    }
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
        const response = await post<{ queued: false; results: Array<{ error?: string }> }>('/sync/attendance', {
          records: [payload],
        })
        const result = response.results[0]
        if (!result) return { outcome: 'retryable', error: 'Attendance sync returned no result' }
        if (result.error) return classifyAttendanceSyncError(result.error)
        return { outcome: 'synced' }
      }
      if (kind === 'scan_attempt') {
        await post('/attendance/check', payload)
        return
      }
      const sessionId = String(payload.sessionId)
      if (kind === 'session_activation') {
        await post(`/sessions/${sessionId}/activate`, { validityMinutes: payload.validityMinutes, gracePeriodMinutes: payload.gracePeriodMinutes, token: payload.token })
        return
      }
      await post(`/sessions/${sessionId}/end`)
    })
  },
  async preSyncOfflineData(): Promise<void> {
    await initializeOfflineStore()
    if (!this.getCurrentUser()) return
    try {
      const startedAt = Date.now()
      const health = await get<{ timestamp: string }>('/health')
      const completedAt = Date.now()
      const serverTime = new Date(health.timestamp).getTime()
      if (Number.isFinite(serverTime)) await setServerClockOffset(serverTime - (startedAt + completedAt) / 2)
      await this.syncOfflineQueue()
      await Promise.all([this.getSections(), this.getSessions()])
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  },
  async exportAttendanceCsv(filters: AttendanceReportFilters = {}): Promise<string> {
    const path = queryPath('/reports/export', { ...recentDateRange(), ...filters })
    const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers: await authHeaders() })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(Array.isArray(error.message) ? error.message.join('. ') : error.message || 'Export failed')
    }
    return res.text()
  },
  async search(query: string): Promise<{ students: Student[]; sections: Section[]; sessions: Session[] }> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return { students: [], sections: [], sessions: [] }
    try {
      return await get<{ students: Student[]; sections: Section[]; sessions: Session[] }>(`/search?q=${encodeURIComponent(trimmed)}`)
    } catch {
      const q = trimmed.toLowerCase()
      const [allStudents, allSections, allSessions] = await Promise.all([this.getStudents(), this.getSections(), this.getSessions()])
      const students = allStudents.filter((s) => `${s.fullName} ${s.studentId} ${s.program}`.toLowerCase().includes(q))
      const sections = allSections.filter((sec) => `${sec.section} ${sec.room || ''} ${sec.semester}`.toLowerCase().includes(q))
      const sessions = allSessions.filter((sess) => `${sess.subjectName} ${sess.date} ${sess.startTime}`.toLowerCase().includes(q))
      return { students, sections, sessions }
    }
  },
}
