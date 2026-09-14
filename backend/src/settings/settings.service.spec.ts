import { BadRequestException } from '@nestjs/common'
import { SettingsService } from './settings.service'

describe('SettingsService', () => {
  it('lists institution settings ordered by key', async () => {
    const rows = [
      { key: 'institution_name', value: 'Polytechnic University', updatedBy: 'admin-1' },
      { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' },
    ]
    const prisma = { institutionSetting: { findMany: jest.fn().mockResolvedValue(rows) } }
    const service = new SettingsService(prisma as never)

    const result = await service.list()

    expect(prisma.institutionSetting.findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } })
    expect(result).toBe(rows)
  })

  it('upserts institution settings with the acting administrator', async () => {
    const upserted = { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' }
    const prisma = { institutionSetting: { upsert: jest.fn().mockResolvedValue(upserted) } }
    const service = new SettingsService(prisma as never)

    const result = await service.set('default_qr_validity_minutes', '05', 'admin-1')

    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'default_qr_validity_minutes' },
      create: { key: 'default_qr_validity_minutes', value: '5', updatedBy: 'admin-1' },
      update: { value: '5', updatedBy: 'admin-1' },
    })
    expect(result).toBe(upserted)
  })

  it.each([
    ['unknown_setting', '1'],
    ['default_qr_validity_minutes', '16'],
    ['default_geofence_radius_meters', '9'],
    ['default_grace_period_minutes', '-1'],
    ['enrollment_code_expiry_days', '91'],
  ])('rejects unsupported or out-of-range values: %s=%s', async (key, value) => {
    const prisma = { institutionSetting: { upsert: jest.fn() } }
    const service = new SettingsService(prisma as never)

    await expect(service.set(key, value, 'admin-1')).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.institutionSetting.upsert).not.toHaveBeenCalled()
  })
})
