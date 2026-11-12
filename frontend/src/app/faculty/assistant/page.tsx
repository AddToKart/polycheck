'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { AssistantChat } from '@/components/Assistant/AssistantChat'
import { api, requestUserLogout } from '@/lib/api-client'
import { LoadingSpinner } from '@/lib/hooks'

export default function FacultyAssistantPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let current = api.getCurrentUser()
      if (!current) current = await api.restoreSession().catch(() => null)
      if (cancelled) return
      if (!current || (current.role !== 'teacher' && current.role !== 'super_admin')) {
        router.replace('/faculty')
        return
      }
      setUser(current)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background selection:bg-golden selection:text-maroon md:h-screen md:flex-row">
      <Sidebar
        user={user}
        onLogout={() => {
          void requestUserLogout().then((outcome) => {
            if (outcome.loggedOut) router.push('/')
          })
        }}
      />
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col px-4 py-6 md:px-8 md:py-8">
          <AssistantChat geometry="focus" className="min-h-0 flex-1" />
        </div>
      </main>
    </div>
  )
}
