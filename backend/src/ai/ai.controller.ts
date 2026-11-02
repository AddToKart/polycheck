import { Body, Controller, Delete, Get, Param, Post, Request } from '@nestjs/common'
import { AiChatSendSchema, type AiChatSendInput } from '@polycheck/shared'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { Roles } from '../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AiChatService } from './ai-chat.service'
import { AiProviderService } from './ai-provider.service'

@Controller('ai')
export class AiController {
  constructor(
    private readonly provider: AiProviderService,
    private readonly chat: AiChatService,
  ) {}

  @Get('capabilities')
  capabilities(@Request() req: AuthenticatedRequest) {
    return this.provider.describe(req.user)
  }

  @Get('threads')
  listThreads(@Request() req: AuthenticatedRequest) {
    return this.chat.listThreads(req.user)
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.chat.getThread(req.user, id)
  }

  @Delete('threads/:id')
  deleteThread(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.chat.deleteThread(req.user, id)
  }

  @Post('chat')
  @Roles('teacher', 'super_admin', 'student')
  send(@Body(new ZodValidationPipe(AiChatSendSchema)) dto: AiChatSendInput, @Request() req: AuthenticatedRequest) {
    return this.chat.start(req.user, dto)
  }
}
