import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))
vi.mock('./signing-key', () => ({
  getOrCreateTeacherSigningKey: vi.fn(),
  isSigningKeyProvisioned: vi.fn(),
  markSigningKeyProvisioned: vi.fn(),
}))

const student = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
}

const teacher = {
  id: 'teacher-1',
  email: 'teacher@pup.edu',
  fullName: 'Prof. Test',
  role: 'teacher',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(text: string, status = 200) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } })
}

describe('real API client', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('logs in with an HttpOnly-cookie request and persists only the public profile', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ accessToken: 'must-not-be-persisted', user: student }))
    const { api } = await import('./api-client')

    await expect(api.loginStudent(student.studentId, 'strong-password')).resolves.toEqual(student)

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/auth/login/student',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(localStorage.getItem('polycheck-user')).toBe(JSON.stringify(student))
    expect(JSON.stringify(localStorage)).not.toContain('must-not-be-persisted')
  })

  it('clears stale profile state when the API rejects a cookie session', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Session expired' }, 401))
    const { api } = await import('./api-client')

    await expect(api.getSubjects()).rejects.toThrow('Session expired')
    expect(api.getCurrentUser()).toBeNull()
    expect(localStorage.getItem('polycheck-user')).toBeNull()
  })

  it('logs in faculty and persists profile', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ accessToken: 'x', user: teacher }))
    const { api } = await import('./api-client')

    const result = await api.loginFaculty(teacher.email, 'password')
    expect(result).toEqual(teacher)
    expect(localStorage.getItem('polycheck-user')).toBe(JSON.stringify(teacher))
  })

  it('logout clears local state and calls server', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}))
    const { api } = await import('./api-client')

    await api.logout()
    expect(api.getCurrentUser()).toBeNull()
    expect(localStorage.getItem('polycheck-user')).toBeNull()
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('logout still succeeds when server is unreachable', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { api } = await import('./api-client')

    // Should not throw — local logout succeeds
    await api.logout()
    expect(api.getCurrentUser()).toBeNull()
  })

  it('restoreSession fetches /auth/me and persists user', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(student))
    const { api } = await import('./api-client')

    const result = await api.restoreSession()
    expect(result).toEqual(student)
    expect(api.getCurrentUser()).toEqual(student)
  })

  it('restoreSession returns null on 401', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401))
    const { api } = await import('./api-client')

    const result = await api.restoreSession()
    expect(result).toBeNull()
    expect(api.getCurrentUser()).toBeNull()
  })

  it('restoreSession clears a cached profile on an authoritative 403 rejection', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403))
    const { api } = await import('./api-client')

    await expect(api.restoreSession()).resolves.toBeNull()
    expect(api.getCurrentUser()).toBeNull()
    expect(localStorage.getItem('polycheck-user')).toBeNull()
  })

  it('restoreSession preserves the cached profile when the network is unavailable', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    const { api } = await import('./api-client')

    await expect(api.restoreSession()).rejects.toThrow('Failed to fetch')
    expect(api.getCurrentUser()).toEqual(student)
    expect(localStorage.getItem('polycheck-user')).toBe(JSON.stringify(student))
  })

  it('restoreSession preserves the cached profile when session verification times out', async () => {
    vi.useFakeTimers()
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockImplementation(
      (_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    )
    const { api } = await import('./api-client')

    try {
      const request = expect(api.restoreSession()).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(15_000)
      await request
      expect(api.getCurrentUser()).toEqual(student)
      expect(localStorage.getItem('polycheck-user')).toBe(JSON.stringify(student))
    } finally {
      vi.useRealTimers()
    }
  })

  it('restoreSession preserves the cached profile on a typed server error', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Service unavailable' }, 503))
    const { api, ApiHttpError } = await import('./api-client')

    const error = await api.restoreSession().catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiHttpError)
    expect(error).toEqual(expect.objectContaining({ name: 'ApiHttpError', message: 'Service unavailable', status: 503 }))
    expect(api.getCurrentUser()).toEqual(student)
  })

  it('getSubjects fetches the correct path', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    const { api } = await import('./api-client')

    await api.getSubjects()
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/subjects',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('aborts browser API requests that exceed the production timeout', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const { api } = await import('./api-client')

    try {
      const request = expect(api.getAttendanceSummaries()).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(15_000)
      await request
    } finally {
      vi.useRealTimers()
    }
  })

  it('getSections passes subjectId query parameter', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    const { api } = await import('./api-client')

    await api.getSections('sec-1')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/sections?subjectId=sec-1',
      expect.anything(),
    )
  })

  it('submitScan posts scan data with evidence', async () => {
    const record = { id: 'att-1', status: 'present' }
    vi.mocked(fetch).mockResolvedValue(jsonResponse(record))
    const { api } = await import('./api-client')

    const result = await api.submitScan(
      'sess-1', 'stu-1', 'Student', 14.58, 120.98, 'device-1', 'token123', '2026-01-01T00:00:00Z',
      { clientAttemptId: 'a-1', accuracyMeters: 10, locationCapturedAt: '2026-01-01T00:00:00Z', inputChannel: 'camera' },
    )
    expect(result).toEqual(record)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/attendance/scan',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('token123'),
      }),
    )
  })

  it('exportAttendanceCsv fetches CSV text', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse('sessionId,status\natt-1,present'))
    const { api } = await import('./api-client')

    const csv = await api.exportAttendanceCsv()
    expect(csv).toBe('sessionId,status\natt-1,present')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reports/export'),
      expect.anything(),
    )
  })

  it('exportAttendanceCsv throws on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403))
    const { api } = await import('./api-client')

    await expect(api.exportAttendanceCsv()).rejects.toThrow('Forbidden')
  })

  it('generateQrCode rejects invalid validity range', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}))
    const { api } = await import('./api-client')

    await expect(api.generateQrCode('sess-1', 0)).rejects.toThrow('QR validity must be 1-15 minutes')
    await expect(api.generateQrCode('sess-1', 20)).rejects.toThrow('QR validity must be 1-15 minutes')
  })

  it('generateQrCode provisions the signing key only once per account', async () => {
    const { api } = await import('./api-client')
    const { getOrCreateTeacherSigningKey, isSigningKeyProvisioned, markSigningKeyProvisioned } = await import('./signing-key')
    const { createSigningKeyPair } = await import('@polycheck/shared')
    const pair = createSigningKeyPair(crypto.getRandomValues(new Uint8Array(32)))
    vi.mocked(getOrCreateTeacherSigningKey).mockResolvedValue(pair)

    // /auth/me resolves to the mocked teacher user first
    vi.mocked(fetch).mockResolvedValue(jsonResponse(teacher))
    await api.restoreSession()
    expect(api.getCurrentUser()?.role).toBe('teacher')
    // Fresh Response per request (session GET, provision, activate)
    vi.mocked(fetch).mockImplementation(async () => jsonResponse({ id: 'sess-1' }))

    // First generation: not provisioned yet → uploads the key once
    vi.mocked(isSigningKeyProvisioned).mockResolvedValueOnce(false)
    await api.generateQrCode('sess-1', 5, 10)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/auth/provision-key',
      expect.objectContaining({ body: expect.stringContaining(pair.publicKey) }),
    )
    expect(markSigningKeyProvisioned).toHaveBeenCalledWith('teacher-1')

    // Second generation: already provisioned → no re-upload
    vi.mocked(fetch).mockClear()
    vi.mocked(isSigningKeyProvisioned).mockResolvedValueOnce(true)
    await api.generateQrCode('sess-1', 5, 10)
    const provisionCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes('/auth/provision-key'))
    expect(provisionCalls).toHaveLength(0)
  })

  it('does not rotate the registered key when the server rejects an invalid signature', async () => {
    const { api } = await import('./api-client')
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(teacher))
    await api.restoreSession()
    const { getOrCreateTeacherSigningKey, isSigningKeyProvisioned, markSigningKeyProvisioned } = await import('./signing-key')
    const { createSigningKeyPair } = await import('@polycheck/shared')
    const pair = createSigningKeyPair(crypto.getRandomValues(new Uint8Array(32)))
    vi.mocked(getOrCreateTeacherSigningKey).mockResolvedValue(pair)
    vi.mocked(isSigningKeyProvisioned).mockResolvedValue(true)
    vi.mocked(fetch).mockClear()

    let activateAttempts = 0
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/sessions/sess-1') && !u.includes('activate')) {
        return jsonResponse({
          id: 'sess-1',
          sectionId: 'sec-1',
          teacherId: 'teacher-1',
          teacherPublicKey: pair.publicKey,
        })
      }
      if (u.includes('/sessions/sess-1/activate')) {
        activateAttempts += 1
        if (activateAttempts === 1) {
          return new Response(JSON.stringify({ message: 'QR token signature is invalid' }), { status: 400 })
        }
        return jsonResponse({ id: 'sess-1', isActive: true })
      }
      if (u.includes('/auth/provision-key')) {
        return jsonResponse({ success: true })
      }
      return jsonResponse({})
    })

    await expect(api.generateQrCode('sess-1', 5, 10)).rejects.toThrow('No key was rotated')
    expect(activateAttempts).toBe(1)
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/auth/provision-key')),
    ).toHaveLength(0)
    expect(markSigningKeyProvisioned).toHaveBeenCalledWith('teacher-1')
  })

  it('search queries the search endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ students: [], sections: [], sessions: [] }))
    const { api } = await import('./api-client')

    const result = await api.search('query')
    expect(result).toEqual({ students: [], sections: [], sessions: [] })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=query'),
      expect.anything(),
    )
  })

  it('handleResponse throws parsed error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: ['Error A', 'Error B'] }, 422))
    const { api } = await import('./api-client')

    await expect(api.getAttendanceSummaries()).rejects.toThrow('Error A. Error B')
  })

  it('handleResponse falls back to status text on unparseable error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not JSON', { status: 502, statusText: 'Bad Gateway' }))
    const { api } = await import('./api-client')

    await expect(api.getAttendanceSummaries()).rejects.toThrow('Bad Gateway')
  })

  it('handleResponse returns undefined for 204 No Content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    const { api } = await import('./api-client')

    // deleteProofOfClass should succeed without throwing
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
    const result = await api.removeStudentFromSection('sec-1', 'stu-1')
    expect(result).toBeUndefined()
  })

  it('getSessions passes sectionId query parameter', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    const { api } = await import('./api-client')

    await api.getSectionSessions('sec-1')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/sessions?sectionId=sec-1',
      expect.anything(),
    )
  })

  it('getAttendanceRecords defaults to recent date range', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    const { api } = await import('./api-client')

    await api.getAttendanceRecords()
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string
    expect(url).toContain('startDate=')
    expect(url).toContain('endDate=')
    expect(url).toContain('limit=1000')
  })

  it('enrollStudent posts enrollment data', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(true))
    const { api } = await import('./api-client')

    const result = await api.enrollStudent({ sectionId: 'sec-1', studentId: 'stu-1', studentName: 'Test' })
    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sections/sec-1/enroll-student'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ studentId: 'stu-1', studentName: 'Test' }),
      }),
    )
  })

  it('search URL-encodes query parameter', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ students: [], sections: [], sessions: [] }))
    const { api } = await import('./api-client')

    await api.search('hello world & special=chars')
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string
    expect(url).toContain(encodeURIComponent('hello world & special=chars'))
  })

  it('fetches the super-admin overview and server status endpoints', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ scope: 'institution', counts: {} }))
    const { api } = await import('./api-client')

    await api.getAdminOverview()
    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/dashboard/admin-overview',
      expect.anything(),
    )

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ timestamp: '2026-10-26T02:30:00.000Z' }))
    await api.getServerStatus()
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.polycheck.test/api/dashboard/server-status',
      expect.anything(),
    )
  })

  it('getUsers forwards server-side filters and caps the page size', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: [], total: 0, limit: 100, offset: 20, hasMore: false }))
    const { api } = await import('./api-client')

    await api.getUsers({ role: 'student', q: 'Reyes', department: 'CCIS', status: 'inactive', limit: 500, offset: 20 })
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string
    expect(url).toContain('/users?')
    expect(url).toContain('role=student')
    expect(url).toContain('q=Reyes')
    expect(url).toContain('department=CCIS')
    expect(url).toContain('status=inactive')
    expect(url).toContain('limit=100')
    expect(url).toContain('offset=20')
  })

  it('edits profiles, changes roles, and provisions admins through the admin endpoints', async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(teacher))
    const { api } = await import('./api-client')

    await api.updateUser('teacher-1', { fullName: 'Updated Teacher' })
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.polycheck.test/api/users/teacher-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ fullName: 'Updated Teacher' }) }),
    )

    await api.changeUserRole('teacher-1', 'student')
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.polycheck.test/api/users/teacher-1/role',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'student' }) }),
    )

    await api.createAdmin({ userId: 'teacher-1' })
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.polycheck.test/api/users/admins',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'teacher-1' }) }),
    )
  })

  it('publishes the maintenance event and surfaces estimatedEnd on 503s', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          code: 'system_maintenance',
          message: 'Campus maintenance',
          estimatedEnd: '2026-11-01T10:00:00.000Z',
        },
        503,
      ),
    )
    const events: Array<CustomEvent<{ message?: string; estimatedEnd?: string }>> = []
    const listener = (event: Event) => events.push(event as CustomEvent)
    window.addEventListener('polycheck-maintenance', listener)
    try {
      const { api, ApiHttpError } = await import('./api-client')
      const error = (await api.getSettings().then(
        () => null,
        (caught: unknown) => caught,
      )) as InstanceType<typeof ApiHttpError>
      expect(error).toBeInstanceOf(ApiHttpError)
      expect(error.status).toBe(503)
      expect(error.code).toBe('system_maintenance')
      expect(error.estimatedEnd).toBe('2026-11-01T10:00:00.000Z')
      expect(events).toHaveLength(1)
      expect(events[0].detail).toEqual({
        message: 'Campus maintenance',
        estimatedEnd: '2026-11-01T10:00:00.000Z',
      })
    } finally {
      window.removeEventListener('polycheck-maintenance', listener)
    }
  })

  it('reads the public maintenance status and degrades to open when unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ enabled: true, message: 'Back soon', estimatedEnd: '2026-11-01T10:00:00.000Z' }),
    )
    const { api } = await import('./api-client')
    await expect(api.getMaintenanceStatus()).resolves.toEqual({
      enabled: true,
      message: 'Back soon',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://api.polycheck.test/api/maintenance/status')

    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse({ enabled: false }))
    await expect(api.getMaintenanceStatus()).resolves.toEqual({ enabled: false })
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe('https://api.polycheck.test/api/maintenance/status')
  })

  it('rejects every request with the simulated outage TypeError while armed, and restores after disarming', async () => {
    const { armOutage, disarmOutage, isOutageArmed, SIMULATED_NETWORK_OUTAGE_MESSAGE } =
      await import('@polycheck/shared')
    const { initializeOfflineStore } = await import('./offline/store')
    const { api } = await import('./api-client')

    // The demo surface is an authenticated teacher/student: bind the
    // encrypted queue owner so optimistic writes can actually enqueue.
    await initializeOfflineStore(student.id)

    try {
      expect(isOutageArmed()).toBe(false)
      armOutage()

      // Every call must die in the guard — not a single transport request may
      // escape while the killswitch is on. `getSubjects` still RESOLVES with
      // the empty encrypted cache (offline-first reads), so the TypeError is
      // asserted directly on a catch-free surface plus transport-zero.
      await expect(api.getUnreadNotificationCount()).rejects.toBeInstanceOf(TypeError)
      await expect(api.getUnreadNotificationCount()).rejects.toThrow(SIMULATED_NETWORK_OUTAGE_MESSAGE)
      await expect(api.getSubjects()).resolves.toEqual([])
      expect(fetch).not.toHaveBeenCalled()

      // Writes flow straight into the existing offline queue paths: the
      // status update resolves with the optimistic record and never touches
      // the network.
      const optimistic = await api.updateAttendanceStatus('rec-1', 'present')
      expect(optimistic.status).toBe('present')
      expect(optimistic.isSynced).toBe(false)
      expect(optimistic.manuallySet).toBe(true)
      expect(fetch).not.toHaveBeenCalled()

      disarmOutage()
      vi.mocked(fetch).mockResolvedValue(jsonResponse([{ id: 'subj-1' }]))
      await expect(api.getSubjects()).resolves.toEqual([{ id: 'subj-1' }])
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally {
      disarmOutage()
    }

    // The failure path is identical to a dropped connection: raw TypeError,
    // not an ApiHttpError, so offline fallbacks keep classifying it as
    // network loss rather than an authoritative server answer.
    armOutage()
    const failure = await api.getUnreadNotificationCount().then(
      (value) => value,
      (caught: unknown) => caught,
    )
    expect(failure).toBeInstanceOf(TypeError)
    expect((failure as Error).name).toBe('TypeError')
    disarmOutage()
  })
})
