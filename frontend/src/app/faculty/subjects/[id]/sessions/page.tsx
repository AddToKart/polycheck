'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowLeft, CalendarDays } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject, Section, Session } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function SubjectSessionsContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [subjectSections, setSubjectSections] = useState<Section[]>([])
  const [sectionFilter, setSectionFilter] = useState(searchParams.get('sectionId') || '')
  const [dayFilter, setDayFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activating, setActivating] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!id) return
    const subj = api.getSubject(id)
    if (!subj) { router.push('/faculty/subjects'); return }
    setSubject(subj)
    let secs = api.getSections().filter((s) => s.subjectId === id)
    if (user && user.role === 'teacher') {
      secs = secs.filter((s) => s.teacherId === user.id)
    }
    setSubjectSections(secs)
  }, [id, router, user])

  const allSessions = useMemo(() => {
    return api.getSessions()
  }, [])

  const filtered = useMemo(() => {
    const sectionIds = subjectSections.map((sec) => sec.id)
    if (sectionIds.length === 0) return []

    let result = allSessions.filter((s) => sectionIds.includes(s.sectionId))

    if (sectionFilter) {
      result = result.filter((s) => s.sectionId === sectionFilter)
    }
    if (dayFilter) {
      result = result.filter((s) => DAYS[new Date(s.date).getDay()] === dayFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.date.includes(q) || (s.room && s.room.toLowerCase().includes(q)))
    }
    return result
  }, [allSessions, subjectSections, sectionFilter, dayFilter, searchQuery])

  const groupedBySection = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of filtered) {
      const arr = map.get(s.sectionId) || []
      arr.push(s)
      map.set(s.sectionId, arr)
    }
    return map
  }, [filtered])

  const getSectionLabel = (sec: Section) =>
    `Section ${sec.section}${sec.room ? ` \u2014 ${sec.room}` : ''}`

  const handleActivate = (sessionId: string) => {
    setActivating(sessionId)
    router.push(`/faculty/sessions/${sessionId}`)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  if (!user || !subject) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref={`/faculty/subjects/${id}`} backLabel="Back to Subject" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/faculty/subjects/${id}`} className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subject
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{subject.name}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{subject.code} &middot; {filtered.length} session{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Day filter */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mr-2">Day</span>
                  <Button
                    key="all"
                    variant={dayFilter === '' ? 'default' : 'outline'}
                    size="sm"
                    className="text-[10px] font-bold uppercase tracking-widest rounded-none h-8"
                    onClick={() => setDayFilter('')}
                  >
                    All
                  </Button>
                  {DAYS.map((day) => (
                    <Button
                      key={day}
                      variant={dayFilter === day ? 'default' : 'outline'}
                      size="sm"
                      className="text-[10px] font-bold uppercase tracking-widest rounded-none h-8"
                      onClick={() => setDayFilter(day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>

                {/* Section filter + Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                    >
                      <option value="">All Sections</option>
                      {subjectSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {getSectionLabel(sec)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      placeholder="Search by date or room..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions by Section */}
          {subjectSections.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
              <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO SECTIONS FOUND</p>
              <p className="text-xs uppercase tracking-widest text-zinc-500">This subject has no sections yet.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
              <p className="text-xl font-heading font-bold text-zinc-400 mb-2">No sessions match your filters</p>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Try adjusting the filters above.</p>
            </div>
          ) : (
            Array.from(groupedBySection.entries()).map(([sectionId, sectionSessions]) => {
              const sec = subjectSections.find((s) => s.id === sectionId)
              if (!sec) return null
              return (
                <Card key={sectionId} className="mb-6">
                  <CardHeader className="flex-row items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-maroon dark:text-golden" />
                      {getSectionLabel(sec)}
                    </CardTitle>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {sectionSessions.length} session{sectionSessions.length !== 1 ? 's' : ''}
                    </span>
                  </CardHeader>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                        <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Date</th>
                        <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Time</th>
                        <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Room</th>
                        <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                        <th className="text-right px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionSessions.map((session) => (
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
                </Card>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

export default function SubjectSessionsPage() {
  return (
    <Suspense fallback={null}>
      <SubjectSessionsContent />
    </Suspense>
  )
}
