import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.institutionSetting.findMany({ orderBy: { key: 'asc' } })
  }

  set(key: string, value: string, updatedBy: string) {
    return this.prisma.institutionSetting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    })
  }
}
