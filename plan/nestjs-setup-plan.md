# Polycheck — NestJS Project Setup Plan

## Responsibility

This document covers the NestJS backend project setup: how to scaffold it within the monorepo, which packages to install, how to structure modules, global configuration, environment variables, and the integration points with Better Auth, Prisma, Redis, and BullMQ.

---

## Directory

The backend lives at `polycheck/backend/`. It is a standard NestJS application registered as a pnpm workspace member.

```
polycheck/backend/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── ownership.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   └── interceptors/
│   │       └── logging.interceptor.ts
│   ├── prisma/
│   │   └── prisma.service.ts
│   ├── redis/
│   │   └── redis.service.ts
│   ├── auth/
│   ├── users/
│   ├── subjects/
│   ├── sections/
│   ├── sessions/
│   ├── attendance/
│   ├── disputes/
│   ├── sync/
│   ├── reports/
│   ├── calendar/
│   ├── section-roles/
│   ├── session-permissions/
│   ├── proofs/
│   └── gateway/
│       └── session.gateway.ts
```

---

## package.json (key dependencies)

```json
{
  "name": "@polycheck/backend",
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "@nestjs/websockets": "^10",
    "@nestjs/platform-socket.io": "^10",
    "@nestjs/throttler": "^5",
    "@nestjs/schedule": "^4",
    "@nestjs/bull": "^10",
    "@bull-board/api": "^5",
    "@socket.io/redis-adapter": "^8",
    "@nestjs-throttler-storage-redis": "^0",
    "better-auth": "latest",
    "@prisma/client": "^5",
    "ioredis": "^5",
    "bullmq": "^5",
    "passport": "^0",
    "passport-jwt": "^4",
    "@nestjs/passport": "^10",
    "zod": "^3",
    "@polycheck/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10",
    "prisma": "^5",
    "@types/passport-jwt": "^4",
    "ts-node": "^10",
    "typescript": "^5"
  }
}
```

---

## Environment Variables

All secrets must be in environment variables. Never commit secrets.

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/polycheck

# Redis
REDIS_URL=redis://localhost:6379

# Better Auth
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=http://localhost:3000   # Next.js app URL (for session verification)

# JWT
JWT_SECRET=<random-32-char-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different-32-char-string>
JWT_REFRESH_EXPIRES_IN=7d

# Storage
STORAGE_BUCKET=polycheck-proofs
STORAGE_ENDPOINT=https://...

# App
PORT=4000
NODE_ENV=development
```

Use `@nestjs/config` with a `ConfigService` wrapper for all env access. Never use `process.env.*` directly in modules.

---

## Main Bootstrap (`main.ts`)

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  app.useGlobalFilters(new AllExceptionsFilter())

  app.enableCors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })

  app.setGlobalPrefix('api')  // all routes: /api/...

  await app.listen(process.env.PORT ?? 4000)
}
bootstrap()
```

---

## PrismaService

The `PrismaService` wraps `PrismaClient` and is a global singleton:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }
}
```

Register as a global module so all other modules can inject it without importing `PrismaModule`.

---

## RedisService

Wraps an `ioredis` client:

```ts
@Injectable()
export class RedisService {
  private client: Redis

  constructor(private config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL'))
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  getClient(): Redis {
    return this.client
  }
}
```

---

## Auth Guard Setup

### JWT Strategy

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    })
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role, email: payload.email }
  }
}
```

### Roles Guard

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles) return true  // no role requirement = any authenticated user

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.includes(user.role)
  }
}
```

Apply both guards globally:
```ts
app.useGlobalGuards(
  new JwtAuthGuard(jwtService),
  new RolesGuard(reflector),
)
```

---

## Module Pattern

Every domain follows the same structure:

```ts
// sections.module.ts
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
```

```ts
// sections.controller.ts
@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectionsController {
  constructor(private sectionsService: SectionsService) {}

  @Get(':id')
  @Roles('teacher', 'student', 'super_admin')
  getSection(@Param('id') id: string, @Request() req) {
    return this.sectionsService.findOne(id, req.user)
  }
}
```

```ts
// sections.service.ts
@Injectable()
export class SectionsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string, user: JwtPayload) {
    const section = await this.prisma.section.findUnique({ where: { id } })
    if (!section) throw new NotFoundException('Section not found')
    if (user.role === 'teacher' && section.teacherId !== user.id) {
      throw new ForbiddenException()
    }
    return section
  }
}
```

---

## BullMQ Queue Setup

```ts
// In app.module.ts
BullModule.forRoot({
  connection: { url: process.env.REDIS_URL }
})

BullModule.registerQueue({ name: 'attendance-sync' })
```

```ts
// sync.processor.ts
@Processor('attendance-sync')
export class SyncProcessor {
  @Process()
  async processSync(job: Job<SyncPayload>) {
    // Per-record validation logic
    // See sync-plan.md for full steps
  }
}
```

---

## Cron Jobs (`@nestjs/schedule`)

Use `@Cron` decorators for periodic cleanup tasks:

```ts
@Cron('0 2 * * *')  // 2am daily
async expireSessionPermissions() {
  await this.prisma.sessionPermission.updateMany({
    where: { isActive: true, expiresAt: { lt: new Date() } },
    data: { isActive: false }
  })
}
```

---

## Error Handling Filter

Global exception filter that formats all errors to the standard shape:

```ts
{
  statusCode: 404,
  error: "Not Found",
  message: "Section not found"
}
```

Catches both NestJS `HttpException` instances and unexpected errors (log unexpected ones to error monitoring, return `500` to client).

---

## Monorepo Registration

Add backend to:

**`pnpm-workspace.yaml`**:
```yaml
packages:
  - 'frontend'
  - 'android'
  - 'backend'
  - 'shared'
```

**`turbo.json`** — add backend to the build pipeline:
```json
{
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

---

## Open Questions

- **Better Auth + NestJS JWT compatibility**: Better Auth issues JWTs for the Next.js frontend. The NestJS API needs to verify these same tokens. Options: (1) share the same JWT secret between Better Auth and NestJS, or (2) use Better Auth's session verification endpoint as a proxy check. Option 1 is simpler but requires secret sharing. Investigate Better Auth's JWT configuration API.
- **API prefix**: The plan uses `/api` as a global prefix. Confirm this matches the frontend's `api.ts` base URL.
- **Database seeding**: Define a seed script for initial data (super admin account, sample subjects). Use `prisma/seed.ts`.
- **HTTPS in dev**: Use a self-signed cert or `localhost.run` for mobile testing on physical devices, since Expo apps on real devices can't access `http://localhost`.
