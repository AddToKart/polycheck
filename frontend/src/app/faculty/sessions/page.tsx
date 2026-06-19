'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Session } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function SessionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subjectFilter = searchParams.get('subjectId')
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activating, setActivating] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    let allSessions = api.getSessions()
    if (subjectFilter) {
      allSessions = allSessions.filter((s) => s.subjectId === subjectFilter)
    }
    setSessions(allSessions)
  }, [router, subjectFilter])

  if (!user) return null

  const grouped = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    const key = s.subjectName
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const handleActivate = (sessionId: string) => {
    setActivating(sessionId)
    api.activateSession(sessionId)
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, isActive: true } : s))
    )
    setTimeout(() => setActivating(''), 500)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">Sessions</h1>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button asChild>
              <Link href="/faculty/sessions/create">
                <Plus className="w-4 h-4" />
                New Session
              </Link>
            </Button>
          </div>

          {Object.entries(grouped).map(([subjectName, subjectSessions]) => (
            <Card key={subjectName} className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">{subjectName}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Date</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Time</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Room</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Students</th>
                      <th className="text-right px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/faculty/sessions/${session.id}`)}
                      >
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100">
                          {new Date(session.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                          {session.startTime} - {session.endTime}
                        </td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                          {session.room || '\u2014'}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={session.isActive ? 'active' : 'inactive'}>
                            {session.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">&mdash;</td>
                        <td className="px-6 py-3 text-right">
                          {!session.isActive && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleActivate(session.id)
                              }}
                              disabled={activating === session.id}
                            >
                              {activating === session.id ? '...' : 'Activate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
              <p className="text-lg mb-2">No sessions found</p>
              <p className="text-sm">Sessions will appear here once subjects have scheduled meetings.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsContent />
    </Suspense>
  )
}
