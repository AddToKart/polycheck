import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { NotificationsController } from './notifications.controller'

const rolesFor = (method: (...args: never[]) => unknown) => Reflect.getMetadata(ROLES_KEY, method)

describe('NotificationsController authorization metadata', () => {
  it.each([
    NotificationsController.prototype.list,
    NotificationsController.prototype.unreadCount,
    NotificationsController.prototype.markRead,
    NotificationsController.prototype.registerPushToken,
  ])('requires authentication without narrowing to a single role', (method) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, method)).toBeUndefined()
    expect(rolesFor(method as (...args: never[]) => unknown)).toBeUndefined()
  })
})
