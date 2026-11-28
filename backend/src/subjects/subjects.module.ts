import { Module } from '@nestjs/common'
import { SubjectsController } from './subjects.controller'
import { SubjectsService } from './subjects.service'
import { SubjectLifecycleService } from './subject-lifecycle.service'
import { ProofsModule } from '../proofs/proofs.module'

@Module({
  imports: [ProofsModule],
  controllers: [SubjectsController],
  providers: [SubjectsService, SubjectLifecycleService],
  exports: [SubjectsService, SubjectLifecycleService],
})
export class SubjectsModule {}
