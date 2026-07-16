'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Session, Subject, Section } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function SessionsContent() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [activating, setActivating] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    const fetchData = async () => {
      const [sessions, subjects, sections] = await Promise.all([
        api.getSessions(),
        api.getSubjects(),
        api.getSections(),
      ])
      setSessions(sessions)
      setAllSubjects(subjects)
      setAllSections(sections)
    }
    fetchData()
  }, [router])

  if (!user) return null

  type GroupedSessions = Record<string, Session[]>
  const grouped = useMemo(() =>
    sessions.reduce<Record<string, { subjectId: string; sessions: GroupedSessions }>>((acc, s) => {
      const section = allSections.find(sec => sec.id === s.sectionId)
      const subject = section ? allSubjects.find(sub => sub.id === section.subjectId) : undefined
      const subjectName = subject?.name ?? s.subjectName
      const subjectId = subject?.id ?? ''
      if (!acc[subjectName]) acc[subjectName] = { subjectId, sessions: {} }
      if (!acc[subjectName].sessions[s.sectionId]) acc[subjectName].sessions[s.sectionId] = []
      acc[subjectName].sessions[s.sectionId].push(s)
      return acc
    }, {}),
    [sessions, allSubjects, allSections]
  )

  const getSectionLabel = (sectionId: string) => {
    const sec = allSections.find(s => s.id === sectionId)
    if (!sec) return 'Unknown Section'
    return `Section ${sec.section}${sec.room ? ` \u2014 ${sec.room}` : ''}`
  }

  const handleActivate = (sessionId: string) => {
    router.push(`/faculty/sessions/${sessionId}`)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
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

          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([subjectName, group]) => {
            const subject = allSubjects.find(s => s.id === group.subjectId)
            return (
            <Card key={subjectName} className="mb-8 border-t-4 border-t-maroon dark:border-t-golden">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">{subjectName}</CardTitle>
                {subject && (
                  <Link href={`/faculty/subjects/${subject.id}/sessions`} className="text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden hover:underline flex items-center gap-1">
                    All Sessions <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </CardHeader>
              {Object.entries(group.sessions).map(([sectionId, sectionSessions]) => (
                <div key={sectionId}>
                  <div className="px-6 py-2 bg-zinc-100/90 dark:bg-zinc-800/70 border-b border-t border-zinc-300/60 dark:border-zinc-700">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      {getSectionLabel(sectionId)}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                        <th className="text-left px-6 py-3 font-bold text-zinc-500 dark:text-zinc-400">Date</th>
                        <th className="text-left px-6 py-3 font-bold text-zinc-500 dark:text-zinc-400">Time</th>
                        <th className="text-left px-6 py-3 font-bold text-zinc-500 dark:text-zinc-400">Room</th>
                        <th className="text-left px-6 py-3 font-bold text-zinc-500 dark:text-zinc-400">Status</th>
                        <th className="text-right px-6 py-3 font-bold text-zinc-500 dark:text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionSessions.map((session) => (
                        <tr
                          key={session.id}
                          className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
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
                </div>
              ))}
            </Card>
            )
          })}
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
