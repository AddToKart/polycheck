process.env.NODE_ENV = 'test'
process.env.BETTER_AUTH_SECRET ??= 'e2e-only-better-auth-secret-at-least-32-characters'
process.env.BETTER_AUTH_URL ??= 'http://localhost:4000'
process.env.REDIS_URL ??= ''
