import { Platform } from 'react-native'
import { getRecentCampusDateRange, isWithinGeofence, signQRToken, verifyQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type StudentDisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput, type CreateTeacherInput, type CreateStudentInput, type ResetUserPasswordResult, type ScanEvidenceInput, type AttendanceReport, type AttendanceReportFilters, type DashboardOverview, type ApiClient } from '@polycheck/shared'
import { API_BASE } from './api-config'
import { getOrCreateTeacherSigningKey } from './signing-key'
import {
  cacheAttendanceRecords,
  cacheSections,
  cacheSessions,
  cacheSubjects,
  drainOfflineQueue,
  enqueueOfflineOperation,
  getCachedAttendanceRecords,
  getCachedSection,
  getCachedSections,
  getCachedSession,
  getCachedSessions,
  getCachedSubject,
  getCachedSubjects,
  getServerClockOffset,
  initializeOfflineStore,
  removeCachedAttendanceAttempt,
  replaceCachedAttendanceForStudent,
  replaceCachedSections,
  replaceCachedSubjects,
  setOfflineOwner,
  setServerClockOffset,
  type OfflineOperationKind,
  type OfflineSendResult,
} from './offline-store'

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
  return getRecentCampusDateRange(days)
}

function queryPath(path: string, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function classifyAttendanceSyncError(
  error: string,
): Extract<OfflineSendResult, { outcome: 'retryable' | 'terminal' }> {
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

// Offline fallback data — returns empty arrays for first-run / unsynced users
// instead of displaying fake subjects that don't correspond to real data.

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
    await initializeOfflineStore(currentUser.id)
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
    await initializeOfflineStore(currentUser.id)
    await saveUserToStore(currentUser)
    await setTokenInStore(data.token)
    notifyAuthListeners()
    if (currentUser.role === 'teacher') {
      const key = await getOrCreateTeacherSigningKey(currentUser.id)
      await post('/auth/provision-key', { publicKey: key.publicKey })
    }
    return currentUser
  },

  async login(studentId: string): Promise<User | null> {
    return this.loginStudent(studentId)
  },

  async restoreSession(): Promise<User | null> {
    const [cachedUser, token] = await Promise.all([loadUserFromStore(), getTokenFromStore()])
    if (!cachedUser || !token) {
      setOfflineOwner(null)
      return null
    }
    currentUser = cachedUser
    await initializeOfflineStore(cachedUser.id)
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
      setOfflineOwner(null)
      currentUser = null
      await Promise.all([saveUserToStore(null), setTokenInStore(null)])
      return null
    }
  },

  async logout() {
    const token = await getTokenFromStore()
    currentUser = null
    setOfflineOwner(null)
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
      const subjects = await get<Subject[]>('/subjects')
      await replaceCachedSubjects(subjects)
      return subjects
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedSubjects()
    }
  },
  async getSubject(id: string): Promise<Subject> {
    try {
      const subject = await get<Subject>(`/subjects/${id}`)
      await cacheSubjects([subject])
      return subject
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const subject = await getCachedSubject(id)
      if (!subject) throw new Error('Subject not found locally. Please sync while online first.')
      return subject
    }
  },
  createSubject(data: CreateSubjectInput): Promise<Subject> { return post('/subjects', data) },

  // ── Sections ──
  async getSections(subjectId?: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(`/sections${subjectId ? `?subjectId=${subjectId}` : ''}`)
      if (subjectId) await cacheSections(sections)
      else await replaceCachedSections(sections)
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
      if (!section) throw new Error('Section not found locally. Please sync while online first.')
      return section
    }
  },
  createSection(data: CreateSectionInput): Promise<Section> { return post('/sections', data) },
  getSectionStudents(sectionId: string): Promise<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]> {
    return get<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]>(
      `/sections/${sectionId}/students`,
    ).catch((error) => {
      if (!isNetworkError(error)) throw error
      return []
    })
  },
  getStudentsForSection(sectionId: string): Promise<Student[]> {
    return get<Student[]>(`/sections/${sectionId}/students`).catch((error) => {
      if (!isNetworkError(error)) throw error
      return []
    })
  },
  async getStudentSections(studentId: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(`/sections?studentId=${studentId}`)
      await replaceCachedSections(sections)
      return sections
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return await getCachedSections()
    }
  },
  async resetEnrollmentCode(sectionId: string): Promise<{ enrollmentCode: string }> {
    try {
      const result = await post<{ enrollmentCode: string }>(`/sections/${sectionId}/enrollment-code/reset`)
      if (result && result.enrollmentCode) return result
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
    throw new Error('Cannot reset enrollment code while offline. Please try again when connected.')
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
    const user = this.getCurrentUser()
    if (!user || user.role !== 'teacher') throw new Error('A teacher account is required to sign QR tokens')
    const [session, key] = await Promise.all([
      this.getSession(sessionId),
      getOrCreateTeacherSigningKey(user.id),
    ])
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
  getAttendanceRecords(sessionId?: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
    const scope = sessionId
      ? { sessionId, limit: 1000 }
      : startDate && endDate
        ? { startDate, endDate, limit: 1000 }
        : { ...recentDateRange(31), limit: 1000 }
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
  async submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string, qrToken: string, scannedAt?: string, evidence?: ScanEvidenceInput): Promise<AttendanceRecord | { error: string }> {
    const payload = { sessionId, lat, lon, deviceId, qrToken, scannedAt: scannedAt ?? new Date().toISOString(), ...evidence }
    try {
      const result = await post<AttendanceRecord | { error: string }>('/attendance/scan', payload)
      if (!('error' in result)) await cacheAttendanceRecords([result])
      return result
    } catch (error) {
      if (!isNetworkError(error)) throw error
      if (!qrToken) return { error: 'QR token is required' }
      const tokenPayload = verifyQRToken(qrToken, (await getCachedSession(sessionId))?.teacherPublicKey ?? '')
      if (!tokenPayload) return { error: 'QR token signature is invalid' }
      const timestamp = payload.scannedAt
      const capturedAt = new Date(timestamp).getTime()
      const validityEnd = tokenPayload.issuedAt + tokenPayload.validityMinutes * 60_000
      const graceEnd = validityEnd + tokenPayload.gracePeriodMinutes * 60_000
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
      await enqueueOfflineOperation('attendance_scan', payload)
      const record: AttendanceRecord = {
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
      await cacheAttendanceRecords([record])
      return record
    }
  },
  async checkAttendance(sessionId: string, _studentId: string, lat: number, lon: number, qrToken?: string, scannedAt?: string): Promise<SubmitAttendanceResult> {
    try {
      return await post('/attendance/check', { sessionId, lat, lon, qrToken, scannedAt })
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const session = await getCachedSession(sessionId)
      const clockOffset = await getServerClockOffset()
      if (!session || !qrToken || !session.teacherPublicKey || clockOffset === null) {
        return { success: false, status: 'absent', reason: 'not_synced', message: 'Session security time and class data are not available offline. Sync before class.' }
      }
      const payload = verifyQRToken(qrToken, session.teacherPublicKey)
      if (!payload || payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== session.teacherId) {
        return { success: false, status: 'disputed', reason: 'invalid_signature', message: 'QR token signature is invalid' }
      }
      if (!isWithinGeofence(lat, lon, session.geofence.latitude, session.geofence.longitude, session.geofence.radiusMeters)) {
        return { success: false, status: 'absent', reason: 'outside_geofence', message: 'You are outside the session geofence' }
      }
      const capturedAt = new Date(scannedAt ?? Date.now()).getTime()
      if (session.endedAt && capturedAt > new Date(session.endedAt).getTime()) return { success: false, status: 'absent', reason: 'session_inactive', message: 'Session was not active at scan time' }
      const validityEnd = payload.issuedAt + payload.validityMinutes * 60_000
      const graceEnd = validityEnd + payload.gracePeriodMinutes * 60_000
      if (!Number.isFinite(capturedAt) || capturedAt < payload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return { success: false, status: 'absent', reason: 'qr_expired', message: 'The QR attendance window has expired' }
      }
      await enqueueOfflineOperation('scan_attempt', { sessionId, lat, lon, deviceId: 'device-mobile', qrToken, scannedAt })
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
      const records = await get<AttendanceRecord[]>(`/attendance/student/${studentId}`)
      await replaceCachedAttendanceForStudent(studentId, records)
      return getCachedAttendanceRecords(studentId)
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedAttendanceRecords(studentId)
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
    const user = this.getCurrentUser()
    if (!user) return
    await initializeOfflineStore(user.id)
    await drainOfflineQueue(async (kind: OfflineOperationKind, payload) => {
      if (kind === 'attendance_scan') {
        const response = await post<{
          queued: false
          results: Array<AttendanceRecord | { error: string }>
        }>('/sync/attendance', {
          records: [payload],
        })
        const result = response.results[0]
        if (!result) return { outcome: 'retryable', error: 'Attendance sync returned no result' }
        if ('error' in result) return classifyAttendanceSyncError(result.error)
        await removeCachedAttendanceAttempt(String(payload.sessionId), user.id)
        await cacheAttendanceRecords([{ ...result, isSynced: true }])
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
    const user = this.getCurrentUser()
    if (!user) return
    await initializeOfflineStore(user.id)
    try {
      const startedAt = Date.now()
      const health = await get<{ timestamp: string }>('/health')
      const completedAt = Date.now()
      const serverTime = new Date(health.timestamp).getTime()
      if (Number.isFinite(serverTime)) await setServerClockOffset(serverTime - (startedAt + completedAt) / 2)
      await this.syncOfflineQueue()
      await Promise.all([
        this.getSubjects(),
        this.getSections(),
        this.getSessions(),
        ...(user.role === 'student' ? [this.getMyAttendance(user.id)] : []),
      ])
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
    } catch (error) {
      if (!isNetworkError(error)) throw error
      const q = trimmed.toLowerCase()
      const [allSections, allSessions] = await Promise.all([getCachedSections(), getCachedSessions()])
      const students: Student[] = []
      const sections = allSections.filter((sec) => `${sec.section} ${sec.room || ''} ${sec.semester}`.toLowerCase().includes(q))
      const sessions = allSessions.filter((sess) => `${sess.subjectName} ${sess.date} ${sess.startTime}`.toLowerCase().includes(q))
      return { students, sections, sessions }
    }
  },
}

api satisfies ApiClient
