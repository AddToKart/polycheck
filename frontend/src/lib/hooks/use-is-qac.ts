'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

// Remembered between pages so the menu item does not flicker in on every navigation.
const known = new Map<string, boolean>()

/** Whether a student is a Quality Assurance Coordinator in any section. */
export function useIsQac(userId: string, isStudent: boolean): boolean {
  const [isQac, setIsQac] = useState(() => (isStudent ? (known.get(userId) ?? false) : false))

  useEffect(() => {
    if (!isStudent || !userId) return
    let active = true
    // A failed lookup only hides the menu item; every upload is still checked by the server.
    Promise.resolve()
      .then(() => api.getStudentRoles(userId))
      .then((roles) => {
        const qac = roles.some((role) => role.role === 'qac')
        known.set(userId, qac)
        if (active) setIsQac(qac)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [userId, isStudent])

  return isStudent && isQac
}
