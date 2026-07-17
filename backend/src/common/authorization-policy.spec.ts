import { ROLES_KEY } from './decorators/roles.decorator'
import { AttendanceController } from '../attendance/attendance.controller'
import { DisputesController } from '../disputes/disputes.controller'
import { ProofsController } from '../proofs/proofs.controller'
import { SectionsController } from '../sections/sections.controller'
import { SessionsController } from '../sessions/sessions.controller'
import { SubjectsController } from '../subjects/subjects.controller'
import { UsersController } from '../users/users.controller'

type ControllerMethod = (...args: never[]) => unknown

const rolesFor = (method: ControllerMethod): string[] => Reflect.getMetadata(ROLES_KEY, method) ?? []

describe('role capability policy', () => {
  it.each([
    SubjectsController.prototype.create,
    SubjectsController.prototype.update,
    SubjectsController.prototype.remove,
    SectionsController.prototype.create,
    SectionsController.prototype.update,
    SectionsController.prototype.remove,
    SectionsController.prototype.enrollStudent,
    SectionsController.prototype.removeStudent,
    SectionsController.prototype.resetEnrollmentCode,
    SectionsController.prototype.disableEnrollmentCode,
    SessionsController.prototype.create,
    SessionsController.prototype.createBulk,
    SessionsController.prototype.activate,
    SessionsController.prototype.end,
    AttendanceController.prototype.createManual,
    AttendanceController.prototype.updateStatus,
    DisputesController.prototype.resolve,
    ProofsController.prototype.upload,
    ProofsController.prototype.remove,
  ])('does not grant super_admin an operational classroom mutation', (method) => {
    expect(rolesFor(method as ControllerMethod)).not.toContain('super_admin')
  })

  it.each([
    UsersController.prototype.findAll,
    UsersController.prototype.findTeachers,
    UsersController.prototype.createTeacher,
    UsersController.prototype.createStudent,
    UsersController.prototype.resetPassword,
    UsersController.prototype.setStatus,
  ])('keeps account administration restricted to super_admin', (method) => {
    expect(rolesFor(method as ControllerMethod)).toEqual(['super_admin'])
  })
})
