import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))
vi.mock('./signing-key', () => ({ getOrCreateTeacherSigningKey: vi.fn() }))

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
      const request = expect(api.getSubjects()).rejects.toMatchObject({ name: 'AbortError' })
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

    await expect(api.getSubjects()).rejects.toThrow('Error A. Error B')
  })

  it('handleResponse falls back to status text on unparseable error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not JSON', { status: 502, statusText: 'Bad Gateway' }))
    const { api } = await import('./api-client')

    await expect(api.getSubjects()).rejects.toThrow('Bad Gateway')
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
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('search URL-encodes query parameter', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ students: [], sections: [], sessions: [] }))
    const { api } = await import('./api-client')

    await api.search('hello world & special=chars')
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string
    expect(url).toContain(encodeURIComponent('hello world & special=chars'))
  })
})
