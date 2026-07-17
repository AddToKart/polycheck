import type { Request } from 'express'
import type { RequestUser } from '../../auth/strategies/jwt.strategy'

export interface AuthenticatedRequest extends Request {
  user: RequestUser
}
