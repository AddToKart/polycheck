import type { Request, Response } from 'express'
import { AuthController } from './auth.controller'
import type { AuthService } from './auth.service'

describe('AuthController secure cookies', () => {
  const auth = {
    loginStudent: jest.fn(),
    loginFaculty: jest.fn(),
    logout: jest.fn(),
  }
  const response = { append: jest.fn() }
  const request = { ip: '203.0.113.10', headers: {} }
  let controller: AuthController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AuthController(auth as unknown as AuthService)
  })

  it('sets a hardened browser cookie after student login', async () => {
    auth.loginStudent.mockResolvedValue({
      headers: new Headers({
        'set-cookie': 'polycheck_access=signed-token; HttpOnly; Secure; SameSite=Strict; Path=/',
      }),
      user: { id: 'student-1' },
    })

    await controller.loginStudent(
      { studentId: '2026-00001-MN-0', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.append).toHaveBeenCalledWith(
      'set-cookie',
      'polycheck_access=signed-token; HttpOnly; Secure; SameSite=Strict; Path=/',
    )
  })

  it('sets the same hardened cookie after faculty login', async () => {
    auth.loginFaculty.mockResolvedValue({
      headers: new Headers({
        'set-cookie': 'polycheck_access=faculty-token; HttpOnly; Secure; SameSite=Strict; Path=/',
      }),
      user: { id: 'teacher-1' },
    })

    await controller.loginFaculty(
      { email: 'teacher@pup.edu.ph', password: 'strong-password' },
      request as Request,
      response as unknown as Response,
    )

    expect(response.append).toHaveBeenCalledWith(
      'set-cookie',
      'polycheck_access=faculty-token; HttpOnly; Secure; SameSite=Strict; Path=/',
    )
  })

  it('revokes the server session and clears the matching cookie', async () => {
    auth.logout.mockResolvedValue({
      message: 'Logged out successfully',
      headers: new Headers({ 'set-cookie': 'polycheck_access=; Max-Age=0; Path=/' }),
    })

    await controller.logout({ user: { id: 'student-1' }, headers: {} } as never, response as unknown as Response)

    expect(auth.logout).toHaveBeenCalledWith(expect.any(Headers))
    expect(response.append).toHaveBeenCalledWith('set-cookie', 'polycheck_access=; Max-Age=0; Path=/')
  })
})
