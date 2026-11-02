import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { BetterAuthService } from './better-auth.service'
import { SessionAuthenticator } from './session-authenticator.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'
import { MaintenanceModeModule } from '../maintenance-mode/maintenance-mode.module'

@Module({
  imports: [InfrastructureModule, NotificationsModule, UsersModule, MaintenanceModeModule],
  controllers: [AuthController],
  providers: [AuthService, BetterAuthService, SessionAuthenticator],
  exports: [AuthService, BetterAuthService, SessionAuthenticator],
})
export class AuthModule {}
