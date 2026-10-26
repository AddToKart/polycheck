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

describe('StudentImportQueueService', () => {
  const importer = { importStudents: jest.fn(), assertChecksum: jest.fn() }
  const redis = {
    setJson: jest.fn().mockResolvedValue(true),
    getJson: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  }
  const config = { get: jest.fn().mockReturnValue(undefined) }
  let service: StudentImportQueueService

  beforeEach(async () => {
    jest.clearAllMocks()
    service = new StudentImportQueueService(importer as never, redis as never, config as never)
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
})
