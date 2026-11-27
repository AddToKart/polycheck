import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ProofsService } from './proofs.service'

describe('ProofsService', () => {
  const config = { get: jest.fn((key: string) => (key === 'MAX_PROOF_BYTES' ? 5_000_000 : 'uploads')) }
  const storage = { store: jest.fn(), read: jest.fn(), remove: jest.fn() }

  it('only accepts uploads while a session is active', async () => {
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', sectionId: 'sec1', isActive: false }) },
    }
    const service = new ProofsService(prisma as never, config as never, storage as never)

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
    const service = new ProofsService(prisma as never, config as never, storage as never)

    await expect(
      service.upload(
        { id: 'student-1', role: 'student' },
        { sectionId: 'sec1', sessionId: 's1', photoData: 'data:text/plain;base64,SGVsbG8=' },
      ),
    ).rejects.toThrow(BadRequestException)
    expect(prisma.proofOfClass.create).not.toHaveBeenCalled()
  })

  describe('QAC uploads', () => {
    // 2026-11-27 10:00 campus time, inside a 09:00-10:30 class whose QR code has already closed.
    const during = new Date('2026-11-27T10:00:00+08:00')
    const ongoing = {
      id: 's1',
      sectionId: 'sec1',
      teacherId: 'teacher-1',
      date: '2026-11-27',
      startTime: '09:00',
      endTime: '10:30',
      isActive: false,
    }
    // A 1x1 PNG.
    const photoData =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhWMjWwAAAABJRU5ErkJggg=='
    const student = { id: 'student-1', role: 'student' as const }

    function build(options: { qac?: boolean; existing?: number } = {}) {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        proofOfClass: {
          count: jest.fn().mockResolvedValue(options.existing ?? 0),
          create: jest.fn().mockResolvedValue({ id: 'p1', photoUrl: '/uploads/p1.png' }),
        },
      }
      const prisma = {
        session: { findUnique: jest.fn().mockResolvedValue(ongoing) },
        enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'e1' }) },
        sectionRole: { findFirst: jest.fn().mockResolvedValue(options.qac === false ? null : { id: 'r1' }) },
        // A president permission must not open uploads.
        sessionPermission: { findFirst: jest.fn().mockResolvedValue({ id: 'perm' }) },
        user: { findUnique: jest.fn().mockResolvedValue({ fullName: 'QAC Student' }) },
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      }
      const store = {
        store: jest.fn().mockResolvedValue('/uploads/p1.png'),
        read: jest.fn(),
        remove: jest.fn().mockResolvedValue(undefined),
      }
      return { service: new ProofsService(prisma as never, config as never, store as never), tx, store }
    }

    beforeEach(() => jest.useFakeTimers().setSystemTime(during))
    afterEach(() => jest.useRealTimers())

    const upload = (service: ProofsService) =>
      service.upload(student, { sectionId: 'sec1', sessionId: 's1', photoData })

    it('accepts a photo while class is ongoing, even after the QR code closed', async () => {
      const { service, tx } = build({ existing: 3 })
      await upload(service)
      expect(tx.proofOfClass.create).toHaveBeenCalled()
    })

    it('stops at four photos per session and removes the stored file', async () => {
      const { service, tx, store } = build({ existing: 4 })
      await expect(upload(service)).rejects.toThrow('up to 4 photos')
      expect(tx.proofOfClass.create).not.toHaveBeenCalled()
      expect(store.remove).toHaveBeenCalledWith('/uploads/p1.png')
    })

    it('refuses anyone who is not a QAC, including a president with permission', async () => {
      const { service, store } = build({ qac: false })
      await expect(upload(service)).rejects.toThrow(ForbiddenException)
      expect(store.store).not.toHaveBeenCalled()
    })

    it('lists QAC sections with today’s classes and the officer’s own photo count', async () => {
      const prisma = {
        sectionRole: {
          findMany: jest.fn().mockResolvedValue([
            {
              sectionId: 'sec1',
              section: {
                id: 'sec1',
                section: '4-1',
                course: 'BSIT',
                teacher: { fullName: 'Prof. Example' },
                subject: { name: 'Capstone', code: 'INTE 401' },
              },
            },
          ]),
        },
        session: { findMany: jest.fn().mockResolvedValue([{ ...ongoing, room: 'Lab 1' }]) },
        proofOfClass: { findMany: jest.fn().mockResolvedValue([{ sessionId: 's1' }, { sessionId: 's1' }]) },
      }
      const service = new ProofsService(prisma as never, config as never, storage as never)

      await expect(service.qacSections(student, during)).resolves.toEqual([
        expect.objectContaining({
          sectionId: 'sec1',
          subjectCode: 'INTE 401',
          sessions: [expect.objectContaining({ id: 's1', open: true, myPhotoCount: 2 })],
        }),
      ])
    })
  })

  it('prevents unrelated students from listing proof', async () => {
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', sectionId: 'sec1', teacherId: 'teacher-1' }) },
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
    }
    const service = new ProofsService(prisma as never, config as never, storage as never)

    await expect(service.list({ id: 'student-2', role: 'student' }, 's1')).rejects.toThrow(ForbiddenException)
  })

  it('prevents super admins from deleting classroom proof', async () => {
    const prisma = {
      proofOfClass: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proof-1',
          photoUrl: 'proofs/proof-1.jpg',
          session: { teacherId: 'teacher-1' },
        }),
        delete: jest.fn(),
      },
    }
    const service = new ProofsService(prisma as never, config as never, storage as never)

    await expect(
      service.remove({ id: 'admin-1', role: 'super_admin', scope: 'institution' }, 'proof-1'),
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.proofOfClass.delete).not.toHaveBeenCalled()
  })

  it('does not report a failed request after the database deletion has committed', async () => {
    const prisma = {
      proofOfClass: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proof-1',
          photoUrl: 'proofs/proof-1.jpg',
          session: { teacherId: 'teacher-1' },
        }),
        delete: jest.fn().mockResolvedValue({ id: 'proof-1' }),
      },
    }
    storage.remove.mockRejectedValueOnce(new Error('object store unavailable'))
    const service = new ProofsService(prisma as never, config as never, storage as never)

    await expect(service.remove({ id: 'teacher-1', role: 'teacher' }, 'proof-1')).resolves.toBe(true)
  })
})
