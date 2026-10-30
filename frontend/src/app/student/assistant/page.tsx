'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { AssistantChat } from '@/components/Assistant/AssistantChat'
import { STUDENT_STARTER_PROMPTS } from '@/components/Assistant/suggestions'
import { api } from '@/lib/api-client'
import { LoadingSpinner } from '@/lib/hooks'

export default function StudentAssistantPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let current = api.getCurrentUser()
      if (!current) current = await api.restoreSession().catch(() => null)
      if (cancelled) return
      if (!current || current.role !== 'student') {
        router.replace('/student/dashboard')
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
    <div className="flex min-h-screen flex-col bg-background selection:bg-golden selection:text-maroon md:h-screen md:flex-row md:overflow-hidden">
      <Sidebar
        user={user}
        onLogout={() => {
          void api.logout()
          router.push('/')
        }}
      />
      <main className="flex-1 md:h-dvh md:overflow-hidden">
        <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl flex-col px-4 py-6 md:h-full md:px-8 md:py-8">
          <AssistantChat
            geometry="focus"
            className="min-h-0 flex-1"
            suggestions={STUDENT_STARTER_PROMPTS}
          />
        </div>
      </main>
    </div>
  )
}
