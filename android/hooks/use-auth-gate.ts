import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import type { User } from '@polycheck/shared'
import { api } from '../services/api-client'

export type AllowedRole = User['role']

/**
 * Shared auth gate for screens.
 *
 * The root layout (`app/_layout.tsx`) is the single place that routes by
 * auth group; this hook covers the role-level gates the root layout cannot
 * express (e.g. a screen inside the faculty group that only super admins may
 * open). It returns the current user when allowed, otherwise redirects:
 *
 * - not logged in → '/' (login)
 * - temporary password → '/change-password' (blocking gate)
 * - wrong role    → the user's own dashboard group
 * - failed `allow` predicate (designation) → the user's own dashboard group
 *
 * Screens must call it unconditionally at the top and guard their data
 * loading with `if (!currentUser) return`. Pass a stable (module-level)
 * predicate — e.g. the shared `canAccessItOperations` helper.
 */
export function useAuthGate(roles: AllowedRole[] = [], allow?: (user: User) => boolean): User | null {
  const router = useRouter()
  const user = api.getCurrentUser()
  const rolesKey = roles.join(',')

  useEffect(() => {
    const allowedRoles = rolesKey ? rolesKey.split(',') : []
    if (!user) {
      router.replace('/')
    } else if (user.mustChangePassword) {
      router.replace('/change-password')
    } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace(user.role === 'student' ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
    } else if (allow && !allow(user)) {
      router.replace(user.role === 'student' ? '/(tabs)/dashboard' : '/(faculty)/dashboard')
    }
  }, [user, rolesKey, router, allow])

  return user
}
