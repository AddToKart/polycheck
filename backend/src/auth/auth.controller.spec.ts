import type { Request, Response } from 'express'
import { AuthController } from './auth.controller'
import type { AuthService } from './auth.service'

describe('AuthController', () => {
  const auth = {
    loginStudent: jest.fn(),
    loginFaculty: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    provisionKey: jest.fn(),
  }
  const response = { append: jest.fn() }
  const request = { ip: '203.0.113.10', headers: {} }
  let controller: AuthController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AuthController(auth as unknown as AuthService)
  })

  it('sets a hardened browser cookie after student login', async () => {
    const setCookies = new Headers()
    setCookies.append('set-cookie', 'polycheck_access=signed-token; HttpOnly; Secure; SameSite=Strict; Path=/')
    setCookies.append('set-cookie', 'polycheck_refresh=refresh-token; HttpOnly; Path=/')
    auth.loginStudent.mockResolvedValue({
      headers: setCookies,
      user: { id: 'student-1' },
      token: 'must-not-leak',
    })

    const result = await controller.loginStudent(
      { studentId: '2026-00001-MN-0', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.append).toHaveBeenCalledTimes(2)
    expect(response.append).toHaveBeenNthCalledWith(
      1,
      'set-cookie',
      'polycheck_access=signed-token; HttpOnly; Secure; SameSite=Strict; Path=/',
    )
    expect(response.append).toHaveBeenNthCalledWith(
      2,
      'set-cookie',
      'polycheck_refresh=refresh-token; HttpOnly; Path=/',
    )
    expect(result).toEqual({ user: { id: 'student-1' } })
  })

  it('sets the same hardened cookie after faculty login', async () => {
    const setCookies = new Headers()
    setCookies.append('set-cookie', 'polycheck_access=faculty-token; HttpOnly; Secure; SameSite=Strict; Path=/')
    auth.loginFaculty.mockResolvedValue({
      headers: setCookies,
      user: { id: 'teacher-1' },
      token: 'must-not-leak',
    })

    const result = await controller.loginFaculty(
      { email: 'teacher@pup.edu.ph', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.append).toHaveBeenCalledWith(
      'set-cookie',
      'polycheck_access=faculty-token; HttpOnly; Secure; SameSite=Strict; Path=/',
    )
    expect(result).toEqual({ user: { id: 'teacher-1' } })
  })

  it('returns a mobile bearer token without setting cookies for student login', async () => {
    auth.loginStudent.mockResolvedValue({
      headers: new Headers({ 'set-cookie': 'polycheck_access=web-cookie' }),
      user: { id: 'student-1' },
      token: 'mobile-bearer-token',
    })

    const result = await controller.loginStudentMobile(
      { studentId: '2026-00001-MN-0', password: 'strong-password' },
      request as Request,
    )

    expect(result).toEqual({ user: { id: 'student-1' }, token: 'mobile-bearer-token' })
    expect(response.append).not.toHaveBeenCalled()
  })

  it('returns a mobile bearer token without setting cookies for faculty login', async () => {
    auth.loginFaculty.mockResolvedValue({
      headers: new Headers({ 'set-cookie': 'polycheck_access=web-cookie' }),
      user: { id: 'teacher-1' },
      token: 'mobile-bearer-token',
    })

    const result = await controller.loginFacultyMobile(
      { email: 'teacher@pup.edu.ph', password: 'strong-password' },
      request as Request,
    )

    expect(result).toEqual({ user: { id: 'teacher-1' }, token: 'mobile-bearer-token' })
    expect(response.append).not.toHaveBeenCalled()
  })

  it('revokes the server session and clears the matching cookie', async () => {
    auth.logout.mockResolvedValue({
      message: 'Logged out successfully',
      headers: new Headers({ 'set-cookie': 'polycheck_access=; Max-Age=0; Path=/' }),
    })

    const result = await controller.logout(
      { user: { id: 'student-1' }, headers: {} } as never,
      response as unknown as Response,
    )

    expect(auth.logout).toHaveBeenCalledWith(expect.any(Headers))
    expect(response.append).toHaveBeenCalledWith('set-cookie', 'polycheck_access=; Max-Age=0; Path=/')
    expect(result).toEqual({ message: 'Logged out successfully' })
  })

  it('delegates getProfile to the auth service with the request user id', async () => {
    const profile = { id: 'student-1', role: 'student' }
    auth.getProfile.mockResolvedValue(profile)

    const result = await controller.getProfile({ user: { id: 'student-1' } } as never)

    expect(auth.getProfile).toHaveBeenCalledWith('student-1')
    expect(result).toBe(profile)
  })

  it('delegates provisionKey to the auth service with the request user id and dto', async () => {
    const provisioned = { id: 'teacher-1', teacherPublicKey: 'provisioned-key' }
    const publicKey = 'x'.repeat(43)
    auth.provisionKey.mockResolvedValue(provisioned)

    const result = await controller.provisionKey({ user: { id: 'teacher-1' } } as never, { publicKey })

    expect(auth.provisionKey).toHaveBeenCalledWith('teacher-1', publicKey)
    expect(result).toBe(provisioned)
  })
})
