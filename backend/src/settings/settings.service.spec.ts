import { BadRequestException } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { openSecret } from '../common/utils/secret-box'

const config = { get: jest.fn(() => 'a'.repeat(32)) }

describe('SettingsService', () => {
  beforeEach(() => {
    config.get.mockReset()
    config.get.mockReturnValue('a'.repeat(32))
  })

  it('lists institution settings ordered by key without the AI API key', async () => {
    const rows = [
      { key: 'institution_name', value: 'Polytechnic University', updatedBy: 'admin-1' },
      { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' },
    ]
    const prisma = { institutionSetting: { findMany: jest.fn().mockResolvedValue(rows) } }
    const service = new SettingsService(prisma as never, config as never)

    const result = await service.list()

    expect(prisma.institutionSetting.findMany).toHaveBeenCalledWith({
      where: { key: { not: 'ai_api_key' } },
      orderBy: { key: 'asc' },
    })
    expect(result).toBe(rows)
  })

  it('validates and defaults the teacher student-provisioning flag', async () => {
    const prisma = {
      institutionSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ key: 'allow_teacher_student_provisioning', value: 'true' }),
      },
    }
    const service = new SettingsService(prisma as never, config as never)

    await expect(service.getBoolean('allow_teacher_student_provisioning')).resolves.toBe(false)
    await service.set('allow_teacher_student_provisioning', 'true', 'admin-1')
    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'allow_teacher_student_provisioning' },
      create: { key: 'allow_teacher_student_provisioning', value: 'true', updatedBy: 'admin-1' },
      update: { value: 'true', updatedBy: 'admin-1' },
    })

    prisma.institutionSetting.findUnique.mockResolvedValue({ value: 'true' })
    await expect(service.getBoolean('allow_teacher_student_provisioning')).resolves.toBe(true)
    await expect(service.set('allow_teacher_student_provisioning', 'yes', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('validates and round-trips the AI assistant availability switches', async () => {
    const stored = new Map<string, string>()
    const prisma = {
      institutionSetting: {
        findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
          stored.has(where.key) ? { value: stored.get(where.key) } : null,
        ),
        upsert: jest.fn(async ({ create }: { create: { key: string; value: string } }) => {
          stored.set(create.key, create.value)
          return create
        }),
      },
    }
    const service = new SettingsService(prisma as never, config as never)

    for (const key of [
      'ai_assistant_enabled',
      'ai_assistant_teacher_enabled',
      'ai_assistant_student_enabled',
    ] as const) {
      // Missing rows fall back to the caller default (enabled by default).
      await expect(service.getBoolean(key, true)).resolves.toBe(true)
      await service.set(key, 'false', 'admin-1')
      await expect(service.getBoolean(key, true)).resolves.toBe(false)
      await service.set(key, 'true', 'admin-1')
      await expect(service.getBoolean(key, true)).resolves.toBe(true)
      await expect(service.set(key, 'on', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    }
  })

  it('reads integer settings with a fallback for missing or malformed rows', async () => {
    const prisma = {
      institutionSetting: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ value: '30' })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ value: 'not-a-number' })
          .mockResolvedValueOnce({ value: ' 21 ' })
          .mockResolvedValueOnce({ value: '14days' }),
      },
    }
    const service = new SettingsService(prisma as never, config as never)

    await expect(service.getInteger('enrollment_code_expiry_days', 14)).resolves.toBe(30)
    await expect(service.getInteger('enrollment_code_expiry_days', 14)).resolves.toBe(14)
    await expect(service.getInteger('enrollment_code_expiry_days', 14)).resolves.toBe(14)
    await expect(service.getInteger('enrollment_code_expiry_days', 14)).resolves.toBe(21)
    await expect(service.getInteger('enrollment_code_expiry_days', 14)).resolves.toBe(14)
    expect(prisma.institutionSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'enrollment_code_expiry_days' },
      select: { value: true },
    })
  })

  it('upserts institution settings with the acting administrator', async () => {
    const upserted = { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' }
    const prisma = { institutionSetting: { upsert: jest.fn().mockResolvedValue(upserted) } }
    const service = new SettingsService(prisma as never, config as never)

    const result = await service.set('default_qr_validity_minutes', '05', 'admin-1')

    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'default_qr_validity_minutes' },
      create: { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' },
      update: { value: '5', updatedBy: 'admin-1' },
    })
    expect(result).toBe(upserted)
  })

  it('accepts an optional AI base URL and model', async () => {
    const prisma = { institutionSetting: { upsert: jest.fn().mockImplementation(async ({ create }) => create) } }
    const service = new SettingsService(prisma as never, config as never)

    await service.set('ai_base_url', 'https://opencode.ai/inference/go/openai/v1/', 'admin-1')
    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'ai_base_url' },
      create: { key: 'ai_base_url', value: 'https://opencode.ai/inference/go/openai/v1', updatedBy: 'admin-1' },
      update: { value: 'https://opencode.ai/inference/go/openai/v1', updatedBy: 'admin-1' },
    })
    await service.set('ai_model', 'deepseek-v4.1-flash', 'admin-1')

    await expect(service.set('ai_base_url', 'not-a-url', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.set('ai_model', 'model with spaces', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('seals the AI API key at rest and decrypts it on read', async () => {
    let stored = ''
    const prisma = {
      institutionSetting: {
        upsert: jest.fn(async ({ create }) => {
          stored = create.value as string
          return create
        }),
        findUnique: jest.fn(async () => (stored ? { value: stored } : null)),
        deleteMany: jest.fn(async () => {
          stored = ''
          return { count: 1 }
        }),
      },
    }
    const service = new SettingsService(prisma as never, config as never)

    const result = await service.set('ai_api_key', 'sk-super-secret-value', 'admin-1')
    expect(result).toMatchObject({ key: 'ai_api_key', value: '' })
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(stored).not.toContain('sk-super-secret-value')
    expect(openSecret(stored, 'a'.repeat(32))).toBe('sk-super-secret-value')
    await expect(service.getAiApiKey()).resolves.toBe('sk-super-secret-value')
    expect(JSON.stringify(prisma.institutionSetting.upsert.mock.calls)).not.toContain('sk-super-secret-value')

    await service.set('ai_api_key', '', 'admin-1')
    expect(prisma.institutionSetting.deleteMany).toHaveBeenCalledWith({ where: { key: 'ai_api_key' } })
    await expect(service.getAiApiKey()).resolves.toBeNull()
  })

  it('rejects malformed AI API keys', async () => {
    const prisma = { institutionSetting: { upsert: jest.fn(), deleteMany: jest.fn() } }
    const service = new SettingsService(prisma as never, config as never)

    await expect(service.set('ai_api_key', 'short', 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.set('ai_api_key', 'key with spaces in it', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prisma.institutionSetting.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown_setting', '1'],
    ['default_qr_validity_minutes', '16'],
    ['default_geofence_radius_meters', '9'],
    ['default_grace_period_minutes', '-1'],
    ['enrollment_code_expiry_days', '91'],
  ])('rejects unsupported or out-of-range values: %s=%s', async (key, value) => {
    const prisma = { institutionSetting: { upsert: jest.fn() } }
    const service = new SettingsService(prisma as never, config as never)

    await expect(service.set(key, value, 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.institutionSetting.upsert).not.toHaveBeenCalled()
  })
})
