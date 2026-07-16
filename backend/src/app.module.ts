import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { SubjectsModule } from './subjects/subjects.module'
import { SectionsModule } from './sections/sections.module'
import { SessionsModule } from './sessions/sessions.module'
import { AttendanceModule } from './attendance/attendance.module'
import { DisputesModule } from './disputes/disputes.module'
import { SectionRolesModule } from './section-roles/section-roles.module'
import { SessionPermissionsModule } from './session-permissions/session-permissions.module'
import { ProofsModule } from './proofs/proofs.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { HealthController } from './health.controller'
import { RealtimeModule } from './realtime/realtime.module'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { SyncModule } from './sync/sync.module'
import { SettingsModule } from './settings/settings.module'
import { MaintenanceModule } from './common/services/maintenance.module'
import { validateEnv } from './common/config/env-validation'
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
        },
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'login', ttl: 60_000, limit: 10 },
      { name: 'scan', ttl: 60_000, limit: 30 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubjectsModule,
    SectionsModule,
    SessionsModule,
    AttendanceModule,
    DisputesModule,
    SectionRolesModule,
    SessionPermissionsModule,
    ProofsModule,
    DashboardModule,
    RealtimeModule,
    InfrastructureModule,
    SyncModule,
    SettingsModule,
    MaintenanceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  controllers: [HealthController],
})
export class AppModule {}
