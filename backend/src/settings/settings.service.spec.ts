import { SettingsService } from './settings.service'

describe('SettingsService', () => {
  it('upserts institution settings with the acting administrator', async () => {
    const prisma = { institutionSetting: { upsert: jest.fn().mockResolvedValue({ key: 'timezone' }) } }
    const service = new SettingsService(prisma as never)

    await service.set('timezone', 'Asia/Manila', 'admin-1')

    expect(prisma.institutionSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'timezone' },
      create: { key: 'timezone', value: 'Asia/Manila', updatedBy: 'admin-1' },
      update: { value: 'Asia/Manila', updatedBy: 'admin-1' },
    })
  })
})
