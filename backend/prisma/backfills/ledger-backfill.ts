import 'dotenv/config'
import { PrismaClient, createPrismaAdapter } from '../../src/prisma/client'
import { computeRecordHash, generateLedgerSalt } from '@polycheck/shared/ledger'

// F9 (WF-LD11) backfill: chains historical AttendanceRecord rows per session in
// (timestamp, id) order using the same canonical hash math as the live
// appendLedger path. Idempotent: rows that already carry a recordHash are
// skipped, so re-runs and partially-failed runs resume safely.
// Run once after the 20261103120000_wow_attendance_hash_chain migration:
//   pnpm exec ts-node prisma/backfills/ledger-backfill.ts
const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

async function main() {
  let cursor: string | undefined
  let sessions = 0
  let chained = 0
  while (true) {
    const batch = await prisma.session.findMany({
      where: cursor ? { id: { gt: cursor } } : undefined,
      orderBy: { id: 'asc' },
      take: 50,
      select: { id: true },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    for (const session of batch) {
      const rows = await prisma.attendanceRecord.findMany({
        where: { sessionId: session.id },
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        select: { id: true, prevHash: true, recordHash: true, salt: true, studentId: true, timestamp: true },
      })
      if (rows.length === 0) continue
      let head: string | null = null
      for (const row of rows) {
        if (!row.timestamp) continue
        if (row.recordHash) {
          head = row.recordHash
          continue
        }
        const salt = row.salt ?? generateLedgerSalt()
        const prevHash = row.prevHash ?? head
        const recordHash = computeRecordHash({
          prevHash,
          studentId: row.studentId,
          timestampIso: row.timestamp.toISOString(),
          sessionId: session.id,
          salt,
        })
        await prisma.attendanceRecord.update({
          where: { id: row.id },
          data: { prevHash, recordHash, salt },
        })
        head = recordHash
        chained += 1
      }
      sessions += 1
    }
  }
  console.log(`Ledger backfill complete: ${sessions} sessions inspected, ${chained} rows chained`)
}

main()
  .catch((error) => {
    console.error('Ledger backfill failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
