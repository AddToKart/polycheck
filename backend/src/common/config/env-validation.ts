import { z } from 'zod'

const booleanValue = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return value
}, z.boolean())

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_ISSUER: z.string().min(1).default('polycheck-api'),
    JWT_AUDIENCE: z.string().min(1).default('polycheck-clients'),
    REDIS_URL: z.string().url().optional().or(z.literal('')),
    FRONTEND_URL: z.string().url().optional().or(z.literal('')),
    CORS_ORIGINS: z.string().optional().default('http://localhost:3000,http://localhost:8081'),
    TRUST_PROXY: booleanValue.default(false),
    ENABLE_API_DOCS: booleanValue.optional(),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    MAX_PROOF_BYTES: z.coerce.number().int().min(1024).max(10_000_000).default(5_000_000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      })
    }
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('localhost')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Production CORS_ORIGINS must not contain localhost',
      })
    }
  })

export type EnvConfig = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`).join('\n')
    throw new Error(`\n❌ Invalid environment configuration:\n${errors}\n`)
  }
  return result.data
}
