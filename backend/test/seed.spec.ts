import type { PrismaClient } from '../src/prisma/client'

// The seed service only runs `node dist-seed/prisma/seed.js`; the historical
// hash-chain backfill must therefore be part of the seed itself. Automocking
// the backfill module lets this spec prove that wiring without a database.
jest.mock('../prisma/backfills/ledger-backfill')

import { backfillAttendanceLedger } from '../prisma/backfills/ledger-backfill'
import { seed } from '../prisma/seed'

const mockedBackfill = jest.mocked(backfillAttendanceLedger)

type SeedClient = {
  user: { findUnique: jest.Mock; upsert: jest.Mock }
  authAccount: { upsert: jest.Mock }
  subject: { upsert: jest.Mock }
  section: { upsert: jest.Mock }
  scheduleDay: { deleteMany: jest.Mock; createMany: jest.Mock }
  session: { upsert: jest.Mock }
  enrollment: { findUnique: jest.Mock; create: jest.Mock }
  attendanceRecord: { upsert: jest.Mock }
  sectionRole: { upsert: jest.Mock }
}

function makeClient() {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    authAccount: { upsert: jest.fn().mockResolvedValue({}) },
    subject: { upsert: jest.fn().mockResolvedValue({}) },
    section: { upsert: jest.fn().mockResolvedValue({}) },
    scheduleDay: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    session: { upsert: jest.fn().mockResolvedValue({}) },
    enrollment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    attendanceRecord: { upsert: jest.fn().mockResolvedValue({}) },
    sectionRole: { upsert: jest.fn().mockResolvedValue({}) },
  } satisfies SeedClient
}

describe('prisma seed ledger wiring', () => {
  const originalSeedPassword = process.env.SEED_PASSWORD

  beforeEach(() => {
    process.env.SEED_PASSWORD = 'PolycheckLocal1!'
    delete process.env.ALLOW_PRODUCTION_SEED
    mockedBackfill.mockReset()
    mockedBackfill.mockResolvedValue({ sessionsInspected: 2, recordsChained: 12 })
  })

  afterAll(() => {
    if (originalSeedPassword === undefined) delete process.env.SEED_PASSWORD
    else process.env.SEED_PASSWORD = originalSeedPassword
  })

  it('runs the attendance ledger backfill after the attendance rows are written', async () => {
    const client = makeClient()

    await seed(client as unknown as PrismaClient)

    expect(mockedBackfill).toHaveBeenCalledTimes(1)
    expect(mockedBackfill).toHaveBeenCalledWith(client)
    expect(client.attendanceRecord.upsert).toHaveBeenCalled()
    const lastAttendanceWrite = client.attendanceRecord.upsert.mock.invocationCallOrder.at(-1) ?? 0
    expect(mockedBackfill.mock.invocationCallOrder[0]).toBeGreaterThan(lastAttendanceWrite)
  })

  it('propagates backfill failures instead of reporting a successful seed', async () => {
    const client = makeClient()
    mockedBackfill.mockRejectedValueOnce(new Error('ledger backfill could not reach postgres'))

    await expect(seed(client as unknown as PrismaClient)).rejects.toThrow(
      'ledger backfill could not reach postgres',
    )
  })
})
