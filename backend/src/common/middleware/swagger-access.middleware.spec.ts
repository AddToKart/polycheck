import { swaggerAccessMiddleware } from './swagger-access.middleware'

describe('swaggerAccessMiddleware', () => {
  const token = 'a-production-docs-token'

  it('accepts only an exact bearer token', () => {
    const next = jest.fn()
    const response = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }

    swaggerAccessMiddleware(token)(
      { headers: { authorization: `Bearer ${token}` }, query: {} } as never,
      response as never,
      next,
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(response.status).not.toHaveBeenCalled()
  })

  it('rejects query-string tokens and missing bearer tokens', () => {
    const next = jest.fn()
    const response = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }

    swaggerAccessMiddleware(token)({ headers: {}, query: { token } } as never, response as never, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(401)
  })
})
