import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { createPrismaAdapter, PrismaClient } from './client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: createPrismaAdapter() })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
