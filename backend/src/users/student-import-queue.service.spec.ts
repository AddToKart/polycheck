import { BadRequestException, NotFoundException } from '@nestjs/common'
import { StudentImportQueueService } from './student-import-queue.service'
import type { StudentImportRequestDto } from './dto/import-students.dto'

const admin = { id: 'admin-1', role: 'super_admin' as const, scope: 'institution' }
const jobId = 'a'.repeat(64)

function executeRequest(): StudentImportRequestDto {
  return {
    mode: 'execute',
    conflictMode: 'skip_existing',
    rows: [{ rowNumber: 2, fullName: 'Student', studentId: '2024-00001-MN-0' }],
    rowChecksum: 'b'.repeat(16),
  }
}

function activeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: admin.id,
    role: 'super_admin',
    scope: 'institution',
    department: null,
    isActive: true,
    isItCoordinator: false,
    isDepartmentHead: false,
    isUserRegistrar: false,
    ...overrides,
  }
}

describe('StudentImportQueueService', () => {
  const importer = {
    importStudents: jest.fn(),
    assertChecksum: jest.fn(),
    assertDeliveryModeAvailable: jest.fn().mockResolvedValue(undefined),
  }
  const redis = {
    setJson: jest.fn().mockResolvedValue(true),
    getJson: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  }
  const config = { get: jest.fn().mockReturnValue(undefined) }
  const prisma = {
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  let service: StudentImportQueueService

  beforeEach(async () => {
    jest.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue(activeAccount())
    service = new StudentImportQueueService(importer as never, prisma as never, redis as never, config as never)
    await service.onModuleInit()
  })

  afterEach(async () => {
    await service.onModuleDestroy()
  })

  it('runs inline in development when Redis is not configured', async () => {
    importer.importStudents.mockResolvedValue({ mode: 'execute', summary: {} })

    const result = await service.importStudents(admin as never, executeRequest(), true)

    expect(importer.assertChecksum).toHaveBeenCalled()
    expect(importer.importStudents).toHaveBeenCalledWith(executeRequest(), admin)
    expect(result).toEqual({ mode: 'execute', summary: {} })
  })

  it('rejects background validation requests', async () => {
    await expect(
      service.importStudents(admin as never, { ...executeRequest(), mode: 'validate', rowChecksum: undefined }, true),
    ).rejects.toThrow(BadRequestException)
    expect(importer.importStudents).not.toHaveBeenCalled()
  })

  it('maps active job state and enforces requester ownership', async () => {
    const queue = {
      close: jest.fn(),
      getJob: jest.fn().mockResolvedValue({
        data: { user: { id: admin.id } },
        getState: async () => 'active',
        progress: { chunksDone: 0, chunksTotal: 1 },
      }),
    }
    Object.assign(service, { queue })

    await expect(service.status(admin as never, jobId)).resolves.toEqual({
      id: jobId,
      state: 'active',
      progress: { chunksDone: 0, chunksTotal: 1 },
    })
    await expect(service.status({ id: 'other', role: 'super_admin' } as never, jobId)).rejects.toThrow(
      NotFoundException,
    )
    await expect(service.status(admin as never, 'not-a-job-id')).rejects.toThrow(NotFoundException)
  })

  it('returns failed job errors and one-time credentials on completion', async () => {
    const queue = {
      close: jest.fn(),
      getJob: jest.fn().mockResolvedValue({
        data: { user: { id: admin.id } },
        getState: async () => 'failed',
        failedReason: 'chunk failed',
        progress: undefined,
      }),
    }
    Object.assign(service, { queue })

    await expect(service.status(admin as never, jobId)).resolves.toEqual({
      id: jobId,
      state: 'failed',
      error: 'chunk failed',
    })

    const completedResult = { mode: 'execute', summary: { new: 1 } }
    queue.getJob.mockResolvedValue({
      data: { user: { id: admin.id } },
      returnvalue: completedResult,
      progress: { chunksDone: 1, chunksTotal: 1 },
    })
    const completedQueue = {
      close: jest.fn(),
      getJob: jest
        .fn()
        .mockResolvedValueOnce({ data: { user: { id: admin.id } }, getState: async () => 'completed' })
        .mockResolvedValueOnce({ data: { user: { id: admin.id } }, returnvalue: completedResult }),
    }
    Object.assign(service, { queue: completedQueue })
    redis.getJson.mockResolvedValue([{ rowNumber: 2, studentId: '2024-00001-MN-0', tempPassword: 'secret' }])
    redis.delete.mockResolvedValue(true)

    await expect(service.status(admin as never, jobId)).resolves.toEqual({
      id: jobId,
      state: 'completed',
      result: {
        ...completedResult,
        credentials: [{ rowNumber: 2, studentId: '2024-00001-MN-0', tempPassword: 'secret' }],
      },
    })
  })

  describe('queued job privilege re-check (BE-05)', () => {
    function job(overrides: Record<string, unknown> = {}) {
      return {
        id: jobId,
        data: {
          user: { id: admin.id, role: 'super_admin', scope: 'institution', department: null },
          request: executeRequest(),
          rowChecksum: 'b'.repeat(16),
          ...overrides,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
        getState: jest.fn(),
      }
    }

    const runJob = (target: unknown) =>
      (service as unknown as { processJob: (job: unknown) => Promise<unknown> }).processJob(target)

    it('executes an import with the freshly loaded actor snapshot', async () => {
      importer.importStudents.mockResolvedValue({ mode: 'execute', summary: { new: 1 } })
      prisma.user.findUnique.mockResolvedValue(activeAccount())

      await runJob(job())

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: admin.id },
        select: expect.objectContaining({ isActive: true, role: true, scope: true, department: true }),
      })
      expect(importer.importStudents).toHaveBeenCalledWith(
        executeRequest(),
        expect.objectContaining({
          id: admin.id,
          role: 'super_admin',
          scope: 'institution',
          isItCoordinator: false,
          isDepartmentHead: false,
          isUserRegistrar: false,
        }),
      )
    })

    it('fails the job when the actor was disabled while it sat in the queue', async () => {
      prisma.user.findUnique.mockResolvedValue(activeAccount({ isActive: false }))

      await expect(runJob(job())).rejects.toMatchObject({
        message: 'The account that queued this import is no longer active',
      })
      expect(importer.importStudents).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: admin.id,
          action: 'admin.user.import_refused',
          entityType: 'import_batch',
          metadata: { reason: 'account_disabled' },
        }),
      })
    })

    it('fails the job when the actor is demoted out of the import privilege', async () => {
      prisma.user.findUnique.mockResolvedValue(
        activeAccount({ role: 'student', scope: null, isItCoordinator: false, isUserRegistrar: false }),
      )

      await expect(runJob(job())).rejects.toMatchObject({
        message: 'The account that queued this import is no longer allowed to import students',
      })
      expect(importer.importStudents).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: { reason: 'privileges_revoked' } }),
      })
    })

    it('fails the job when the actor lost the registrar designation', async () => {
      prisma.user.findUnique.mockResolvedValue(
        activeAccount({ role: 'teacher', scope: null, department: 'CCIS', isUserRegistrar: false }),
      )

      await expect(runJob(job())).rejects.toMatchObject({
        message: 'The account that queued this import is no longer allowed to import students',
      })
      expect(importer.importStudents).not.toHaveBeenCalled()
    })

    it('accepts a registrar who still holds the designation and department', async () => {
      importer.importStudents.mockResolvedValue({ mode: 'execute', summary: {} })
      prisma.user.findUnique.mockResolvedValue(
        activeAccount({ role: 'teacher', scope: null, department: 'CCIS', isUserRegistrar: true }),
      )

      await expect(runJob(job())).resolves.toMatchObject({ mode: 'execute' })
      expect(importer.importStudents).toHaveBeenCalledWith(
        executeRequest(),
        expect.objectContaining({ role: 'teacher', department: 'CCIS', isUserRegistrar: true }),
      )
    })

    it('fails the job when the actor row disappeared and still never crashes on audit failure', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.auditLog.create.mockRejectedValue(new Error('audit down'))

      await expect(runJob(job())).rejects.toMatchObject({
        message: 'The account that queued this import is no longer active',
      })
      expect(importer.importStudents).not.toHaveBeenCalled()
    })
  })
})
