import { WsException } from '@nestjs/websockets'
import { AttendanceGateway } from './attendance.gateway'

describe('AttendanceGateway', () => {
  it('does not permit students to join roster update rooms', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', sectionId: 'section-1', teacherId: 'teacher-1' }),
      },
    }
    const gateway = new AttendanceGateway({} as never, prisma as never)
    const socket = { data: { user: { id: 'student-1', role: 'student' } }, join: jest.fn() }

    await expect(gateway.joinSession(socket as never, { sessionId: 'session-1' })).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('joins an owning teacher only to the requested session room', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', sectionId: 'section-1', teacherId: 'teacher-1' }),
      },
    }
    const gateway = new AttendanceGateway({} as never, prisma as never)
    const socket = { data: { user: { id: 'teacher-1', role: 'teacher' } }, join: jest.fn() }

    await gateway.joinSession(socket as never, { sessionId: 'session-1' })

    expect(socket.join).toHaveBeenCalledTimes(1)
    expect(socket.join).toHaveBeenCalledWith('session:session-1')
  })
})
