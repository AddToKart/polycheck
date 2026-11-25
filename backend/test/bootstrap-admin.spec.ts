import { bootstrapAdmin, readBootstrapInput } from '../prisma/bootstrap-admin'

const VALID = {
  BOOTSTRAP_ADMIN_EMAIL: 'Admin@School.example',
  BOOTSTRAP_ADMIN_PASSWORD: 'Str0ng-Passw0rd!',
  BOOTSTRAP_ADMIN_NAME: 'Campus Admin',
}

describe('readBootstrapInput', () => {
  it('normalizes the email and accepts a policy-compliant password', () => {
    expect(readBootstrapInput(VALID as never)).toEqual({
      email: 'admin@school.example',
      password: 'Str0ng-Passw0rd!',
      fullName: 'Campus Admin',
    })
  })

  it('defaults the display name', () => {
    expect(readBootstrapInput({ ...VALID, BOOTSTRAP_ADMIN_NAME: '' } as never).fullName).toBe('System Administrator')
  })

  it.each([
    ['missing email', { ...VALID, BOOTSTRAP_ADMIN_EMAIL: '' }],
    ['malformed email', { ...VALID, BOOTSTRAP_ADMIN_EMAIL: 'not-an-email' }],
    ['short password', { ...VALID, BOOTSTRAP_ADMIN_PASSWORD: 'Sh0rt!' }],
    ['no symbol', { ...VALID, BOOTSTRAP_ADMIN_PASSWORD: 'NoSymbolsHere123' }],
    ['no password', { ...VALID, BOOTSTRAP_ADMIN_PASSWORD: '' }],
    ['one-letter name', { ...VALID, BOOTSTRAP_ADMIN_NAME: 'A' }],
  ])('rejects %s', (_label, env) => {
    expect(() => readBootstrapInput(env as never)).toThrow()
  })
})

function fakePrisma(existing: { id: string } | null) {
  const created: Array<{ model: string; data: Record<string, unknown> }> = []
  const tx = {
    user: { create: jest.fn(async ({ data }) => created.push({ model: 'user', data })) },
    authAccount: { create: jest.fn(async ({ data }) => created.push({ model: 'authAccount', data })) },
  }
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(existing) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  }
  return { prisma, created }
}

describe('bootstrapAdmin', () => {
  const input = { email: 'admin@school.example', password: 'Str0ng-Passw0rd!', fullName: 'Campus Admin' }

  it('creates exactly one institution super admin plus its credential row, forcing a password change', async () => {
    const { prisma, created } = fakePrisma(null)
    const result = await bootstrapAdmin(prisma as never, input)

    expect(result).toMatchObject({ created: true })
    expect(created.map((entry) => entry.model)).toEqual(['user', 'authAccount'])
    const user = created[0].data
    expect(user).toMatchObject({
      role: 'super_admin',
      scope: 'institution',
      email: 'admin@school.example',
      mustChangePassword: true,
    })
    expect(user.authEmail).toMatch(/^u-s-admin-[0-9a-f]{8}@auth\.polycheck\.invalid$/)
    // The same bcrypt hash must back both the service login and the Better Auth credential row.
    expect(String(user.password)).toMatch(/^\$2[aby]\$12\$/)
    expect(created[1].data.password).toBe(user.password)
    expect(created[1].data).toMatchObject({ providerId: 'credential', accountId: user.id, userId: user.id })
    // The plaintext is never stored.
    expect(JSON.stringify(created)).not.toContain('Str0ng-Passw0rd!')
  })

  it('never modifies an existing user with the same email', async () => {
    const { prisma, created } = fakePrisma({ id: 'existing' })
    expect(await bootstrapAdmin(prisma as never, input)).toEqual({ created: false, reason: 'email_exists' })
    expect(created).toEqual([])
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
