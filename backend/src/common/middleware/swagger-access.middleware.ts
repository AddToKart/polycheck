import { timingSafeEqual } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

const matchesToken = (authorization: string | undefined, expectedToken: string) => {
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
  const suppliedBytes = Buffer.from(supplied)
  const expectedBytes = Buffer.from(expectedToken)
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
}

export const swaggerAccessMiddleware =
  (token: string) => (request: Request, response: Response, next: NextFunction) => {
    if (matchesToken(request.headers.authorization, token)) return next()
    response.setHeader('WWW-Authenticate', 'Bearer realm="swagger"')
    return response.status(401).json({ message: 'Access to API docs requires authentication' })
  }
