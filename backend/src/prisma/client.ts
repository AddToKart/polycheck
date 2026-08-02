import { PrismaPg } from '@prisma/adapter-pg'

export * from '../generated/prisma/client'

const DEFAULT_POOL_SIZE = 10
const DEFAULT_CONNECTION_TIMEOUT_SECONDS = 5

export function createPrismaAdapter(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma')
  }

  const url = new URL(databaseUrl)
  const max = positiveInteger(url.searchParams.get('connection_limit'), DEFAULT_POOL_SIZE)
  const connectionTimeoutSeconds = positiveInteger(
    url.searchParams.get('pool_timeout'),
    DEFAULT_CONNECTION_TIMEOUT_SECONDS,
  )

  // These are Prisma engine options, not PostgreSQL connection parameters.
  url.searchParams.delete('pgbouncer')
  url.searchParams.delete('connection_limit')
  url.searchParams.delete('pool_timeout')

  return new PrismaPg({
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: connectionTimeoutSeconds * 1_000,
  })
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
