import { Module } from '@nestjs/common'
import { ProofsController } from './proofs.controller'
import { ProofsService } from './proofs.service'
import { ProofStorageService } from './proof-storage.service'
@Module({ controllers: [ProofsController], providers: [ProofsService, ProofStorageService] })
export class ProofsModule {}
