import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger as PinoLogger } from 'nestjs-pino'
import helmet from 'helmet'
import type { Server } from 'http'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'
import { RedisIoAdapter } from './infrastructure/redis-io.adapter'
import { validateEnv } from './common/config/env-validation'

async function bootstrap() {
  const env = validateEnv(process.env)

  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false })

  app.useLogger(app.get(PinoLogger))

  if (env.TRUST_PROXY) app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY_HOPS)
  const bodyLimit = `${Math.ceil((env.MAX_PROOF_BYTES * 4) / 3) + 100_000}b`
  app.use(json({ limit: bodyLimit }))
  app.use(urlencoded({ extended: true, limit: bodyLimit }))

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

  const socketAdapter = new RedisIoAdapter(app)
  await socketAdapter.connect(env.REDIS_URL || undefined, env.NODE_ENV === 'production')
  app.useWebSocketAdapter(socketAdapter)
  app.enableShutdownHooks()

  const origins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:8081']
  if (env.FRONTEND_URL && !origins.includes(env.FRONTEND_URL)) origins.push(env.FRONTEND_URL)

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
  })

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  if (env.NODE_ENV !== 'production' || env.ENABLE_API_DOCS === true) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Polycheck API')
      .setDescription('Unified web and mobile attendance management system for PUP')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document)
  }

  const port = env.PORT
  await app.listen(port)
  new Logger('Bootstrap').log(`Backend running on http://localhost:${port}`)

  const server = app.getHttpServer() as Server
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    new Logger('Bootstrap').log(`Received ${signal}, draining connections…`)
    const forceExit = setTimeout(() => {
      new Logger('Bootstrap').error('Graceful shutdown timed out')
      process.exit(1)
    }, 30_000)
    forceExit.unref()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    new Logger('Bootstrap').log('HTTP server closed')
    await app.close()
    clearTimeout(forceExit)
    new Logger('Bootstrap').log('Application fully shut down')
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

bootstrap()
