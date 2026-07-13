import { Body, Controller, Delete, Get, Param, Post, Request } from '@nestjs/common'
import { IsString } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { SessionPermissionsService } from './session-permissions.service'
class PermissionDto { @IsString() sectionId:string; @IsString() studentId:string }
@Controller('session-permissions') export class SessionPermissionsController { constructor(private readonly permissions:SessionPermissionsService){}
 @Post() @Roles('teacher') grant(@Request() req,@Body() dto:PermissionDto){return this.permissions.grant(req.user,dto)}
 @Delete(':sectionId/:studentId') @Roles('teacher') revoke(@Request() req,@Param('sectionId') sectionId:string,@Param('studentId') studentId:string){return this.permissions.revoke(req.user,sectionId,studentId)}
 @Get('check/:sectionId/:studentId') check(@Request() req,@Param('sectionId') sectionId:string,@Param('studentId') studentId:string){return this.permissions.check(req.user,sectionId,studentId)}
 @Get(':sectionId') active(@Request() req,@Param('sectionId') sectionId:string){return this.permissions.active(req.user,sectionId)} }
