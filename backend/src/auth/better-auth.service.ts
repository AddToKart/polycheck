import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { compare, hash } from 'bcryptjs'
import type { BetterAuthOptions } from 'better-auth'
import { PrismaService } from '../prisma/prisma.service'
import { PASSWORD_HASH_COST } from './password-policy'
import { resolveSessionCreateAfter, resolveSessionGeneration } from './session-policy'
import { DeviceBindingService } from '../users/device-binding.service'

interface BetterAuthRuntime {
  api: {
    signInEmail(options: {
      body: { email: string; password: string; rememberMe: boolean }
      headers: Headers
      returnHeaders: true
    }): Promise<{ headers: Headers }>
    signOut(options: { headers: Headers; returnHeaders: true }): Promise<{ headers: Headers }>
    getSession(options: {
      headers: Headers
      query: { disableCookieCache: boolean; disableRefresh: boolean }
    }): Promise<{
      session: { id: string; generation: number }
      user: {
        id: string
        email: string
        role: string
        scope: string | null
        department: string | null
        studentId: string | null
        isActive: boolean
        mustChangePassword: boolean
        authVersion: number
        privacyConsentVersion: string | null
        privacyConsentedAt: Date | null
        isItCoordinator: boolean
        isDepartmentHead: boolean
        isUserRegistrar: boolean
      }
    } | null>
  }
}

interface BetterAuthModule {
  betterAuth(options: BetterAuthOptions): unknown
}

interface PrismaAdapterModule {
  prismaAdapter(client: unknown, options: { provider: 'postgresql' }): NonNullable<BetterAuthOptions['database']>
}

interface BetterAuthPluginsModule {
  bearer(options: { requireSignature: boolean }): NonNullable<BetterAuthOptions['plugins']>[number]
}

// TypeScript rewrites import() to require() under CommonJS, which cannot load Better Auth's ESM-only build.
const importEsm = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>

@Injectable()
export class BetterAuthService implements OnModuleInit {
  auth!: BetterAuthRuntime
  /**
   * Device id for the login currently being created. The Better Auth database
   * hook cannot see the HTTP body, so the caller attaches the device just
   * before `signInEmail` and the session-create hook consumes it. Entries are
   * removed in a `finally` even when the sign-in fails.
   */
  private readonly pendingLoginDevices = new Map<string, string>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly deviceBinding: DeviceBindingService,
  ) {}

  async signInWithDevice(
    userId: string,
    body: { email: string; password: string; rememberMe: boolean },
    headers: Headers,
    deviceId?: string | null,
  ): Promise<{ headers: Headers }> {
    const normalized = deviceId?.trim()
    if (normalized) this.pendingLoginDevices.set(userId, normalized)
    try {
      return await this.auth.api.signInEmail({ body, headers, returnHeaders: true })
    } finally {
      this.pendingLoginDevices.delete(userId)
    }
  }

  async onModuleInit() {
    const [{ betterAuth }, { prismaAdapter }, { bearer }] = await Promise.all([
      importEsm<BetterAuthModule>('better-auth'),
      importEsm<PrismaAdapterModule>('better-auth/adapters/prisma'),
      importEsm<BetterAuthPluginsModule>('better-auth/plugins'),
    ])
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development'
    const trustedOrigins = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

    const options: BetterAuthOptions = {
      appName: 'Polycheck',
      baseURL:
        this.config.get<string>('BETTER_AUTH_URL') ?? `http://localhost:${this.config.get<number>('PORT') ?? 4000}`,
      basePath: '/api/auth/better-auth',
      secret: this.config.getOrThrow<string>('BETTER_AUTH_SECRET'),
      trustedOrigins,
      database: prismaAdapter(this.prisma, { provider: 'postgresql' }),
      emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        minPasswordLength: 6,
        maxPasswordLength: 128,
        revokeSessionsOnPasswordReset: true,
        password: {
          hash: (password) => hash(password, PASSWORD_HASH_COST),
          verify: ({ hash: passwordHash, password }) => compare(password, passwordHash),
        },
      },
      user: {
        modelName: 'User',
        fields: {
          name: 'fullName',
          email: 'authEmail',
          emailVerified: 'authEmailVerified',
          image: 'photoUrl',
        },
        additionalFields: {
          role: { type: 'string', input: false, returned: true },
          scope: { type: 'string', input: false, returned: true },
          department: { type: 'string', input: false, returned: true },
          studentId: { type: 'string', input: false, returned: true },
          isActive: { type: 'boolean', input: false, returned: true },
          mustChangePassword: { type: 'boolean', input: false, returned: true },
          authVersion: { type: 'number', input: false, returned: true },
          privacyConsentVersion: { type: 'string', input: false, returned: true },
          privacyConsentedAt: { type: 'date', input: false, returned: true },
          isItCoordinator: { type: 'boolean', input: false, returned: true },
          isDepartmentHead: { type: 'boolean', input: false, returned: true },
          isUserRegistrar: { type: 'boolean', input: false, returned: true },
        },
      },
      account: { modelName: 'AuthAccount' },
      session: {
        modelName: 'AuthSession',
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: { enabled: false },
        additionalFields: {
          generation: {
            type: 'number',
            required: true,
            input: false,
            returned: true,
            defaultValue: 0,
          },
          deviceId: {
            type: 'string',
            required: false,
            input: false,
            returned: true,
          },
        },
      },
      verification: { modelName: 'AuthVerification' },
      plugins: [bearer({ requireSignature: true })],
      advanced: {
        useSecureCookies: nodeEnv === 'production',
        cookies: {
          session_token: { name: 'polycheck_access' },
        },
        defaultCookieAttributes: {
          httpOnly: true,
          secure: nodeEnv === 'production',
          sameSite: 'strict',
          path: '/',
        },
      },
      rateLimit: { enabled: false },
      databaseHooks: {
        session: {
          create: {
            before: async (session) => {
              const account = await this.prisma.user.findUnique({
                where: { id: session.userId },
                select: { isActive: true, role: true, authVersion: true },
              })
              if (!account) return false
              const decision = resolveSessionGeneration({
                isActive: account.isActive,
                role: account.role,
                authVersion: account.authVersion,
              })
              if (!decision.allowed) return false
              return { data: { ...session, generation: decision.generation } }
            },
            after: async (session) => {
              const action = resolveSessionCreateAfter(
                { id: String(session.id), generation: Number(session.generation) },
                await this.prisma.user.findUnique({
                  where: { id: session.userId },
                  select: { authVersion: true, role: true },
                }),
              )
              if (action === 'delete-self') {
                await this.prisma.authSession.deleteMany({ where: { id: session.id } })
                return
              }
              if (action === 'purge-same-device') {
                const deviceId = this.pendingLoginDevices.get(String(session.userId))
                if (deviceId) {
                  await this.deviceBinding.stampLoginSession(String(session.userId), deviceId, String(session.id))
                }
              }
            },
          },
        },
      },
    }
    this.auth = betterAuth(options) as BetterAuthRuntime
  }
}
