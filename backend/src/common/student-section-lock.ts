import { createHash } from 'node:crypto'
import type { Prisma } from '../prisma/client'

/**
 * Serializes membership and student-scoped authorization changes for one
 * student/section pair until the current PostgreSQL transaction completes.
 */
export async function lockStudentSection(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  studentId: string,
  sectionId: string,
) {
  const digest = createHash('sha256').update(`student-section\0${studentId}\0${sectionId}`).digest()
  const namespaceKey = digest.readInt32BE(0)
  const entityKey = digest.readInt32BE(4)

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${namespaceKey}, ${entityKey})`
}
