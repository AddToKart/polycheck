import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
