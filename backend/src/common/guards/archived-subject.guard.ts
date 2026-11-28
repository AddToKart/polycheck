import {
  applyDecorators,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SUBJECT_ARCHIVED_CODE } from '@polycheck/shared'
import type { Prisma } from '../../prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export type ArchivedTarget = 'subject' | 'section' | 'session' | 'record' | 'proof' | 'referral'

interface ArchivedRule {
  target: ArchivedTarget
  source: 'params' | 'body'
  field: string
}

const ARCHIVED_RULE = 'polycheck:blocks-archived-subject'

const SUBJECT_WHERE: Record<ArchivedTarget, (id: string) => Prisma.SubjectWhereInput> = {
  subject: (id) => ({ id }),
  section: (id) => ({ sections: { some: { id } } }),
  session: (id) => ({ sections: { some: { sessions: { some: { id } } } } }),
  record: (id) => ({ sections: { some: { attendanceRecords: { some: { id } } } } }),
  proof: (id) => ({ sections: { some: { proofsOfClass: { some: { id } } } } }),
  referral: (id) => ({ sections: { some: { atRiskReferrals: { some: { id } } } } }),
}

/**
 * Refuses a change to anything that belongs to an archived subject. The screens disable their buttons,
 * and this makes the same rule hold for every client.
 */
@Injectable()
export class ArchivedSubjectGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.get<ArchivedRule | undefined>(ARCHIVED_RULE, context.getHandler())
    if (!rule) return true
    const request = context.switchToHttp().getRequest<Record<string, Record<string, unknown> | undefined>>()
    const id = request[rule.source]?.[rule.field]
    // A missing or malformed id is left for validation and the handler to reject.
    if (typeof id !== 'string' || !id) return true
    const archived = await this.prisma.subject.findFirst({
      where: { AND: [SUBJECT_WHERE[rule.target](id), { archivedAt: { not: null } }] },
      select: { id: true },
    })
    if (archived) {
      throw new ConflictException({
        message: 'This subject is archived. Restore it before making changes.',
        code: SUBJECT_ARCHIVED_CODE,
      })
    }
    return true
  }
}

/** `@BlocksArchivedSubject('section', 'params.id')` */
export function BlocksArchivedSubject(target: ArchivedTarget, path: `${'params' | 'body'}.${string}`) {
  const [source, field] = path.split('.') as [ArchivedRule['source'], string]
  return applyDecorators(SetMetadata(ARCHIVED_RULE, { target, source, field }), UseGuards(ArchivedSubjectGuard))
}
