import { Module } from '@nestjs/common'
import { EnrollmentsController } from './enrollments.controller'
import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'

@Module({
  controllers: [SectionsController, EnrollmentsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
