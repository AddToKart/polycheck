import { classifyAttendanceSyncError, getRecentCampusDateRange, haversineDistance, isWithinGeofence, signQRToken, verifyQRToken, type User, type Subject, type Section, type Session, type AttendanceRecord, type AttendanceSummary, type AttendanceStatus, type Student, type Teacher, type Enrollment, type StudentDisputeReason, type SectionRole, type SectionRoleType, type SessionPermission, type ProofOfClass, type CalendarEvent, type CreateSubjectInput, type CreateSectionInput, type CreateSessionInput, type SubmitAttendanceResult, type EnrollStudentInput, type BulkSessionInput, type CreateTeacherInput, type CreateStudentInput, type ResetUserPasswordResult, type ScanEvidenceInput, type AttendanceReport, type AttendanceReportFilters, type DashboardOverview, type ApiClient, type PrivacyNotice, type AuditLogFilters, type AuditLogPage, type StudentImportRequest, type StudentImportResult, type ImportJobStatus, type EnrollImportRequest, type EnrollImportResult, type EnrollImportRow, type AdminOverview, type AdminUserFilters, type AdminUserPage, type AssignableRole, type CreateAdminInput, type ServerStatusSnapshot, type UpdateUserInput, type AiCapabilities, type AiChatSendInput, type AiChatSendResult, type AiChatThread, type AiThreadSummary, type AttendanceStanding, type AppNotification, type NotificationReadInput, type PushTokenInput, type StudentAtRisk, type ExcuseDecision, type ExcuseReason, type CreateTeacherResult, type CreateStudentResult, type TeacherResetStudentPasswordResult, type EmergencyDeviceReleaseInput, type EmergencyDeviceReleaseResult, type UnregisterDeviceResult, type UpdateContactsInput } from '@polycheck/shared'
import { getOrCreateTeacherSigningKey, isSigningKeyProvisioned, markSigningKeyProvisioned } from './signing-key'
import { API_BASE } from './api-config'
import {
  cacheAttendanceRecords,
  cacheRoster,
  cacheSections,
  cacheSessions,
  cacheSubjects,
  drainOfflineQueue,
  enqueueOfflineOperation,
  getCachedAttendanceForSession,
  getCachedAttendanceRecords,
  getCachedRoster,
  getCachedSection,
  getCachedSections,
  getCachedSession,
  getCachedSessions,
  getCachedSubjects,
  getEnrolledSectionIds,
  getServerClockOffset,
  initializeOfflineStore,
  persistOfflineStorage,
  removeCachedAttendanceAttempt,
  removeCachedRecord,
  replaceCachedAttendanceForStudent,
  setEnrolledSectionIds,
  setOfflineOwner,
  setServerClockOffset,
  wipeOfflineStore,
} from './offline/store'
import type { OfflineOperationKind } from './offline/db'

const STORAGE_KEY = 'polycheck-user'
const REQUEST_TIMEOUT_MS = 15_000
const EXPORT_TIMEOUT_MS = 30_000

export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly remainingMinutes?: number,
  ) {
    super(message)
    this.name = 'ApiHttpError'
  }
}

export function isAuthRejection(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError && (error.status === 401 || error.status === 403)
}

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
  } catch { /* Storage may be blocked; in-memory auth state is still authoritative. */ }
  try {
    // Auth consumers must be notified even when privacy settings or a storage
    // quota error prevented persistence. In particular, a 401 must immediately
    // unmount protected content based on the in-memory currentUser value.
    window.dispatchEvent(new Event('polycheck-auth-changed'))
  } catch { /* A non-browser test shim may not implement dispatchEvent. */ }
}

let currentUser: User | null = loadUser()

function recentDateRange(days = 30) {
  return getRecentCampusDateRange(days)
}

function queryPath(path: string, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

async function authHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json' }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const externalSignal = init?.signal
  const forwardAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', forwardAbort, { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', forwardAbort)
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 401) {
      currentUser = null
      saveUser(null)
    }
    const message = Array.isArray(err.message) ? err.message.join('. ') : err.message
    const code = typeof err.code === 'string' ? err.code : undefined
    const remainingMinutes = typeof err.remainingMinutes === 'number' ? err.remainingMinutes : undefined
    throw new ApiHttpError(message || 'Request failed', res.status, code, remainingMinutes)
  }
  return res.json()
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: await authHeaders(),
    credentials: 'include',
    signal,
  })
  return handleResponse<T>(res)
}

