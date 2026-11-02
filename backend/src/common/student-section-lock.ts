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

/**
 * Serializes all enrollment membership changes for one section until the
 * current PostgreSQL transaction completes. Bulk imports take this lock once
 * so a concurrent enroll-code join cannot race the import's `studentCount`
 * reconciliation. Always acquire this before `lockStudentSection` to keep a
 * consistent ordering across call sites.
 */
export async function lockSection(tx: Pick<Prisma.TransactionClient, '$executeRaw'>, sectionId: string) {
  const digest = createHash('sha256').update(`section\0${sectionId}`).digest()
  const namespaceKey = digest.readInt32BE(0)
  const entityKey = digest.readInt32BE(4)

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${namespaceKey}, ${entityKey})`
}
