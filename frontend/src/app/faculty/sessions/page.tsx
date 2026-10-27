'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Session, Subject, Section } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FilterBar, FilterChipGroup, FilterDateRange, FilterSelect } from '@/components/FilterBar'
import { useUrlFilters } from '@/lib/hooks/use-url-filters'
import { deriveSessionStatus, SESSION_STATUS_LABELS } from '@/lib/session-status'

const FILTER_SCHEMA = {
  subjectId: { defaultValue: '' },
  sectionId: { defaultValue: '' },
  status: { defaultValue: '', allowed: ['active', 'scheduled', 'completed', 'rescheduled'] },
  from: { defaultValue: '' },
  to: { defaultValue: '' },
} as const

const STATUS_BADGE_CLASSES: Record<ReturnType<typeof deriveSessionStatus>, string> = {
  active: 'bg-golden text-maroon-dark',
  scheduled: 'border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
  completed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  rescheduled: 'bg-maroon-dark text-golden border border-golden',
}

function SessionsContent() {
  const router = useRouter()
  const filters = useUrlFilters(FILTER_SCHEMA)
  const { subjectId, sectionId, status, from, to } = filters.values
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    const fetchData = async () => {
      try {
        const [sessions, subjects, sections] = await Promise.all([
          api.getSessions(),
          api.getSubjects(),
          api.getSections(),
        ])
        setSessions(sessions)
        setAllSubjects(subjects)
        setAllSections(sections)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Sessions could not load.')
      }
    }
    void fetchData()
  }, [router])

  const sectionMap = useMemo(() => new Map(allSections.map((section) => [section.id, section])), [allSections])

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const section = sectionMap.get(session.sectionId)
        if (subjectId && section?.subjectId !== subjectId) return false
        if (sectionId && session.sectionId !== sectionId) return false
        if (status && deriveSessionStatus(session) !== status) return false
        if (from && session.date < from) return false
        if (to && session.date > to) return false
        return true
      }),
    [sessions, sectionMap, subjectId, sectionId, status, from, to],
  )

  type GroupedSessions = Record<string, Session[]>
  const grouped = useMemo(
    () =>
      filteredSessions.reduce<Record<string, { subjectId: string; sessions: GroupedSessions }>>((acc, s) => {
        const section = sectionMap.get(s.sectionId)
        const subject = section ? allSubjects.find((sub) => sub.id === section.subjectId) : undefined
        const subjectName = subject?.name ?? s.subjectName
        const subjectId = subject?.id ?? ''
        if (!acc[subjectName]) acc[subjectName] = { subjectId, sessions: {} }
        if (!acc[subjectName].sessions[s.sectionId]) acc[subjectName].sessions[s.sectionId] = []
        acc[subjectName].sessions[s.sectionId].push(s)
        return acc
      }, {}),
    [filteredSessions, allSubjects, sectionMap],
  )

  const subjectOptions = useMemo(
    () => allSubjects.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` })),
    [allSubjects],
  )

  const sectionOptions = useMemo(
    () =>
      allSections
        .filter((section) => !subjectId || section.subjectId === subjectId)
        .map((section) => {
          const subject = allSubjects.find((item) => item.id === section.subjectId)
          return {
            value: section.id,
            label: `Section ${section.section}${subject ? ` · ${subject.code}` : ''}`,
          }
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    [allSections, allSubjects, subjectId],
  )

  const getSectionLabel = (targetSectionId: string) => {
    const sec = sectionMap.get(targetSectionId)
    if (!sec) return 'Unknown Section'
    return `Section ${sec.section}${sec.room ? ` \u2014 ${sec.room}` : ''}`
  }

  const handleSubjectChange = (value: string) => {
    filters.setFilters({ subjectId: value, sectionId: '' })
  }

  const handleActivate = (sessionId: string) => {
    router.push(`/faculty/sessions/${sessionId}`)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">Sessions</h1>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                {filteredSessions.length === sessions.length
                  ? `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`
                  : `${filteredSessions.length} of ${sessions.length} sessions`}
              </p>
            </div>
            {user.role === 'teacher' && (
              <Button asChild>
                <Link href="/faculty/sessions/create">
                  <Plus className="w-4 h-4" />
                  New Session
                </Link>
              </Button>
            )}
          </div>

          <FilterBar
            className="mb-8"
            onClear={filters.clearAll}
            activeCount={filters.activeCount}
            label="Session filters"
          >
            <FilterSelect
              id="session-subject"
              label="Subject"
              value={subjectId}
              onChange={handleSubjectChange}
              options={subjectOptions}
              allLabel="All subjects"
              className="min-w-[12rem] flex-1"
            />
            <FilterSelect
              id="session-section"
              label="Section"
              value={sectionId}
              onChange={(value) => filters.setFilter('sectionId', value)}
              options={sectionOptions}
              allLabel="All sections"
              className="min-w-[12rem] flex-1"
            />
            <FilterChipGroup
              label="Status"
              value={status}
              onChange={(value) => filters.setFilter('status', value)}
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
                { value: 'rescheduled', label: 'Rescheduled' },
              ]}
              className="min-w-[14rem] flex-1"
            />
            <FilterDateRange
              idPrefix="session"
              from={from}
              to={to}
              onFromChange={(value) => filters.setFilter('from', value)}
              onToChange={(value) => filters.setFilter('to', value)}
            />
          </FilterBar>

          {error ? (
            <div role="alert" className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subjectName, group]) => {
              const subject = allSubjects.find((s) => s.id === group.subjectId)
              return (
                <Card key={subjectName} className="mb-8 border-t-4 border-t-maroon dark:border-t-golden">
                  <CardHeader className="flex-row items-center justify-between pb-3">
                    <CardTitle className="text-lg">{subjectName}</CardTitle>
                    {subject && (
                      <Link
                        href={`/faculty/subjects/${subject.id}/sessions`}
                        className="text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden hover:underline flex items-center gap-1"
                      >
                        All Sessions <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </CardHeader>
                  {Object.entries(group.sessions).map(([targetSectionId, sectionSessions]) => (
                    <div key={targetSectionId}>
                      <div className="px-6 py-2 bg-zinc-100/90 dark:bg-zinc-800/70 border-b border-t border-zinc-300/60 dark:border-zinc-700">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          {getSectionLabel(targetSectionId)}
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
                          {sectionSessions.map((session) => {
                            const sessionStatus = deriveSessionStatus(session)
                            return (
                              <tr
                                key={session.id}
                                className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 dark:focus-visible:ring-golden/40"
                                onClick={() => router.push(`/faculty/sessions/${session.id}`)}
                                tabIndex={0}
                                aria-label={`Open session on ${session.date}`}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    router.push(`/faculty/sessions/${session.id}`)
                                  }
                                }}
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
                                  <Badge className={STATUS_BADGE_CLASSES[sessionStatus]}>
                                    {SESSION_STATUS_LABELS[sessionStatus]}
                                  </Badge>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  {user.role === 'teacher' && !session.isActive && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleActivate(session.id)
                                      }}
                                    >
                                      Activate
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </Card>
              )
            })}

          {sessions.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
              <p className="text-lg mb-2">No sessions found</p>
              <p className="text-sm">Sessions will appear here once subjects have scheduled meetings.</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
              <p className="text-lg font-heading font-bold text-foreground">No sessions match these filters</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Adjust the subject, section, status, or dates.</p>
              <Button variant="outline" className="mt-4" onClick={filters.clearAll}>
                Clear filters
              </Button>
            </div>
          ) : null}
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

