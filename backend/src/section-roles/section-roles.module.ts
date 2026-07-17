import { Module } from '@nestjs/common'
import { SectionRolesController } from './section-roles.controller'
import { SectionRolesService } from './section-roles.service'
@Module({ controllers: [SectionRolesController], providers: [SectionRolesService] })
export class SectionRolesModule {}
