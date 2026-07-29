import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))
vi.mock('./signing-key', () => ({ getOrCreateTeacherSigningKey: vi.fn() }))

const student = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

  it('surfaces all server validation messages', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: ['Email is invalid', 'Password is required'] }, 400))
    const { api } = await import('./api-client')

    await expect(api.loginFaculty('invalid', '')).rejects.toThrow('Email is invalid. Password is required')
  })

  it('does not let the browser choose the authoritative teacher on session creation', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 'session-1' }))
    const { api } = await import('./api-client')

    await api.createSession({
      sectionId: 'section-1',
      subjectName: 'Algorithms',
      date: '2026-07-18',
      startTime: '08:00',
      endTime: '09:00',
      qrValidityMinutes: 5,
      gracePeriodMinutes: 10,
      geofence: { latitude: 14.5995, longitude: 120.9842, radiusMeters: 40 },
      teacherId: 'spoofed-teacher',
    })

    const request = vi.mocked(fetch).mock.calls[0]
    expect(request[0]).toBe('https://api.polycheck.test/api/sessions')
    expect(request[1]).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }))
    expect(JSON.parse(String(request[1]?.body))).not.toHaveProperty('teacherId')
  })

  it('logs out server-side and removes the cached profile immediately', async () => {
    localStorage.setItem('polycheck-user', JSON.stringify(student))
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    const { api } = await import('./api-client')

    api.logout()

    expect(fetch).toHaveBeenCalledWith('https://api.polycheck.test/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    expect(api.getCurrentUser()).toBeNull()
    expect(localStorage.getItem('polycheck-user')).toBeNull()
  })

  it('creates student accounts through the authenticated super-admin endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(student))
    const { api } = await import('./api-client')
    const account = {
      fullName: 'Test Student',
      studentId: '2026-00001-MN-0',
      email: 'student@iskolarngbayan.pup.edu.ph',
      password: 'Temporary1!Secure',
      program: 'BS Computer Science',
      yearLevel: 1,
      department: 'CCIS',
    }

    await api.createStudent(account)

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/users/students',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(account),
      }),
    )
  })

  it('resets managed-user passwords through an authenticated request', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'Password reset successfully', userId: 'student-1' }))
    const { api } = await import('./api-client')

    await api.resetUserPassword('student-1', 'Replacement1!Secure')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/users/student-1/password',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ password: 'Replacement1!Secure' }),
      }),
    )
  })

  it('sends report filters to the aggregate endpoint instead of requesting raw history', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ totals: {}, summaries: [] }))
    const { api } = await import('./api-client')

    await api.getAttendanceReport({
      startDate: '2026-07-01',
      endDate: '2026-07-18',
      teacherId: 'teacher-1',
      subjectId: 'subject-1',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/attendance/report?startDate=2026-07-01&endDate=2026-07-18&teacherId=teacher-1&subjectId=subject-1',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('caps session roster requests at 1000 records', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))
    const { api } = await import('./api-client')

    await api.getAttendanceRecords('session-1')

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/attendance?sessionId=session-1&limit=1000',
      expect.any(Object),
    )
  })

  it('passes the active report filters through to CSV export', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('csv', { status: 200 }))
    const { api } = await import('./api-client')

    await api.exportAttendanceCsv({
      startDate: '2026-07-01',
      endDate: '2026-07-18',
      sectionId: 'section-1',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.polycheck.test/api/reports/export?startDate=2026-07-01&endDate=2026-07-18&sectionId=section-1',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
