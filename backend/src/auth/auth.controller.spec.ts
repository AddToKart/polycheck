import type { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { AuthController } from './auth.controller'
import type { AuthService } from './auth.service'

describe('AuthController secure cookies', () => {
  const auth = {
    loginStudent: jest.fn(),
    loginFaculty: jest.fn(),
    logout: jest.fn(),
  }
  const config = { get: jest.fn().mockReturnValue('production') }
  const response = { cookie: jest.fn(), clearCookie: jest.fn() }
  const request = { ip: '203.0.113.10' }
  let controller: AuthController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AuthController(auth as unknown as AuthService, config as unknown as ConfigService)
  })

  it('sets a hardened browser cookie after student login', async () => {
    auth.loginStudent.mockResolvedValue({ token: 'signed-token', user: { id: 'student-1' } })

    await controller.loginStudent(
      { studentId: '2026-00001-MN-0', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.cookie).toHaveBeenCalledWith('polycheck_access', 'signed-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    })
  })

  it('sets the same hardened cookie after faculty login', async () => {
    auth.loginFaculty.mockResolvedValue({ token: 'faculty-token', user: { id: 'teacher-1' } })

    await controller.loginFaculty(
      { email: 'teacher@pup.edu.ph', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.cookie).toHaveBeenCalledWith(
      'polycheck_access',
      'faculty-token',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict' }),
    )
  })

  it('revokes the server session and clears the matching cookie', async () => {
    auth.logout.mockResolvedValue({ success: true })

    await controller.logout({ user: { id: 'student-1' } } as never, response as unknown as Response)

    expect(auth.logout).toHaveBeenCalledWith('student-1')
    expect(response.clearCookie).toHaveBeenCalledWith(
      'polycheck_access',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' }),
    )
  })
})
