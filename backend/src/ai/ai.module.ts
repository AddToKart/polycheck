import { Module } from '@nestjs/common'
import { InfrastructureModule } from '../infrastructure/infrastructure.module'
import { PrismaModule } from '../prisma/prisma.module'
import { SettingsModule } from '../settings/settings.module'
import { StandingModule } from '../standing/standing.module'
import { AiAuditService } from './ai-audit.service'
import { AiChatService } from './ai-chat.service'
import { AiController } from './ai.controller'
import { AI_FETCH, AiProviderService } from './ai-provider.service'
import { AiStreamService } from './ai-stream.service'
import { AiToolRegistryService } from './ai-tool-registry.service'

@Module({
  imports: [PrismaModule, InfrastructureModule, SettingsModule, StandingModule],
  controllers: [AiController],
  providers: [
    { provide: AI_FETCH, useValue: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) },
    AiProviderService,
    AiAuditService,
    AiToolRegistryService,
    AiStreamService,
    AiChatService,
  ],
  exports: [AiProviderService, AiChatService, AiStreamService, AiToolRegistryService],
})
export class AiModule {}
