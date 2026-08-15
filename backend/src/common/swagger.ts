import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { EnvConfig } from './config/env-validation'
import { swaggerAccessMiddleware } from './middleware/swagger-access.middleware'

export const SWAGGER_PATHS = ['/api/docs', '/api/docs-json', '/api/docs-yaml'] as const

export const shouldRegisterApiDocs = (env: Pick<EnvConfig, 'NODE_ENV' | 'ENABLE_API_DOCS'>) =>
  env.ENABLE_API_DOCS ?? env.NODE_ENV !== 'production'

export const registerApiDocs = (
  app: INestApplication,
  env: Pick<EnvConfig, 'NODE_ENV' | 'ENABLE_API_DOCS' | 'METRICS_TOKEN'>,
) => {
  if (!shouldRegisterApiDocs(env)) return false

  if (env.NODE_ENV === 'production') {
    if (!env.METRICS_TOKEN) throw new Error('METRICS_TOKEN is required when production API docs are enabled')
    app.use(SWAGGER_PATHS, swaggerAccessMiddleware(env.METRICS_TOKEN))
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Polycheck API')
    .setDescription('Unified web and mobile attendance management system for PUP')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: env.NODE_ENV !== 'production' },
    customSiteTitle: 'Polycheck API Docs',
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  })
  return true
}
