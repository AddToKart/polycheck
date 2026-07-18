'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { User } from '@polycheck/shared'

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let active = true
    void api.restoreSession().then((cu) => {
      if (!active) return
      if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
        router.replace('/')
        return
      }
      setUser(cu)
    })
    return () => { active = false }
  }, [router])

  if (!user) return null

  return <>{children}</>
}
