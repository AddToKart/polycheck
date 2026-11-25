import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { BrandingController } from './branding.controller'
import { BrandingService } from './branding.service'

// 1x1 PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function build(rows: Array<{ key: string; value: string }> = []) {
  const store = new Map(rows.map((row) => [row.key, row.value]))
  const prisma = {
    institutionSetting: {
      findMany: jest.fn(async () => [...store].map(([key, value]) => ({ key, value }))),
      upsert: jest.fn(async ({ where, create }: { where: { key: string }; create: { value: string } }) => {
        store.set(where.key, create.value)
      }),
      deleteMany: jest.fn(async ({ where }: { where: { key: string } }) => {
        store.delete(where.key)
      }),
    },
  }
  return { service: new BrandingService(prisma as never), prisma, store }
}

describe('BrandingService', () => {
  it('returns the neutral defaults when nothing is configured', async () => {
    const { service } = build()
    expect(await service.current()).toEqual({
      name: 'Your Institution',
      shortName: 'Institution',
      campus: '',
      logoDataUrl: null,
    })
  })

  it('derives the short name from the institution name and honours an explicit one', async () => {
    const derived = build([{ key: 'institution_name', value: 'Example Polytechnic of the Province' }])
    expect((await derived.service.current()).shortName).toBe('EPP')
    const explicit = build([
      { key: 'institution_name', value: 'Example Polytechnic of the Province' },
      { key: 'institution_short_name', value: 'EPP-SM' },
      { key: 'institution_campus', value: 'Santa Maria' },
    ])
    expect(await explicit.service.current()).toMatchObject({ shortName: 'EPP-SM', campus: 'Santa Maria' })
  })

  it('stores a valid logo, serves it, and clears it', async () => {
    const { service, store } = build()
    const saved = await service.setLogo(PNG, 'admin-1')
    expect(saved.logoDataUrl).toBe(PNG)
    expect(store.get('institution_logo')).toBe(PNG)
    expect((await service.clearLogo()).logoDataUrl).toBeNull()
  })

  it('rejects non-images, mismatched content and oversized logos', async () => {
    const { service } = build()
    await expect(service.setLogo('data:text/html;base64,PHNjcmlwdD4=', 'a')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.setLogo('data:image/png;base64,AAAA', 'a')).rejects.toBeInstanceOf(BadRequestException)
    const big = `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(300 * 1024)]).toString('base64')}`
    await expect(service.setLogo(big, 'a')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('memoizes reads briefly and invalidates on demand', async () => {
    const { service, prisma } = build([{ key: 'institution_name', value: 'A University' }])
    await service.current()
    await service.current()
    expect(prisma.institutionSetting.findMany).toHaveBeenCalledTimes(1)
    service.invalidate()
    await service.current()
    expect(prisma.institutionSetting.findMany).toHaveBeenCalledTimes(2)
  })
})

describe('BrandingController', () => {
  const institutionAdmin = { user: { id: 'a1', role: 'super_admin', scope: 'institution' } } as never
  const departmentAdmin = { user: { id: 'a2', role: 'super_admin', scope: 'department' } } as never

  it('lets only institution administrators change the logo', async () => {
    const { service } = build()
    const controller = new BrandingController(service)
    await expect(controller.setLogo(institutionAdmin, { dataUrl: PNG })).resolves.toMatchObject({ logoDataUrl: PNG })
    expect(() => controller.setLogo(departmentAdmin, { dataUrl: PNG })).toThrow(ForbiddenException)
    expect(() => controller.clearLogo(departmentAdmin)).toThrow(ForbiddenException)
  })

  it('reads branding without an actor (public route)', async () => {
    const { service } = build([{ key: 'institution_name', value: 'A University' }])
    await expect(new BrandingController(service).current()).resolves.toMatchObject({ name: 'A University' })
  })
})
