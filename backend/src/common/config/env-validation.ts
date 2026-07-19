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
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
    BETTER_AUTH_URL: z.string().url().optional(),
    REDIS_URL: z.string().url().optional().or(z.literal('')),
    FRONTEND_URL: z.string().url().optional().or(z.literal('')),
    CORS_ORIGINS: z.string().optional().default('http://localhost:3000,http://localhost:8081'),
    TRUST_PROXY: booleanValue.default(false),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(8).default(1),
    ENABLE_API_DOCS: booleanValue.optional(),
    METRICS_TOKEN: z.string().optional().or(z.literal('')),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    MAX_PROOF_BYTES: z.coerce.number().int().min(1024).max(10_000_000).default(5_000_000),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
    S3_ACCESS_KEY_ID: z.string().min(1).optional().or(z.literal('')),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional().or(z.literal('')),
    S3_FORCE_PATH_STYLE: booleanValue.default(false),
  })
  .superRefine((env, ctx) => {
    const productionOrigins = env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

    if (env.NODE_ENV === 'production' && (!env.METRICS_TOKEN || env.METRICS_TOKEN.length < 32)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['METRICS_TOKEN'],
        message: 'METRICS_TOKEN is required in production and must be at least 32 characters',
      })
    }
    if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      })
    }
    if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BETTER_AUTH_URL'],
        message: 'BETTER_AUTH_URL is required in production',
      })
    }
    if (env.NODE_ENV === 'production' && !env.FRONTEND_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_URL'],
        message: 'FRONTEND_URL is required in production',
      })
    }
    if (env.NODE_ENV === 'production' && !env.TRUST_PROXY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message: 'TRUST_PROXY must be enabled in production behind the Polycheck proxy topology',
      })
    }
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL.includes('pgbouncer=true')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must use PgBouncer transaction-pool compatibility',
      })
    }
    if (
      env.NODE_ENV === 'production' &&
      (!env.DATABASE_URL.includes('connection_limit=') || !env.DATABASE_URL.includes('pool_timeout='))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must set connection_limit and pool_timeout',
      })
    }
    if (
      env.NODE_ENV === 'production' &&
      [env.BETTER_AUTH_URL, env.FRONTEND_URL, ...productionOrigins].some((url) => url && !url.startsWith('https://'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Production public URLs and CORS origins must use HTTPS',
      })
    }
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'Production proof storage must use the s3 driver',
      })
    }
    if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_BUCKET'],
        message: 'S3_BUCKET is required when STORAGE_DRIVER=s3',
      })
    }
    if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_ACCESS_KEY_ID'],
        message: 'S3 access key ID and secret access key must be configured together',
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
