import type { Request } from 'express'
import type { RequestUser } from '../../auth/authenticated-principal'

export interface AuthenticatedRequest extends Request {
  user: RequestUser
}
