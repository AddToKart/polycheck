import { Platform } from 'react-native'
import { classifyAttendanceSyncError, getRecentCampusDateRange, isWithinGeofence, signQRToken, verifyQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type StudentDisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput, type CreateTeacherInput, type CreateStudentInput, type ResetUserPasswordResult, type ScanEvidenceInput, type AttendanceReport, type AttendanceReportFilters, type DashboardOverview, type ApiClient, type PrivacyNotice, type AuditLogFilters, type AuditLogPage, type StudentImportRequest, type StudentImportResult, type ImportJobStatus, type EnrollImportRow, type EnrollImportRequest, type EnrollImportResult, type AdminOverview, type AdminUserFilters, type AdminUserPage, type AssignableRole, type CreateAdminInput, type ServerStatusSnapshot, type UpdateUserInput, type AiCapabilities, type AiChatSendInput, type AiChatSendResult, type AiChatThread, type AiThreadSummary, type AttendanceStanding, type AppNotification, type NotificationReadInput, type PushTokenInput, type StudentAtRisk, type ExcuseDecision, type ExcuseReason, type CreateTeacherResult, type CreateStudentResult, type TeacherResetStudentPasswordResult, type EmergencyDeviceReleaseInput, type EmergencyDeviceReleaseResult, type UnregisterDeviceResult, type UpdateContactsInput, type SystemReport, type SystemReportFilters, type SystemReportPage, type SystemReportStats, type CreateSystemReportInput, type UpdateSystemReportStatusInput } from '@polycheck/shared'
import { bytesToBase64 } from '../lib/base64'
import { API_BASE } from './api-config'
import { getOrCreateTeacherSigningKey } from './signing-key'
import { getOrCreateInstallationId } from './device-id'
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
// Tracks teachers whose public key was already uploaded in this app session.
// Provisioning is rate limited server-side, so it must not repeat per QR generation.
const provisionedTeacherKeys = new Set<string>()
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

// Re-exported for existing consumers/tests; the implementation is shared with web.
export { classifyAttendanceSyncError }

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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly remainingMinutes?: number,
  ) {
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

const ASSISTANT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
}

const ASSISTANT_UTIS: Record<string, string> = {
  pdf: 'com.adobe.pdf',
  docx: 'org.openxmlformats.wordprocessingml.document',
  csv: 'public.comma-separated-values-text',
}

function safeDownloadFileName(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || 'assistant-download'
}

function assistantFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index === -1 ? '' : fileName.slice(index + 1).toLowerCase()
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
    const code = data && typeof data === 'object' && typeof data.code === 'string' ? data.code : undefined
    const remainingMinutes =
      data && typeof data === 'object' && typeof data.remainingMinutes === 'number'
        ? data.remainingMinutes
        : undefined
    if (res.status === 403 && code === 'password_change_required' && currentUser && !currentUser.mustChangePassword) {
      // Admin reset the password while this device kept an older cached
      // profile. Flag it locally so the blocking password gate takes over.
      currentUser = { ...currentUser, mustChangePassword: true }
      await saveUserToStore(currentUser)
      notifyAuthListeners()
    }
    throw new ApiRequestError(Array.isArray(message) ? message.join('. ') : message || 'Request failed', res.status, code, remainingMinutes)
  }
  return (data ?? {}) as T
}

/**
 * Parses a failed login response into the shared typed error shape so callers
 * can branch on `device_cooldown_active` and render the remaining minutes.
 */
