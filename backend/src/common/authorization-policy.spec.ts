import { ROLES_KEY } from './decorators/roles.decorator'
import { REQUIRED_DESIGNATIONS_KEY } from './decorators/require-designation.decorator'
import { AttendanceController } from '../attendance/attendance.controller'
import { DisputesController } from '../disputes/disputes.controller'
import { ProofsController } from '../proofs/proofs.controller'
import { SectionsController } from '../sections/sections.controller'
import { SessionsController } from '../sessions/sessions.controller'
import { SubjectsController } from '../subjects/subjects.controller'
import { UsersController } from '../users/users.controller'
import { AuditLogsController } from '../audit-logs/audit-logs.controller'
import { DashboardController } from '../dashboard/dashboard.controller'
import { SettingsController } from '../settings/settings.controller'
import { ReportsController } from '../reports/reports.controller'

type ControllerMethod = (...args: never[]) => unknown

const rolesFor = (method: ControllerMethod): string[] => Reflect.getMetadata(ROLES_KEY, method) ?? []
const designationsFor = (method: ControllerMethod): string[] =>
  Reflect.getMetadata(REQUIRED_DESIGNATIONS_KEY, method) ?? []

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
    [UsersController.prototype.findAll, 'user_admin'],
    [UsersController.prototype.findTeachers, 'user_admin'],
    [UsersController.prototype.createTeacher, 'user_admin'],
    [UsersController.prototype.createStudent, 'user_admin'],
    [UsersController.prototype.importStudents, 'user_admin'],
    [UsersController.prototype.importJobStatus, 'user_admin'],
    [UsersController.prototype.resetPassword, 'user_admin'],
    [UsersController.prototype.setStatus, 'user_admin'],
    [UsersController.prototype.update, 'user_admin'],
    [DashboardController.prototype.serverStatusSnapshot, 'it_operations'],
    [SettingsController.prototype.set, 'it_operations'],
    [ReportsController.prototype.stats, 'it_operations'],
    [ReportsController.prototype.list, 'it_operations'],
    [ReportsController.prototype.findOne, 'it_operations'],
    [ReportsController.prototype.updateStatus, 'it_operations'],
  ])('opens %p to teachers only through the required designation', (method, designation) => {
    expect(rolesFor(method as ControllerMethod).sort()).toEqual(['super_admin', 'teacher'])
    expect(designationsFor(method as ControllerMethod)).toEqual([designation])
  })

  it.each([
    UsersController.prototype.changeRole,
    UsersController.prototype.createAdmin,
    AuditLogsController.prototype.list,
    DashboardController.prototype.adminOverview,
  ])('keeps %p restricted to super_admin', (method) => {
    expect(rolesFor(method as ControllerMethod)).toEqual(['super_admin'])
    expect(designationsFor(method as ControllerMethod)).toEqual([])
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

  it('does not grant designations to student self-service routes', () => {
    expect(rolesFor(UsersController.prototype.unregisterDevice as ControllerMethod)).toEqual(['student'])
    expect(designationsFor(UsersController.prototype.unregisterDevice as ControllerMethod)).toEqual([])
  })
})
