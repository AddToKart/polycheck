import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { EnrollmentsController } from './enrollments.controller'
import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'
import { EnrollmentImportService } from './enrollment-import.service'

@Module({
  imports: [SettingsModule],
  controllers: [SectionsController, EnrollmentsController],
  providers: [SectionsService, EnrollmentImportService],
  exports: [SectionsService],
})
export class SectionsModule {}