async function throwLoginError(res: Response, fallback: string): Promise<never> {
  const data = await res.json().catch(() => ({ message: fallback }))
  const rawMessage = data && typeof data === 'object' ? (data as { message?: unknown }).message : undefined
  const message = Array.isArray(rawMessage)
    ? rawMessage.join('. ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : fallback
  const code =
    data && typeof data === 'object' && typeof (data as { code?: unknown }).code === 'string'
      ? ((data as { code: string }).code)
      : undefined
  const remainingMinutes =
    data && typeof data === 'object' && typeof (data as { remainingMinutes?: unknown }).remainingMinutes === 'number'
      ? ((data as { remainingMinutes: number }).remainingMinutes)
      : undefined
  throw new ApiRequestError(message, res.status, code, remainingMinutes)
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers: await authHeaders() })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body?: unknown, operationId?: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...await authHeaders(), ...(operationId ? { 'Idempotency-Key': operationId } : {}) },
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
  getPrivacyNotice(): Promise<PrivacyNotice> {
    return get('/auth/privacy-notice')
  },

  async acceptPrivacyConsent(version: string): Promise<User> {
    const user = await post<User>('/auth/privacy-consent', { version })
    currentUser = user
    await saveUserToStore(user)
    notifyAuthListeners()
    return user
  },

  async loginStudent(studentId: string, password?: string): Promise<User | null> {
    const deviceId = await getOrCreateInstallationId().catch(() => undefined)
    const res = await fetchWithTimeout(`${API_BASE}/auth/mobile/login/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password: password ?? '', ...(deviceId ? { deviceId } : {}) }),
    })
    if (!res.ok) await throwLoginError(res, 'Login failed')
    const data = await res.json()
    currentUser = data.user as User
    await initializeOfflineStore(currentUser.id)
    await saveUserToStore(currentUser)
    await setTokenInStore(data.token)
    notifyAuthListeners()
    return currentUser
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    const deviceId = await getOrCreateInstallationId().catch(() => undefined)
    const res = await fetchWithTimeout(`${API_BASE}/auth/mobile/login/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password ?? '', ...(deviceId ? { deviceId } : {}) }),
    })
    if (!res.ok) await throwLoginError(res, 'Login failed')
    const data = await res.json()
    currentUser = data.user as User
    await initializeOfflineStore(currentUser.id)
    await saveUserToStore(currentUser)
    await setTokenInStore(data.token)
    notifyAuthListeners()
    if (currentUser.role === 'teacher') {
      const key = await getOrCreateTeacherSigningKey(currentUser.id)
      await post('/auth/provision-key', { publicKey: key.publicKey })
      provisionedTeacherKeys.add(currentUser.id)
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
      // Cold start gets a shorter verification budget so a black-holed network
      // cannot hold the splash for the full request timeout.
      const response = await fetchWithTimeout(`${API_BASE}/auth/me`, { headers: await authHeaders() }, 4_000)
      const profile = await handleResponse<User>(response)
      currentUser = profile
      await saveUserToStore(profile)
      notifyAuthListeners()
      return profile
    } catch (error) {
      if (isNetworkError(error)) {
        notifyAuthListeners()
        return cachedUser
      }
      if (error instanceof ApiRequestError && error.status === 403 && error.code === 'password_change_required') {
        // The backend blocks protected endpoints until the temporary password
        // is replaced. Keep the cached profile (flagged) so the password gate
        // takes over instead of silently signing the user out.
        const flagged = { ...cachedUser, mustChangePassword: true }
        currentUser = flagged
        await saveUserToStore(flagged)
        notifyAuthListeners()
        return flagged
      }
      setOfflineOwner(null)
      currentUser = null
      await Promise.all([saveUserToStore(null), setTokenInStore(null)])
      return null
    }
  },

  async changePassword(currentPassword: string | undefined, newPassword: string): Promise<User> {
    try {
      // The shared contract types this as a full User. Some server builds
      // return only the rotation status, so accept both shapes and merge.
      const result = await post<User | { message?: string; mustChangePassword?: boolean }>(
        '/auth/change-password',
        { currentPassword, newPassword },
      )
      const existing = currentUser ?? await loadUserFromStore()
      let nextUser: User
      if (result && typeof result === 'object' && 'role' in result && 'fullName' in result) {
        nextUser = result
      } else if (existing) {
        nextUser = {
          ...existing,
          mustChangePassword: (result as { mustChangePassword?: boolean }).mustChangePassword ?? false,
        }
      } else {
        nextUser = await get<User>('/auth/me')
      }
      currentUser = nextUser
      await saveUserToStore(nextUser)
      notifyAuthListeners()
      return nextUser
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 403 && error.code === 'password_change_required') {
        // A 403 here is an ordinary validation message (e.g. a current-password
        // requirement), not a reason to drop the authenticated session.
        throw new Error(error.message && error.message !== 'Forbidden' ? error.message : 'You must change your temporary password before continuing.')
      }
      throw error
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
      // Public key persists server-side and provisioning is rate limited, so only
      // upload when it was not already provisioned in this session. A key that
      // matches the cached session is already known to the server.
      if (!provisionedTeacherKeys.has(user.id)) {
        if (session.teacherPublicKey === key.publicKey) {
          provisionedTeacherKeys.add(user.id)
        } else {
          try {
            await post('/auth/provision-key', { publicKey: key.publicKey })
            provisionedTeacherKeys.add(user.id)
          } catch (error) {
            if (!isNetworkError(error)) throw error
            throw new Error('Connect to the internet once to register this device before generating offline QR codes.')
          }
        }
      }
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
  async getSectionSessions(sectionId: string): Promise<Session[]> {
    try {
      const sessions = await get<Session[]>(`/sessions?sectionId=${sectionId}`)
      await cacheSessions(sessions)
      return sessions
    } catch (error) {
      if (!isNetworkError(error)) throw error
      return getCachedSessions(sectionId)
    }
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
  getAdminOverview(): Promise<AdminOverview> {
    return get('/dashboard/admin-overview')
  },
  getServerStatus(): Promise<ServerStatusSnapshot> {
    return get('/dashboard/server-status')
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
      const cachedSession = await getCachedSession(sessionId)
      if (!cachedSession || !isWithinGeofence(lat, lon, cachedSession.geofence.latitude, cachedSession.geofence.longitude, cachedSession.geofence.radiusMeters)) {
        return { error: 'You are outside the session geofence' }
      }
      if ((evidence?.accuracyMeters ?? 0) > 50) return { error: 'Location accuracy is too poor to verify attendance' }
      if (evidence?.locationCapturedAt && Math.abs(capturedAt - new Date(evidence.locationCapturedAt).getTime()) > 2 * 60_000) {
        return { error: 'Location fix is stale. Acquire a fresh location and try again.' }
      }
      if (!Number.isFinite(capturedAt) || capturedAt < tokenPayload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return { error: 'The QR attendance window has expired' }
      }
      await enqueueOfflineOperation('attendance_scan', payload)
      const deviceSecurityFlagged = Object.values(evidence?.deviceSecurity ?? {}).some((detected) => detected === true)
      const record: AttendanceRecord = {
        id: `offline:${sessionId}:${studentId}`,
        sessionId,
        sectionId: tokenPayload.sectionId,
        studentId,
        studentName,
        timestamp,
        status: deviceSecurityFlagged ? 'disputed' : capturedAt <= validityEnd ? 'present' : 'late',
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
      const deviceId = await getOrCreateInstallationId()
      await enqueueOfflineOperation('scan_attempt', { sessionId, lat, lon, deviceId, qrToken, scannedAt })
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

  // ── Excuses (Wave 4) ──
  requestExcuse(
    recordId: string,
    input: { reason: ExcuseReason; description: string; evidenceData?: string },
  ): Promise<AttendanceRecord> {
    return post(`/attendance/records/${encodeURIComponent(recordId)}/excuse`, input)
  },
  listExcuses(filters: { status?: 'requested' | 'approved' | 'rejected'; sectionId?: string; startDate?: string; endDate?: string } = {}): Promise<AttendanceRecord[]> {
    return get(queryPath('/attendance/excuses', { ...filters }))
  },
  decideExcuse(recordId: string, decision: ExcuseDecision, note?: string): Promise<AttendanceRecord> {
    return post(`/attendance/records/${encodeURIComponent(recordId)}/excuse/decision`, { decision, note })
  },
  getAtRiskStudents(filters: { sectionId?: string; limit?: number } = {}): Promise<StudentAtRisk[]> {
    return get(queryPath('/attendance/at-risk', { ...filters }))
  },

  // ── Notifications (Wave 4) ──
  getNotifications(filters: { unreadOnly?: boolean; limit?: number } = {}): Promise<AppNotification[]> {
    return get(queryPath('/notifications', { unreadOnly: filters.unreadOnly ? 'true' : undefined, limit: filters.limit }))
  },
  getUnreadNotificationCount(): Promise<number> {
    return get('/notifications/unread-count')
  },
  markNotificationsRead(input: NotificationReadInput = { all: true }): Promise<number> {
    return post('/notifications/read', input)
  },
  registerPushToken(input: PushTokenInput): Promise<boolean> {
    return post('/notifications/push-token', input)
  },

  // ── Users ──
  getStudents(): Promise<Student[]> { return get('/users/students') },
  getStudent(id: string): Promise<Student> { return get(`/users/${id}`) },
  getTeachers(): Promise<Teacher[]> { return get('/users/teachers') },
  getUsers(filters: AdminUserFilters = {}): Promise<AdminUserPage> {
    return get(queryPath('/users', {
      role: filters.role,
      q: filters.q,
      department: filters.department,
      status: filters.status,
      limit: filters.limit,
      offset: filters.offset,
    }))
  },
  updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return patch(`/users/${id}`, input)
  },
  changeUserRole(id: string, role: AssignableRole): Promise<User> {
    return patch(`/users/${id}/role`, { role })
  },
  createAdmin(input: CreateAdminInput): Promise<User> {
    return post('/users/admins', input)
  },
  createTeacher(data: CreateTeacherInput): Promise<CreateTeacherResult> {
    return post('/users/teachers', data)
  },
  createStudent(data: CreateStudentInput): Promise<CreateStudentResult> {
    return post('/users/students', data)
  },
  resetUserPassword(id: string, password?: string): Promise<ResetUserPasswordResult> {
    return patch(`/users/${id}/password`, password === undefined ? {} : { password })
  },
  setUserStatus(id: string, isActive: boolean): Promise<User> {
    return patch(`/users/${id}/status`, { isActive })
  },
  teacherResetStudentPassword(
    studentId: string,
    sectionId: string,
  ): Promise<TeacherResetStudentPasswordResult> {
    return post(`/users/students/${studentId}/teacher-reset-password`, { sectionId })
  },
  emergencyReleaseDevice(
    studentId: string,
    input: EmergencyDeviceReleaseInput,
  ): Promise<EmergencyDeviceReleaseResult> {
    return post(`/users/students/${studentId}/device-release`, input)
  },
  unregisterDevice(deviceId: string): Promise<UnregisterDeviceResult> {
    return post('/users/me/device/unregister', { deviceId })
  },
  async updateContacts(input: UpdateContactsInput): Promise<User> {
    const updated = await patch<User>('/users/me/contacts', input)
    if (currentUser) {
      currentUser = { ...currentUser, ...updated }
      await saveUserToStore(currentUser)
      notifyAuthListeners()
    }
    return updated
  },

  // ── System issue & feedback reporting (SR) ──
  createSystemReport(input: CreateSystemReportInput): Promise<SystemReport> {
    return post('/reports', input)
  },
  getMySystemReports(): Promise<SystemReport[]> {
    return get('/reports/my')
  },
  getSystemReports(filters: SystemReportFilters = {}): Promise<SystemReportPage> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const query = params.toString()
    return get(`/reports${query ? `?${query}` : ''}`)
  },
  getSystemReportStats(): Promise<SystemReportStats> {
    return get('/reports/stats')
  },
  getSystemReport(id: string): Promise<SystemReport> {
    return get(`/reports/${id}`)
  },
  updateSystemReportStatus(id: string, input: UpdateSystemReportStatusInput): Promise<SystemReport> {
    return patch(`/reports/${id}/status`, input)
  },
  /**
   * Streams the report screenshot with the bearer token and returns it as a
   * data URL for <Image source={{ uri }}>. Returns null when the attachment is
   * missing or the submission lost.
   */
  async getReportScreenshotDataUrl(reportId: string): Promise<string | null> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/reports/${reportId}/screenshot`, {
        headers: await authHeaders(),
      })
      if (!res.ok) return null
      const contentType = res.headers.get('content-type') ?? 'image/jpeg'
      const buffer = new Uint8Array(await res.arrayBuffer())
      return `data:${contentType};base64,${bytesToBase64(buffer)}`
    } catch {
      return null
    }
  },

  // ── Bulk import ──
  importStudents(data: StudentImportRequest): Promise<StudentImportResult> {
    return post('/users/students/import', data, data.idempotencyKey)
  },
  getStudentImportJob(jobId: string): Promise<ImportJobStatus> {
    return get(`/users/students/import/jobs/${encodeURIComponent(jobId)}`)
  },
  previewEnrollImport(sectionId: string, rows: EnrollImportRow[]): Promise<EnrollImportResult> {
    return post(`/sections/${sectionId}/enrollments/import`, { mode: 'validate', rows })
  },
  importSectionEnrollments(sectionId: string, data: EnrollImportRequest): Promise<EnrollImportResult> {
    return post(`/sections/${sectionId}/enrollments/import`, data, data.idempotencyKey)
  },

  getSettings(): Promise<{ key: string; value: string; updatedAt: string }[]> {
    return get('/settings')
  },
  getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    return get(queryPath('/audit-logs', { ...filters }))
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
  async getStudentRoles(studentId: string): Promise<SectionRole[]> {
    try {
      return await get<SectionRole[]>(`/section-roles/student/${studentId}`)
    } catch (error) {
      // Roles are auxiliary on class detail screens; offline shows no badges
      // instead of failing the whole cached page.
      if (!isNetworkError(error)) throw error
      return []
    }
  },

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
    const { sectionId, ...body } = data
    return post(`/sections/${sectionId}/enroll-student`, body)
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
    await drainOfflineQueue(async (kind: OfflineOperationKind, payload, operationId) => {
      try {
        if (kind === 'attendance_scan') {
          const response = await post<{
            queued: false
            results: Array<AttendanceRecord | { error: string; retryable?: boolean }>
          } | { queued: true; receiptId: string }>('/sync/attendance/batches', {
            records: [payload],
          })
          const completion = response.queued
            ? await get<{ state: 'completed'; results: Array<AttendanceRecord | { error: string; retryable?: boolean }> } | { state: 'pending' | 'failed' }>(`/sync/attendance/batches/${response.receiptId}`)
            : { state: 'completed' as const, results: response.results }
          if (completion.state !== 'completed') return { outcome: 'pending', error: 'Awaiting server confirmation' }
          const result = completion.results[0]
          if (!result) return { outcome: 'retryable', error: 'Attendance sync returned no result' }
          if ('error' in result) {
            const classified = result.retryable === false
              ? { outcome: 'terminal' as const, error: result.error }
              : classifyAttendanceSyncError(result.error)
            // Terminal evidence will never sync; remove the phantom optimistic
            // row so history does not claim it is still awaiting confirmation.
            if (classified.outcome === 'terminal') {
              await removeCachedAttendanceAttempt(String(payload.sessionId), user.id)
            }
            return classified
          }
          await removeCachedAttendanceAttempt(String(payload.sessionId), user.id)
          await cacheAttendanceRecords([{ ...result, isSynced: true }])
          return { outcome: 'synced' }
        }
        if (kind === 'scan_attempt') {
          const result = await post<SubmitAttendanceResult>('/attendance/check', payload, operationId)
          if (!result.success) return { outcome: 'terminal', error: result.message || result.reason || 'Check-in rejected' }
          return
        }
        const sessionId = String(payload.sessionId)
        if (kind === 'session_activation') {
          const sessionId = String(payload.sessionId)
          const activated = await post<Session>(`/sessions/${sessionId}/activate`, { validityMinutes: payload.validityMinutes, gracePeriodMinutes: payload.gracePeriodMinutes, token: payload.token }, operationId)
          // Apply the authoritative response: the server may have ended the
          // session already if the QR window fully expired before sync.
          await cacheSessions([activated])
          return
        }
        if (kind !== 'session_end') return { outcome: 'terminal', error: 'Unknown offline operation. Contact support.' }
        await post(`/sessions/${sessionId}/end`, undefined, operationId)
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 409 && (kind === 'session_activation' || kind === 'session_end')) {
          // Read directly from the server: cached local state cannot prove a commit.
          try {
            const session = await get<Session>(`/sessions/${String(payload.sessionId)}`)
            const committed = kind === 'session_activation'
              ? Boolean(payload.token && session.qrToken === payload.token)
              : Boolean(session.endedAt)
            if (committed) {
              await cacheSessions([session])
              return { outcome: 'synced' }
            }
            if (session.qrToken || session.endedAt) return { outcome: 'terminal', error: 'Session changed on the server. Review it with your instructor.' }
            return { outcome: 'retryable', error: 'Session operation is still in progress' }
          } catch (reconciliationError) {
            error = reconciliationError
          }
        }
        const message = error instanceof Error ? error.message : 'Sync failed'
        if (error instanceof ApiRequestError && [400, 403, 404, 410, 422].includes(error.status)) {
          return { outcome: 'terminal', error: message }
        }
        return { outcome: 'retryable', error: message }
      }
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

  // ── AI assistant (AI0/AI2/AI3) ──
  getAiCapabilities(): Promise<AiCapabilities> {
    return get('/ai/capabilities')
  },
  sendAiChatMessage(data: AiChatSendInput): Promise<AiChatSendResult> {
    return post('/ai/chat', data)
  },
  getAiThread(threadId: string): Promise<AiChatThread> {
    return get(`/ai/threads/${encodeURIComponent(threadId)}`)
  },
  listAiThreads(): Promise<AiThreadSummary[]> {
    return get('/ai/threads')
  },
  deleteAiThread(threadId: string): Promise<boolean> {
    return del(`/ai/threads/${encodeURIComponent(threadId)}`)
  },
  /**
   * Authenticated assistant file handoff (AI1/AI6). Downloads into a unique
   * cache subfolder and opens the native share sheet. Throws a user-facing
   * message so screens can toast it without inspecting native errors.
   */
  async downloadAssistantFile(downloadPath: string, filename: string): Promise<void> {
    const token = await getTokenFromStore()
    if (!token) throw new Error('Sign in again to download assistant files.')

    let FileSystemModule: typeof import('expo-file-system/legacy') | null = null
    let SharingModule: typeof import('expo-sharing') | null = null
    try {
      FileSystemModule = require('expo-file-system/legacy')
      SharingModule = require('expo-sharing')
    } catch {
      // Modules are always present in a native build; treat a load failure as
      // unavailable rather than crashing the chat surface.
    }

    if (!FileSystemModule?.cacheDirectory) {
      throw new Error('Temporary file storage is unavailable on this device.')
    }
    if (!SharingModule || !(await SharingModule.isAvailableAsync())) {
      throw new Error('The system share sheet is unavailable on this device.')
    }

    const safeName = safeDownloadFileName(filename)
    const extension = assistantFileExtension(safeName)
    const folder = `${FileSystemModule.cacheDirectory}assistant-downloads/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}/`
    const localUri = `${folder}${safeName}`

    await FileSystemModule.makeDirectoryAsync(folder, { intermediates: true })
    const normalizedPath = downloadPath.startsWith('/') ? downloadPath : `/${downloadPath}`

    let result: { uri: string; status: number }
    try {
      result = await FileSystemModule.downloadAsync(`${API_BASE}${normalizedPath}`, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      await FileSystemModule.deleteAsync(folder, { idempotent: true }).catch(() => undefined)
      throw error instanceof Error ? error : new Error('The file could not be downloaded. Please try again.')
    }

    if (result.status < 200 || result.status >= 300) {
      await FileSystemModule.deleteAsync(folder, { idempotent: true }).catch(() => undefined)
      if (result.status === 401 || result.status === 403) {
        throw new Error('Your session cannot access this file. Sign in again and retry.')
      }
      throw new Error('The file could not be downloaded. Please try again.')
    }

    // The cache copy is intentionally kept: the receiving app may still read
    // it while the share sheet finishes, and the OS owns cache eviction.
    await SharingModule.shareAsync(result.uri, {
      mimeType: ASSISTANT_MIME_TYPES[extension] ?? 'application/octet-stream',
      UTI: ASSISTANT_UTIS[extension],
      dialogTitle: filename,
    })
  },

  // ── Standing evaluation (AI4) ──
  getMyStanding(): Promise<AttendanceStanding[]> {
    return get('/me/standing')
  },
}

api satisfies ApiClient

