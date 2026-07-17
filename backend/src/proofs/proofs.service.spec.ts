import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ProofsService } from './proofs.service'

describe('ProofsService', () => {
  const config = { get: jest.fn((key: string) => (key === 'MAX_PROOF_BYTES' ? 5_000_000 : 'uploads')) }

  it('only accepts uploads while a session is active', async () => {
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', sectionId: 'sec1', isActive: false }) },
    }
    const service = new ProofsService(prisma as never, config as never)

    await expect(
      service.upload(
        { id: 'student-1', role: 'student' },
        { sectionId: 'sec1', sessionId: 's1', photoData: 'not-an-image' },
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects non-image payloads before persistence', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          sectionId: 'sec1',
          teacherId: 'teacher-1',
          isActive: true,
        }),
      },
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'e1' }) },
      sectionRole: { findFirst: jest.fn().mockResolvedValue({ id: 'r1' }) },
      proofOfClass: { create: jest.fn() },
    }
    const service = new ProofsService(prisma as never, config as never)

    await expect(
      service.upload(
        { id: 'student-1', role: 'student' },
        { sectionId: 'sec1', sessionId: 's1', photoData: 'data:text/plain;base64,SGVsbG8=' },
      ),
    ).rejects.toThrow(BadRequestException)
    expect(prisma.proofOfClass.create).not.toHaveBeenCalled()
  })

  it('prevents unrelated students from listing proof', async () => {
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', sectionId: 'sec1', teacherId: 'teacher-1' }) },
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
    }
    const service = new ProofsService(prisma as never, config as never)

    await expect(service.list({ id: 'student-2', role: 'student' }, 's1')).rejects.toThrow(ForbiddenException)
  })
})
