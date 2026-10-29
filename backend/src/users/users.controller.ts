import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { UsersService } from './users.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateStudentDto, CreateTeacherDto, ResetPasswordDto, SetUserStatusDto } from './dto/manage-user.dto'
import { AdminUserQueryDto, ChangeUserRoleDto, CreateAdminDto, UpdateUserDto } from './dto/admin-user.dto'
import {
  EmergencyDeviceReleaseDto,
  TeacherResetStudentPasswordDto,
  UnregisterDeviceDto,
  UpdateContactsDto,
} from './dto/governance.dto'
import { StudentImportRequestDto } from './dto/import-students.dto'
import { StudentImportQueueService } from './student-import-queue.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { parsePagination } from '../common/utils/pagination'

@Controller('users')
export class UsersController {
  constructor(
    private users: UsersService,
    private readonly importQueue: StudentImportQueueService,
  ) {}

  @Get()
  @Roles('super_admin')
  findAll(@Request() req: AuthenticatedRequest, @Query() query: AdminUserQueryDto) {
    const { limit, offset, role, q, department, status } = query
    return this.users.findAll(req.user, { role, q, department, status }, parsePagination(limit, offset))
  }

  @Get('teachers')
  @Roles('super_admin')
  findTeachers(@Request() req: AuthenticatedRequest) {
    return this.users.findTeachers(req.user)
  }

  @Get('students')
  @Roles('teacher', 'super_admin')
  findStudents(@Request() req: AuthenticatedRequest) {
    return this.users.findStudents(req.user)
  }

  @Post('students/import')
  @Roles('super_admin')
  importStudents(
    @Body() dto: StudentImportRequestDto,
    @Request() req: AuthenticatedRequest,
    @Query('background') background?: string,
  ) {
    return this.importQueue.importStudents(req.user, dto, background === 'true' || background === '1')
  }

  @Get('students/import/jobs/:id')
  @Roles('super_admin')
  importJobStatus(@Param('id') jobId: string, @Request() req: AuthenticatedRequest) {
    return this.importQueue.status(req.user, jobId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.users.findOne(id, req.user)
  }

  @Post('teachers')
  @Roles('super_admin')
  createTeacher(@Body() dto: CreateTeacherDto, @Request() req: AuthenticatedRequest) {
    return this.users.createTeacher(dto, req.user)
  }

  @Post('students')
  @Roles('super_admin')
  createStudent(@Body() dto: CreateStudentDto, @Request() req: AuthenticatedRequest) {
    return this.users.createStudent(dto, req.user)
  }

  // ── Account governance (GOV) ──

  @Post('students/:id/teacher-reset-password')
  @Roles('teacher')
  teacherResetStudentPassword(
    @Param('id') id: string,
    @Body() dto: TeacherResetStudentPasswordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.users.teacherResetStudentPassword(id, dto, req.user, req.ip)
  }

  @Post('students/:id/device-release')
  @Roles('teacher')
  emergencyReleaseDevice(
    @Param('id') id: string,
    @Body() dto: EmergencyDeviceReleaseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.users.emergencyReleaseDevice(id, dto, req.user, req.ip)
  }

  @Post('me/device/unregister')
  @Roles('student')
  unregisterDevice(@Body() dto: UnregisterDeviceDto, @Request() req: AuthenticatedRequest) {
    return this.users.unregisterDevice(req.user, dto.deviceId, req.ip)
  }

  @Patch('me/contacts')
  updateContacts(@Body() dto: UpdateContactsDto, @Request() req: AuthenticatedRequest) {
    return this.users.updateContacts(req.user, dto)
  }

  @Post('admins')
  @Roles('super_admin')
  createAdmin(@Body() dto: CreateAdminDto, @Request() req: AuthenticatedRequest) {
    return this.users.createAdmin(dto, req.user)
  }

  @Patch(':id/password')
  @Roles('super_admin')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @Request() req: AuthenticatedRequest) {
    return this.users.resetPassword(id, dto.password, req.user)
  }

  @Patch(':id/status')
  @Roles('super_admin')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto, @Request() req: AuthenticatedRequest) {
    return this.users.setStatus(id, dto.isActive, req.user)
  }

  @Patch(':id/role')
  @Roles('super_admin')
  changeRole(@Param('id') id: string, @Body() dto: ChangeUserRoleDto, @Request() req: AuthenticatedRequest) {
    return this.users.changeUserRole(id, dto.role, req.user)
  }

  @Patch(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: AuthenticatedRequest) {
    return this.users.updateUser(id, dto, req.user)
  }
}