async function post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await authHeaders()),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function patch<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...(await authHeaders()),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function del<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: await authHeaders(),
  })
  return handleResponse<T>(res)
}

export function isNetworkFailure(error: unknown): boolean {
  // Typed API errors are authoritative server answers; anything else (abort,
  // DNS, CORS, offline) is a connectivity failure that may fall back to cache.
  if (error instanceof ApiHttpError) return error.status >= 500
  return true
}

async function trustedNow(): Promise<number> {
  const offset = await getServerClockOffset()
  return Date.now() + (offset ?? 0)
}

const RECEIPT_POLL_ATTEMPTS = 4
const RECEIPT_POLL_DELAY_MS = 600

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Authenticated assistant file download (AI1). Uses the same cookie session and
 * timeout as the CSV export path and surfaces the server's message on failure.
 */
export async function downloadAssistantFile(downloadPath: string): Promise<Blob> {
  const res = await fetchWithTimeout(
    `${API_BASE}${downloadPath}`,
    { headers: await authHeaders(), credentials: 'include' },
    EXPORT_TIMEOUT_MS,
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(Array.isArray(error.message) ? error.message.join('. ') : error.message || 'Download failed')
  }
  return res.blob()
}

const apiBase = {
  getPrivacyNotice(): Promise<PrivacyNotice> {
    return get('/auth/privacy-notice')
  },

  async acceptPrivacyConsent(version: string): Promise<User> {
    const user = await post<User>('/auth/privacy-consent', { version })
    currentUser = user
    saveUser(user)
    return user
  },

  async loginStudent(studentId: string, password?: string): Promise<User | null> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login/student`, {
      method: 'POST',
      credentials: 'include',
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
    void initializeOfflineStore(currentUser.id).catch(() => undefined)
    return currentUser
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login/faculty`, {
      method: 'POST',
      credentials: 'include',
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
    void initializeOfflineStore(currentUser.id).catch(() => undefined)
    return currentUser
  },

  async logout() {
    currentUser = null
    saveUser(null)
    void wipeOfflineStore().catch(() => undefined)
    try {
      await fetchWithTimeout(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch { /* Local logout still succeeds when the server is unavailable. */ }
  },

  getCurrentUser(): User | null {
    if (!currentUser) currentUser = loadUser()
    return currentUser
  },

  hasCurrentUser(): boolean {
    return currentUser !== null
  },

  async getTrustedTimestamp(): Promise<string> {
    return new Date(await trustedNow()).toISOString()
  },

  async refreshServerClockOffset(): Promise<void> {
    try {
      const startedAt = Date.now()
      const health = await get<{ timestamp: string }>('/health')
      const completedAt = Date.now()
      const serverTime = new Date(health.timestamp).getTime()
      if (Number.isFinite(serverTime)) {
        await setServerClockOffset(serverTime - (startedAt + completedAt) / 2)
      }
    } catch {
      // Offline: the last cached offset remains valid for seven days.
    }
  },

  async restoreSession(): Promise<User | null> {
    const cached = loadUser()
    if (typeof navigator !== 'undefined' && navigator.onLine === false && cached) {
      currentUser = cached
      void initializeOfflineStore(cached.id).catch(() => undefined)
      return cached
    }
    try {
      currentUser = await get<User>('/auth/me')
      saveUser(currentUser)
      void initializeOfflineStore(currentUser.id).catch(() => undefined)
      return currentUser
    } catch (error) {
      if (isAuthRejection(error)) {
        currentUser = null
        saveUser(null)
        setOfflineOwner(null)
        return null
      }
      throw error
    }
  },

  async changePassword(currentPassword: string | undefined, newPassword: string): Promise<User> {
    const updated = await post<User>('/auth/change-password', {
      ...(currentPassword ? { currentPassword } : {}),
      newPassword,
    })
    currentUser = updated
    saveUser(updated)
    return updated
  },

  // ── Subjects ──
  async getSubjects(): Promise<Subject[]> {
    try {
      const subjects = await get<Subject[]>('/subjects')
      await cacheSubjects(subjects).catch(() => undefined)
      return subjects
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      return getCachedSubjects()
    }
  },
  getSubject(id: string): Promise<Subject> { return get(`/subjects/${id}`) },
  createSubject(data: CreateSubjectInput): Promise<Subject> { return post('/subjects', data) },

  // ── Sections ──
  async getSections(subjectId?: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(`/sections${subjectId ? `?subjectId=${subjectId}` : ''}`)
      await cacheSections(sections).catch(() => undefined)
      return sections
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedSections()
      return subjectId ? cached.filter((section) => section.subjectId === subjectId) : cached
    }
  },
  async getSection(id: string): Promise<Section> {
    try {
      const section = await get<Section>(`/sections/${id}`)
      await cacheSections([section]).catch(() => undefined)
      return section
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedSection(id)
      if (!cached) throw new Error('Section is not available offline. Sync before class.')
      return cached
    }
  },
  createSection(data: CreateSectionInput): Promise<Section> { return post('/sections', data) },
  async getSectionStudents(sectionId: string): Promise<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]> {
    try {
      const students = await get<(Student & { attendance: { present: number; late: number; absent: number; disputed: number } })[]>(`/sections/${sectionId}/students`)
      await cacheRoster(sectionId, students).catch(() => undefined)
      return students
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedRoster(sectionId)
      return cached.map((student) => ({
        ...student,
        attendance: { present: 0, late: 0, absent: 0, disputed: 0 },
      }))
    }
  },
  async getStudentsForSection(sectionId: string): Promise<Student[]> {
    try {
      const students = await get<Student[]>(`/sections/${sectionId}/students`)
      await cacheRoster(sectionId, students).catch(() => undefined)
      return students
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      return getCachedRoster(sectionId)
    }
  },
  async getStudentSections(studentId: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(`/sections?studentId=${studentId}`)
      await cacheSections(sections).catch(() => undefined)
      await setEnrolledSectionIds(sections.map((section) => section.id)).catch(() => undefined)
      return sections
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const sectionIds = await getEnrolledSectionIds()
      const cached = await getCachedSections()
      return cached.filter((section) => sectionIds.includes(section.id))
    }
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
      await cacheSessions(sessions).catch(() => undefined)
      return sessions
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      return getCachedSessions(sectionId)
    }
  },
  async getSession(id: string): Promise<Session> {
    try {
      const session = await get<Session>(`/sessions/${id}`)
      await cacheSessions([session]).catch(() => undefined)
      return session
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedSession(id)
      if (!cached) throw new Error('Session is not available offline. Sync before class.')
      return cached
    }
  },
  createSession(data: CreateSessionInput): Promise<Session> {
    const { teacherId, ...body } = data
    void teacherId
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
    const effectiveGrace = gracePeriodMinutes ?? Math.min(session.gracePeriodMinutes, 60)
    if (effectiveGrace < 0 || effectiveGrace > 60) throw new Error('QR grace must be 0-60 minutes')
    const issuedAt = await trustedNow()
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
      // The public key persists server-side and provisioning is rate limited, so
      // upload it only once per browser/account. A key that already matches the
      // cached session is known to the server, enabling fully offline QR use.
      if (!(await isSigningKeyProvisioned(user.id))) {
        if (session.teacherPublicKey === key.publicKey) {
          await markSigningKeyProvisioned(user.id)
        } else {
          try {
            await post('/auth/provision-key', { publicKey: key.publicKey })
            await markSigningKeyProvisioned(user.id)
          } catch (error) {
            if (!isNetworkFailure(error)) throw error
            throw new Error(
              'Connect to the internet once to register this device before generating offline QR codes.',
            )
          }
        }
      }
      const activated = await post<Session>(`/sessions/${sessionId}/activate`, {
        validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        token,
      })
      await cacheSessions([activated]).catch(() => undefined)
      return activated
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
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
      await enqueueOfflineOperation('session_activation', {
        sessionId,
        validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        token,
      })
      await cacheSessions([activated]).catch(() => undefined)
      return activated
    }
  },
  async endSession(sessionId: string): Promise<Session> {
    try {
      const ended = await post<Session>(`/sessions/${sessionId}/end`)
      await cacheSessions([ended]).catch(() => undefined)
      return ended
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const session = await getCachedSession(sessionId)
      if (!session) throw new Error('Session is not available offline')
      const ended = {
        ...session,
        isActive: false,
        endedAt: new Date(await trustedNow()).toISOString(),
      }
      await enqueueOfflineOperation('session_end', { sessionId })
      await cacheSessions([ended]).catch(() => undefined)
      return ended
    }
  },
  getSectionSessions(sectionId: string): Promise<Session[]> {
    return this.getSessions(sectionId)
  },

  // ── Attendance ──
  async getAttendanceRecords(sessionId?: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
    const scope = sessionId
      ? { sessionId, limit: 1000 }
      : startDate && endDate
        ? { startDate, endDate, limit: 1000 }
        : { ...recentDateRange(31), limit: 1000 }
    try {
      const records = await get<AttendanceRecord[]>(queryPath('/attendance', scope))
      await cacheAttendanceRecords(records).catch(() => undefined)
      return records
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      if (sessionId) return getCachedAttendanceForSession(sessionId)
      const cached = await getCachedAttendanceRecords()
      return cached.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    }
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
  async getAttendanceForStudent(studentId: string): Promise<AttendanceRecord[]> {
    try {
      const records = await get<AttendanceRecord[]>(`/attendance/student/${studentId}`)
      await replaceCachedAttendanceForStudent(studentId, records).catch(() => undefined)
      return records
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      return getCachedAttendanceRecords(studentId)
    }
  },
  async getStudentAttendanceForSection(studentId: string, sectionId: string): Promise<AttendanceRecord[]> {
    try {
      const records = await get<AttendanceRecord[]>(`/attendance/student/${studentId}?sectionId=${sectionId}`)
      await replaceCachedAttendanceForStudent(studentId, records).catch(() => undefined)
      return records
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedAttendanceRecords(studentId)
      return cached.filter((record) => record.sectionId === sectionId)
    }
  },
  async addAttendanceRecord(record: AttendanceRecord): Promise<AttendanceRecord> {
    const payload = {
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      status: record.status,
    }
    try {
      const created = await post<AttendanceRecord>('/attendance', payload)
      await cacheAttendanceRecords([created]).catch(() => undefined)
      return created
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const optimistic: AttendanceRecord = {
        ...record,
        id: crypto.randomUUID(),
        isSynced: false,
        manuallySet: true,
      }
      await enqueueOfflineOperation('attendance_manual', { record: optimistic })
      await cacheAttendanceRecords([optimistic]).catch(() => undefined)
      return optimistic
    }
  },
  async updateAttendanceStatus(recordId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    try {
      const updated = await patch<AttendanceRecord>(`/attendance/${recordId}/status`, { status })
      await cacheAttendanceRecords([updated]).catch(() => undefined)
      return updated
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const cached = await getCachedAttendanceRecords()
      const existing = cached.find((record) => record.id === recordId)
      const optimistic: AttendanceRecord = {
        ...(existing ?? {
          id: recordId,
          sessionId: '',
          sectionId: '',
          studentId: '',
          studentName: '',
          timestamp: new Date().toISOString(),
          status,
          coordinates: { latitude: 0, longitude: 0 },
          deviceId: 'offline-web',
        }),
        status,
        isSynced: false,
        manuallySet: true,
      }
      await enqueueOfflineOperation('attendance_status', {
        recordId,
        status,
        sessionId: optimistic.sessionId,
      })
      await cacheAttendanceRecords([optimistic]).catch(() => undefined)
      return optimistic
    }
  },
  async submitScan(sessionId: string, studentId: string, studentName: string, lat: number, lon: number, deviceId: string, qrToken: string, scannedAt?: string, evidence?: ScanEvidenceInput): Promise<AttendanceRecord | { error: string }> {
    const payload = { sessionId, lat, lon, deviceId, qrToken, scannedAt: scannedAt ?? new Date().toISOString(), ...evidence }
    try {
      const result = await post<AttendanceRecord | { error: string }>('/attendance/scan', payload)
      if (!('error' in result)) await cacheAttendanceRecords([result]).catch(() => undefined)
      return result
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      if (!qrToken) return { error: 'QR token is required' }
      const cachedSession = await getCachedSession(sessionId)
      const tokenPayload = verifyQRToken(qrToken, cachedSession?.teacherPublicKey ?? '')
      if (!tokenPayload) return { error: 'QR token signature is invalid' }
      const capturedAt = new Date(payload.scannedAt).getTime()
      const validityEnd = tokenPayload.issuedAt + tokenPayload.validityMinutes * 60_000
      const graceEnd = validityEnd + tokenPayload.gracePeriodMinutes * 60_000
      if (evidence?.mocked === true) return { error: 'Mocked locations are not accepted' }
      if (!cachedSession) {
        return { error: 'Session data is not available offline. Sync before class.' }
      }
      const distance = haversineDistance(
        lat,
        lon,
        cachedSession.geofence.latitude,
        cachedSession.geofence.longitude,
      )
      if (distance > cachedSession.geofence.radiusMeters) {
        return {
          error: `You are outside the session geofence (${Math.round(distance)} m away, allowed ${cachedSession.geofence.radiusMeters} m).`,
        }
      }
      if ((evidence?.accuracyMeters ?? 0) > 50) return { error: 'Location accuracy is too poor to verify attendance' }
      if (evidence?.locationCapturedAt && Math.abs(capturedAt - new Date(evidence.locationCapturedAt).getTime()) > 2 * 60_000) {
        return { error: 'Location fix is stale. Acquire a fresh location and try again.' }
      }
      if (!Number.isFinite(capturedAt) || capturedAt < tokenPayload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return { error: 'The QR attendance window has expired' }
      }
      const existing = await getCachedAttendanceForSession(sessionId)
      if (existing.some((record) => record.studentId === studentId)) {
        return { error: 'Attendance for this session was already saved on this device.' }
      }
      await enqueueOfflineOperation('attendance_scan', payload)
      const record: AttendanceRecord = {
        id: `offline:${sessionId}:${studentId}`,
        sessionId,
        sectionId: tokenPayload.sectionId,
        studentId,
        studentName,
        timestamp: payload.scannedAt,
        status: capturedAt <= validityEnd ? 'present' : 'late',
        coordinates: { latitude: lat, longitude: lon },
        deviceId,
        tokenSnapshot: qrToken,
        isSynced: false,
      }
      await cacheAttendanceRecords([record]).catch(() => undefined)
      return record
    }
  },
  async checkAttendance(sessionId: string, studentId: string, lat: number, lon: number, qrToken?: string, scannedAt?: string): Promise<SubmitAttendanceResult> {
    void studentId
    try {
      return await post('/attendance/check', { sessionId, lat, lon, qrToken, scannedAt })
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
      const session = await getCachedSession(sessionId)
      const clockOffset = await getServerClockOffset()
      if (!session || !qrToken || !session.teacherPublicKey || clockOffset === null) {
        return { success: false, status: 'absent', reason: 'not_synced', message: 'Session security time and class data are not available offline. Sync before class.' }
      }
      const tokenPayload = verifyQRToken(qrToken, session.teacherPublicKey)
      if (!tokenPayload || tokenPayload.sessionId !== session.id || tokenPayload.sectionId !== session.sectionId || tokenPayload.teacherId !== session.teacherId) {
        return { success: false, status: 'disputed', reason: 'invalid_signature', message: 'QR token signature is invalid' }
      }
      if (!isWithinGeofence(lat, lon, session.geofence.latitude, session.geofence.longitude, session.geofence.radiusMeters)) {
        return { success: false, status: 'absent', reason: 'outside_geofence', message: 'You are outside the session geofence' }
      }
      const capturedAt = new Date(scannedAt ?? Date.now()).getTime()
      if (session.endedAt && capturedAt > new Date(session.endedAt).getTime()) return { success: false, status: 'absent', reason: 'session_inactive', message: 'Session was not active at scan time' }
      const validityEnd = tokenPayload.issuedAt + tokenPayload.validityMinutes * 60_000
      const graceEnd = validityEnd + tokenPayload.gracePeriodMinutes * 60_000
      if (!Number.isFinite(capturedAt) || capturedAt < tokenPayload.issuedAt - 30_000 || capturedAt > graceEnd) {
        return { success: false, status: 'absent', reason: 'qr_expired', message: 'The QR attendance window has expired' }
      }
      await enqueueOfflineOperation('scan_attempt', { sessionId, lat, lon, qrToken, scannedAt })
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
  getUsers(filters: AdminUserFilters = {}, options: { signal?: AbortSignal } = {}): Promise<AdminUserPage> {
    return get(
      queryPath('/users', {
        role: filters.role,
        q: filters.q,
        department: filters.department,
        status: filters.status,
        limit: filters.limit === undefined ? undefined : Math.min(Math.max(1, Math.trunc(filters.limit)), 100),
        offset: filters.offset,
      }),
      options.signal,
    )
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
    saveUser(updated)
    return updated
  },
  importStudents(data: StudentImportRequest): Promise<StudentImportResult> {
    return post('/users/students/import', data, data.idempotencyKey)
  },
  getStudentImportJob(jobId: string): Promise<ImportJobStatus> {
    return get(`/users/students/import/jobs/${jobId}`)
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
  setSetting(key: string, value: string): Promise<{ key: string; value: string; updatedAt: string }> {
    return put(`/settings/${encodeURIComponent(key)}`, { value })
  },
  getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    return get(queryPath('/audit-logs', { ...filters }))
  },
  getMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return this.getAttendanceForStudent(studentId)
  },
  async getMySubjects(studentId: string): Promise<Subject[]> {
    void studentId
    return this.getSubjects()
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
    return post('/proofs', {
      sectionId: data.sectionId,
      sessionId: data.sessionId,
      photoData: data.photoData,
      description: data.description,
    })
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
    const { teacherId, ...body } = data
    void teacherId
    return post('/sessions/bulk', body)
  },
  async syncOfflineQueue(): Promise<void> {
    const user = this.getCurrentUser()
    if (!user) return
    await initializeOfflineStore(user.id)
    type ScanSyncResult = AttendanceRecord | { error: string; retryable?: boolean }
    type ScanSyncResponse =
      | { queued: false; results: ScanSyncResult[] }
      | { queued: true; receiptId: string }
    type ScanSyncStatus =
      | { state: 'completed'; results: ScanSyncResult[] }
      | { state: 'pending' | 'failed' }

    const awaitCompletion = async (response: ScanSyncResponse): Promise<ScanSyncResult | null> => {
      if (!response.queued) return response.results[0] ?? null
      for (let attempt = 0; attempt < RECEIPT_POLL_ATTEMPTS; attempt += 1) {
        const completion = await get<ScanSyncStatus>(`/sync/attendance/batches/${response.receiptId}`)
        if (completion.state === 'completed') return completion.results[0] ?? null
        if (completion.state === 'failed') {
          throw new ApiHttpError('Attendance sync job failed', 500)
        }
        await delay(RECEIPT_POLL_DELAY_MS * (attempt + 1))
      }
      return null
    }

    await drainOfflineQueue(async (kind: OfflineOperationKind, payload, operationId) => {
      try {
        if (kind === 'attendance_scan') {
          const response = await post<ScanSyncResponse>('/sync/attendance/batches', {
            records: [payload],
          })
          const result = await awaitCompletion(response)
          if (!result) return { outcome: 'pending', error: 'Awaiting server confirmation' }
          if ('error' in result) {
            return result.retryable === false
              ? { outcome: 'terminal', error: result.error }
              : classifyAttendanceSyncError(result.error)
          }
          await removeCachedAttendanceAttempt(String(payload.sessionId), user.id)
          await cacheAttendanceRecords([{ ...result, isSynced: true }])
          return { outcome: 'synced' }
        }
        if (kind === 'scan_attempt') {
          const result = await post<SubmitAttendanceResult>('/attendance/check', payload, operationId)
          if (!result.success) {
            return { outcome: 'terminal', error: result.message || result.reason || 'Check-in rejected' }
          }
          return
        }
        if (kind === 'session_activation') {
          const sessionId = String(payload.sessionId)
          const activated = await post<Session>(
            `/sessions/${sessionId}/activate`,
            {
              validityMinutes: payload.validityMinutes,
              gracePeriodMinutes: payload.gracePeriodMinutes,
              token: payload.token,
            },
            operationId,
          )
          await cacheSessions([activated]).catch(() => undefined)
          return
        }
        if (kind === 'session_end') {
          const ended = await post<Session>(`/sessions/${String(payload.sessionId)}/end`, undefined, operationId)
          await cacheSessions([ended]).catch(() => undefined)
          return
        }
        if (kind === 'attendance_manual') {
          const record = payload.record as AttendanceRecord
          const created = await post<AttendanceRecord>(
            '/attendance',
            {
              sessionId: record.sessionId,
              sectionId: record.sectionId,
              studentId: record.studentId,
              status: record.status,
            },
            operationId,
          )
          await removeCachedRecord(record.id)
          await cacheAttendanceRecords([{ ...created, isSynced: true }])
          return
        }
        if (kind === 'attendance_status') {
          const updated = await patch<AttendanceRecord>(
            `/attendance/${String(payload.recordId)}/status`,
            { status: payload.status },
            operationId,
          )
          await cacheAttendanceRecords([{ ...updated, isSynced: true }])
          return
        }
        return { outcome: 'terminal', error: 'Unknown offline operation. Contact support.' }
      } catch (error) {
        if (
          error instanceof ApiHttpError &&
          error.status === 409 &&
          (kind === 'session_activation' || kind === 'session_end')
        ) {
          // Read from the server: cached local state cannot prove a commit.
          try {
            const session = await get<Session>(`/sessions/${String(payload.sessionId)}`)
            const committed =
              kind === 'session_activation'
                ? Boolean(payload.token && session.qrToken === payload.token)
                : Boolean(session.endedAt)
            if (committed) {
              await cacheSessions([session]).catch(() => undefined)
              return { outcome: 'synced' }
            }
            if (session.qrToken || session.endedAt) {
              return {
                outcome: 'terminal',
                error: 'Session changed on the server. Review it with your instructor.',
              }
            }
            return { outcome: 'retryable', error: 'Session operation is still in progress' }
          } catch (reconciliationError) {
            error = reconciliationError
          }
        }
        const message = error instanceof Error ? error.message : 'Sync failed'
        if (error instanceof ApiHttpError && [400, 403, 404, 410, 422].includes(error.status)) {
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
      if (Number.isFinite(serverTime)) {
        await setServerClockOffset(serverTime - (startedAt + completedAt) / 2)
      }
      await this.syncOfflineQueue()
      await Promise.all([
        this.getSubjects(),
        user.role === 'student' ? this.getStudentSections(user.id) : this.getSections(),
        this.getSessions(),
        ...(user.role === 'student' ? [this.getMyAttendance(user.id)] : []),
      ])
      await persistOfflineStorage()
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
    }
  },
  async exportAttendanceCsv(filters: AttendanceReportFilters = {}): Promise<string> {
    const path = queryPath('/reports/export', { ...recentDateRange(), ...filters })
    const res = await fetchWithTimeout(
      `${API_BASE}${path}`,
      { headers: await authHeaders(), credentials: 'include' },
      EXPORT_TIMEOUT_MS,
    )
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(Array.isArray(error.message) ? error.message.join('. ') : error.message || 'Export failed')
    }
    return res.text()
  },
  search(query: string): Promise<{ students: Student[]; sections: Section[]; sessions: Session[] }> {
    return get(`/search?q=${encodeURIComponent(query)}`)
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

  // ── Standing evaluation (AI4) ──
  getMyStanding(): Promise<AttendanceStanding[]> {
    return get('/me/standing')
  },
}

export const api = { ...apiBase, downloadAssistantFile }

api satisfies ApiClient

