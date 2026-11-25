import { Module } from '@nestjs/common'
import { ImportProfilesController } from './import-profiles.controller'
import { ImportProfilesService } from './import-profiles.service'

/** Shared, header-only column-mapping profiles for master-list imports. */
@Module({
  controllers: [ImportProfilesController],
  providers: [ImportProfilesService],
})
export class ImportProfilesModule {}
