import { Controller, Get, Query, Request } from '@nestjs/common'
import { IsOptional, IsString } from 'class-validator'
import { DashboardService } from './dashboard.service'
@Controller() export class DashboardController {constructor(private readonly dashboard:DashboardService){}
 @Get('calendar/events') events(@Request() req,@Query('startDate') startDate:string,@Query('endDate') endDate:string){return this.dashboard.events(req.user,startDate,endDate)}
 @Get('reports/export') exportCsv(@Request() req,@Query('sectionId') sectionId?:string,@Query('sessionId') sessionId?:string){return this.dashboard.exportCsv(req.user,sectionId,sessionId)}
 @Get('search') search(@Request() req,@Query('q') q:string){return this.dashboard.search(req.user,q)} }
