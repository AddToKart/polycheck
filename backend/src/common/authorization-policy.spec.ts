import { ROLES_KEY } from './decorators/roles.decorator'
import { AttendanceController } from '../attendance/attendance.controller'
import { DisputesController } from '../disputes/disputes.controller'
import { ProofsController } from '../proofs/proofs.controller'
import { SectionsController } from '../sections/sections.controller'
import { SessionsController } from '../sessions/sessions.controller'
import { SubjectsController } from '../subjects/subjects.controller'
import { UsersController } from '../users/users.controller'
import { AuditLogsController } from '../audit-logs/audit-logs.controller'
import { DashboardController } from '../dashboard/dashboard.controller'

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
    UsersController.prototype.importStudents,
    UsersController.prototype.importJobStatus,
    UsersController.prototype.resetPassword,
    UsersController.prototype.setStatus,
    UsersController.prototype.update,
    UsersController.prototype.changeRole,
    UsersController.prototype.createAdmin,
    AuditLogsController.prototype.list,
    DashboardController.prototype.adminOverview,
    DashboardController.prototype.serverStatusSnapshot,
  ])('keeps account administration restricted to super_admin', (method) => {
    expect(rolesFor(method as ControllerMethod)).toEqual(['super_admin'])
  })

  it('keeps bulk section enrollment with the owning teacher only', () => {
    expect(rolesFor(SectionsController.prototype.importEnrollments as ControllerMethod)).toEqual(['teacher'])
  })

  it('keeps excuse requests student-only and decisions teacher-only', () => {
    expect(rolesFor(AttendanceController.prototype.requestExcuse as ControllerMethod)).toEqual(['student'])
    expect(rolesFor(AttendanceController.prototype.decideExcuse as ControllerMethod)).toEqual(['teacher'])
    expect(rolesFor(AttendanceController.prototype.excuses as ControllerMethod)).toEqual(['teacher', 'super_admin'])
    expect(rolesFor(AttendanceController.prototype.atRiskStudents as ControllerMethod)).toEqual([
      'teacher',
      'super_admin',
    ])
  })
})
