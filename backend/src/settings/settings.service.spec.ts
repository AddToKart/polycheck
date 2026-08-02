import { SettingsService } from './settings.service'

describe('SettingsService', () => {
  it('lists institution settings ordered by key', async () => {
    const rows = [
      { key: 'schoolName', value: 'Polytechnic University', updatedBy: 'admin-1' },
      { key: 'timezone', value: 'Asia/Manila', updatedBy: 'admin-1' },
    ]
    const prisma = { institutionSetting: { findMany: jest.fn().mockResolvedValue(rows) } }
    const service = new SettingsService(prisma as never)

    const result = await service.list()

    expect(prisma.institutionSetting.findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } })
    expect(result).toBe(rows)
  })

  it('upserts institution settings with the acting administrator', async () => {
    const upserted = { key: 'timezone', value: 'Asia/Manila', updatedBy: 'admin-1' }
    const prisma = { institutionSetting: { upsert: jest.fn().mockResolvedValue(upserted) } }
    const service = new SettingsService(prisma as never)

    const result = await service.set('timezone', 'Asia/Manila', 'admin-1')

    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'timezone' },
      create: { key: 'timezone', value: 'Asia/Manila', updatedBy: 'admin-1' },
      update: { value: 'Asia/Manila', updatedBy: 'admin-1' },
    })
    expect(result).toBe(upserted)
  })
})
