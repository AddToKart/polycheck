import type { Prisma } from '../prisma/client'

/**
 * Working views leave out archived subjects. Combine with `AND` when the surrounding filter may
 * already constrain the section.
 */
export const IN_ACTIVE_SUBJECT = { subject: { archivedAt: null } } satisfies Prisma.SectionWhereInput
