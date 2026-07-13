import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { RedisIoAdapter } from './infrastructure/redis-io.adapter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const socketAdapter = new RedisIoAdapter(app)
  await socketAdapter.connect(process.env.REDIS_URL)
  app.useWebSocketAdapter(socketAdapter)
  app.enableShutdownHooks()

  const frontendUrl = process.env.FRONTEND_URL
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:8081', frontendUrl].filter((s): s is string => !!s),
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

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}`)
}
bootstrap()
