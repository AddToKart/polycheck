import type { UserRole } from '@prisma/client'

export interface RequestUser {
  id: string
  role: UserRole
  email?: string | null
  studentId?: string | null
  department?: string | null
  scope?: string | null
  authSessionId?: string
}
