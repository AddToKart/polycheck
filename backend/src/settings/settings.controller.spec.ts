import { SettingsController } from './settings.controller'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { REQUIRED_DESIGNATIONS_KEY } from '../common/decorators/require-designation.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import type { SettingsService } from './settings.service'

type ControllerMethod = (...args: never[]) => unknown

const rolesFor = (method: ControllerMethod): string[] => Reflect.getMetadata(ROLES_KEY, method) ?? []
const designationsFor = (method: ControllerMethod): string[] =>
  Reflect.getMetadata(REQUIRED_DESIGNATIONS_KEY, method) ?? []

/**
 * BE-09 chose redaction over a role change: `GET /settings` stays reachable by
 * every teacher because the session composer reads the classroom defaults, and
 * the service narrows the payload by actor instead. These tests pin the
 * delegation (the controller must pass the caller through) and the absence of a
 * new designation gate on the read path.
 */
describe('SettingsController read exposure (BE-09)', () => {
  function build() {
    const settings = { list: jest.fn().mockResolvedValue([]) }
    const controller = new SettingsController(settings as unknown as SettingsService)
    return { settings, controller }
  }

  it('forwards the authenticated actor so the service can redact per role', async () => {
    const { settings, controller } = build()
    const teacher = { id: 'teacher-1', role: 'teacher', isItCoordinator: false } as AuthenticatedRequest['user']

    await controller.list({ user: teacher } as AuthenticatedRequest)

    expect(settings.list).toHaveBeenCalledWith(teacher)
  })

  it('keeps the read open to teachers without a designation gate (redaction lives in the service)', () => {
    expect(rolesFor(SettingsController.prototype.list as ControllerMethod).sort()).toEqual(['super_admin', 'teacher'])
    // A read gate would break the teacher session composer; only writes and the
    // privacy attestation are designation-scoped.
    expect(designationsFor(SettingsController.prototype.list as ControllerMethod)).toEqual([])
    expect(designationsFor(SettingsController.prototype.set as ControllerMethod)).toEqual(['it_operations'])
    expect(designationsFor(SettingsController.prototype.privacyCenter as ControllerMethod)).toEqual(['it_operations'])
  })

  it('does not let a plain teacher write an administrative key', () => {
    const { settings, controller } = build()
    const teacher = { id: 'teacher-1', role: 'teacher', isItCoordinator: true } as AuthenticatedRequest['user']

    expect(() =>
      controller.set({ user: teacher, ip: '127.0.0.1' } as AuthenticatedRequest, 'institution_name', {
        value: 'PUP',
      }),
    ).toThrow('Only institution administrators can change institution settings')
    expect(settings.list).not.toHaveBeenCalled()
  })
})
