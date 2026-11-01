import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator'
import { MaintenanceModeController } from './maintenance-mode.controller'

describe('MaintenanceModeController', () => {
  it('exposes the public status route without authentication', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MaintenanceModeController.prototype.status)).toBe(true)
  })

  it('returns the current maintenance snapshot', async () => {
    const maintenance = {
      current: jest.fn().mockResolvedValue({ enabled: true, message: 'Campus maintenance' }),
    }
    const controller = new MaintenanceModeController(maintenance as never)
    await expect(controller.status()).resolves.toEqual({ enabled: true, message: 'Campus maintenance' })
    expect(maintenance.current).toHaveBeenCalledTimes(1)
  })
})
