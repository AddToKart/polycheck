import { Module } from '@nestjs/common'
import { SessionPermissionsController } from './session-permissions.controller'
import { SessionPermissionsService } from './session-permissions.service'

@Module({
  controllers: [SessionPermissionsController],
  providers: [SessionPermissionsService],
  exports: [SessionPermissionsService],
})
export class SessionPermissionsModule {}
