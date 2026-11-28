import { Module } from '@nestjs/common'
import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'
import { EvidenceDocsService } from './evidence-docs.service'
import { ProofsModule } from '../proofs/proofs.module'

@Module({
  imports: [ProofsModule],
  controllers: [DocsController],
  providers: [DocsService, EvidenceDocsService],
  exports: [DocsService],
})
export class DocsModule {}
