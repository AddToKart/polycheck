import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { createPrismaAdapter, PrismaClient, UserRole } from '../src/prisma/client'
import { hash } from '@node-rs/bcrypt'
import { isStrongPassword, PASSWORD_HASH_COST } from '../src/auth/password-policy'

/**
 * Creates the FIRST institution super administrator on an otherwise blank system.
 *
 * Unlike `seed.ts` (demo accounts, subjects, sections and attendance for development), this writes exactly
 * one user and its credential row, so a production database stays empty until real accounts are created
 * from the administrator console or the bulk importer.
 *
 * Safety properties:
 *  - Idempotent by email: an existing user with that email is never modified (no password reset through a
 *    forgotten environment variable).
 *  - The password comes from the environment, must satisfy the same policy as every other account, and is
 *    flagged `mustChangePassword` so it is replaced at first sign-in and the deploy variable becomes useless.
 *  - Nothing secret is printed.
 */
export interface BootstrapAdminInput {
  email: string
  password: string
  fullName: string
}

export type BootstrapAdminResult = { created: true; id: string } | { created: false; reason: 'email_exists' }

export function readBootstrapInput(env: NodeJS.ProcessEnv): BootstrapAdminInput {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const password = env.BOOTSTRAP_ADMIN_PASSWORD ?? ''
  const fullName = env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be set to a valid email address')
  }
  if (!isStrongPassword(password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be 12-128 characters with upper and lower case letters, a digit and a symbol',
    )
  }
  if (fullName.length < 2 || fullName.length > 150) {
    throw new Error('BOOTSTRAP_ADMIN_NAME must be 2-150 characters')
  }
  return { email, password, fullName }
}

export async function bootstrapAdmin(prisma: PrismaClient, input: BootstrapAdminInput): Promise<BootstrapAdminResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
  if (existing) return { created: false, reason: 'email_exists' }

  const password = await hash(input.password, { cost: PASSWORD_HASH_COST })
  const id = `s-admin-${randomBytes(4).toString('hex')}`
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        fullName: input.fullName,
        email: input.email,
        authEmail: `u-${id}@auth.polycheck.invalid`,
        password,
        role: UserRole.super_admin,
        scope: 'institution',
        mustChangePassword: true,
      },
    })
    await tx.authAccount.create({
      data: {
        id: `credential-${id}`,
        accountId: id,
        providerId: 'credential',
        userId: id,
        password,
        createdAt: now,
        updatedAt: now,
      },
    })
  })
  return { created: true, id }
}

async function main() {
  const input = readBootstrapInput(process.env)
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() })
  try {
    const result = await bootstrapAdmin(prisma, input)
    if (result.created) {
      console.log(`Created super administrator ${input.email} (password change required at first sign-in).`)
    } else {
      console.log(`A user with email ${input.email} already exists; nothing was changed.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
