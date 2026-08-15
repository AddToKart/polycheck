import { SwaggerModule } from '@nestjs/swagger'
import { registerApiDocs, shouldRegisterApiDocs, SWAGGER_PATHS } from './swagger'

describe('API docs registration', () => {
  afterEach(() => jest.restoreAllMocks())

  it('does not register Swagger in production unless explicitly enabled', () => {
    const app = { use: jest.fn() }
    const createDocument = jest.spyOn(SwaggerModule, 'createDocument')
    const setup = jest.spyOn(SwaggerModule, 'setup')

    expect(shouldRegisterApiDocs({ NODE_ENV: 'production', ENABLE_API_DOCS: undefined })).toBe(false)
    expect(registerApiDocs(app as never, { NODE_ENV: 'production', ENABLE_API_DOCS: undefined })).toBe(false)
    expect(app.use).not.toHaveBeenCalled()
    expect(createDocument).not.toHaveBeenCalled()
    expect(setup).not.toHaveBeenCalled()
  })

  it('keeps API document generation enabled by default outside production', () => {
    const app = { use: jest.fn() }
    jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({} as never)
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation()

    expect(registerApiDocs(app as never, { NODE_ENV: 'test', ENABLE_API_DOCS: undefined })).toBe(true)
    expect(app.use).not.toHaveBeenCalled()
    expect(setup).toHaveBeenCalledWith(
      'api/docs',
      app,
      expect.anything(),
      expect.objectContaining({ jsonDocumentUrl: 'api/docs-json', yamlDocumentUrl: 'api/docs-yaml' }),
    )
  })

  it('protects the production UI, JSON, and YAML routes before registering Swagger', () => {
    const app = { use: jest.fn() }
    const createDocument = jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({} as never)
    jest.spyOn(SwaggerModule, 'setup').mockImplementation()

    expect(
      registerApiDocs(app as never, {
        NODE_ENV: 'production',
        ENABLE_API_DOCS: true,
        METRICS_TOKEN: 'm'.repeat(32),
      }),
    ).toBe(true)

    expect(app.use).toHaveBeenCalledWith(SWAGGER_PATHS, expect.any(Function))
    expect(app.use.mock.invocationCallOrder[0]).toBeLessThan(createDocument.mock.invocationCallOrder[0])
  })

  it('honors an explicit disable outside production', () => {
    expect(shouldRegisterApiDocs({ NODE_ENV: 'development', ENABLE_API_DOCS: false })).toBe(false)
  })
})
