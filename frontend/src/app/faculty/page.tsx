'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import type { AdminOverview, User, Section, Subject, CalendarEvent, DashboardOverview } from '@polycheck/shared'
import { formatTime } from '@polycheck/shared/utils'
import {
  activityOutcomeLabel,
  activityOutcomeTone,
  buildAccountSplits,
  formatActivityAction,
  formatHealthTimestamp,
  formatRelativeTime,
  summarizeAdminHealth,
} from '@/lib/admin-overview'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/sidebar'
import StatusBadge from '@/components/StatusBadge'
import { OfflineSyncPanel } from '@/components/OfflineSyncPanel'
import { LoadingSpinner } from '@/lib/hooks'

import {
  Activity,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Clock,
  Database,
  FileClock,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  ArrowRight,
  BarChart3,
} from 'lucide-react'

const campusDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const campusDate = (date = new Date()) => {
  const parts = new Map(campusDateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

// ============================================================================
// Teacher Dashboard Component
// ============================================================================

function TeacherDashboard({ user }: { user: User }) {
  const [sections, setSections] = useState<Section[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const todayStr = campusDate()
      try {
        const [allSects, subjects, nextOverview, evs] = await Promise.all([
          api.getSections(),
          api.getSubjects(),
          api.getDashboardOverview(),
          api.getCalendarEvents(user.id, todayStr, todayStr),
        ])
        if (cancelled) return
        setSections(allSects.filter((section) => section.teacherId === user.id))
        setAllSubjects(subjects)
        setOverview(nextOverview)
        setTodayEvents(evs.sort((a, b) => a.startTime.localeCompare(b.startTime)))
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load teacher dashboard data', error)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [user.id])

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>()
    for (const s of allSubjects) map.set(s.id, s)
    return map
  }, [allSubjects])

  const statCards = [
    { label: 'My Subjects', value: overview?.counts.subjects ?? 0, icon: BookOpen },
    { label: 'My Students', value: overview?.counts.students ?? 0, icon: Users },
    { label: 'Sessions Today', value: overview?.counts.sessionsToday ?? 0, icon: CalendarCheck },
    { label: 'Disputes', value: overview?.counts.pendingDisputes ?? 0, icon: ClipboardList },
  ]

  if (loading) return <LoadingSpinner className="min-h-[400px]" />

  // ── Empty state when teacher has no sections yet ──
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 max-w-md mx-auto">
          <div className="w-12 h-12 border-2 border-maroon dark:border-golden flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-6 h-6 text-maroon dark:text-golden" />
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">No Subjects Assigned Yet</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
            You have no sections assigned for this semester. Create a subject and add a section to get started with attendance tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/faculty/subjects/create">
              <Button className="rounded-none bg-maroon text-white hover:bg-maroon-dark font-bold uppercase tracking-widest text-[10px] h-9 px-6">
                Create Subject
              </Button>
            </Link>
            <Link href="/faculty/subjects">
              <Button variant="outline" className="rounded-none font-bold uppercase tracking-widest text-[10px] h-9 px-6">
                View All Subjects
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header Area */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-8">
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Faculty Dashboard
          </p>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">
            {user.fullName}
          </h1>
        </div>
        <div className="mt-4 md:mt-0">
          <Badge variant={'present'} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-none`}>
            Faculty Member
          </Badge>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-zinc-300 dark:border-zinc-800 mb-12 bg-background shadow-[0_4px_20px_rgba(123,17,19,0.035)] dark:shadow-none">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`p-6 border-zinc-300 dark:border-zinc-800 ${index !== 0 ? 'border-l' : ''} ${index > 1 ? 'border-t lg:border-t-0' : ''}`}>
              <div className="flex items-center gap-3 mb-4 text-zinc-400">
                <Icon className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
              </div>
              <p className="text-4xl font-heading font-bold text-foreground">
                {stat.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Today's Schedule Section */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 bg-maroon dark:bg-golden" />
          <h2 className="text-lg font-heading font-bold uppercase tracking-wider">Today&apos;s Schedule</h2>
        </div>
        {todayEvents.length === 0 ? (
          <div className="border border-zinc-300 dark:border-zinc-800 p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/20 shadow-[0_4px_20px_rgba(123,17,19,0.015)]">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No classes scheduled for today</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todayEvents.map((ev) => {
              const isActive = ev.status === 'active'
              const isCompleted = ev.status === 'completed'
              const isMoved = ev.status === 'moved'
               let borderStyle = "border-t-zinc-300 dark:border-t-zinc-800"
              if (isActive) borderStyle = "border-t-golden"
              else if (isCompleted) borderStyle = "border-t-zinc-400"
              else if (isMoved) borderStyle = "border-t-red-600"
              else borderStyle = "border-t-maroon"

              return (
                <Card key={ev.id} className={`rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 ${borderStyle} flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/50 shadow-none`}>
                  <CardContent className="p-6 flex flex-col justify-between h-full flex-1">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                        </span>
                        {isActive ? (
                          <Badge variant="present" className="rounded-none uppercase text-[9px] font-bold tracking-wider px-2 py-0.5">
                            Active
                          </Badge>
                        ) : isCompleted ? (
                          <Badge variant="outline" className="rounded-none uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 border-zinc-400 text-zinc-400">
                            Completed
                          </Badge>
                        ) : isMoved ? (
                          <Badge variant="absent" className="rounded-none uppercase text-[9px] font-bold tracking-wider px-2 py-0.5">
                            Moved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-none uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 text-zinc-500">
                            Scheduled
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-heading font-bold text-foreground mb-1 leading-snug line-clamp-1">{ev.subjectName}</h3>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-6">
                        Section {ev.sectionName} {ev.room ? `\\ ${ev.room}` : ''}
                      </p>
                    </div>
                    <div className="mt-auto pt-4 border-t border-dashed border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
                      {isActive ? (
                        <Link href={(() => {
                          return `/faculty/sessions/${ev.id}`
                        })()} className="w-full">
                          <Button className="w-full rounded-none bg-golden text-maroon hover:bg-golden/90 font-bold uppercase tracking-widest text-[10px] h-9 border border-golden">
                            View Active QR
                          </Button>
                        </Link>
                      ) : isCompleted ? (
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Class ended</span>
                      ) : isMoved ? (
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Rescheduled</span>
                      ) : (
                        <Link href={`/faculty/sessions/create?sectionId=${ev.sectionId}`} className="w-full">
                          <Button className="w-full rounded-none bg-maroon text-white hover:bg-maroon-dark font-bold uppercase tracking-widest text-[10px] h-9">
                            Activate Session
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* My Subjects List */}
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-maroon dark:text-golden" />
              My Subjects
            </CardTitle>
            <Link href="/faculty/subjects">
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-maroon dark:hover:text-golden">
                View All
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {sections.slice(0, 5).map((sec, i) => {
              const subj = subjectMap.get(sec.subjectId)
              return (
              <Link key={sec.id} href={`/faculty/sections/${sec.id}`} className={`flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${i !== 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors truncate">{subj?.name}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1"><span className="text-maroon dark:text-golden font-medium">{subj?.code}</span> \ Section {sec.section}</p>
                </div>
                <div className="text-right ml-4">
                  <span className="block text-xl font-heading font-bold text-foreground">{sec.studentCount}</span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Students</span>
                </div>
              </Link>
              )
            })}
            {sections.length === 0 && <div className="p-12 text-center"><p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No subjects assigned</p></div>}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-maroon dark:text-golden" />
              Recent Class Activity
            </CardTitle>
            <Link href="/faculty/attendance"><Button variant="ghost" size="sm" className="gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-maroon dark:hover:text-golden">Full Log <ArrowRight className="w-3 h-3" /></Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Student</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
              </tr></thead>
              <tbody>
                {overview?.recentAttendance.map((r) => (<tr key={r.id} className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4"><p className="font-bold text-foreground">{r.studentName}</p><p className="text-xs text-zinc-500">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></td>
                  <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">{r.subjectName}</td>
                  <td className="px-6 py-4 text-right"><StatusBadge status={r.status} /></td>
                </tr>))}
                {!overview?.recentAttendance.length && <tr><td colSpan={3} className="p-12 text-center text-sm font-bold text-zinc-400 uppercase tracking-widest">No recent activity</td></tr>}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}


// ============================================================================
// Super Admin Dashboard Component
// ============================================================================

const outcomeStyles: Record<string, string> = {
  success:
    'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300',
  danger: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  neutral:
    'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

const healthToneClasses: Record<string, string> = {
  operational: 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300',
  degraded: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  unavailable: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
}

function SuperAdminDashboard({ user }: { user: User }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const startedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setOverview(await api.getAdminOverview())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the administration overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // One request per mount even under React StrictMode's double-invoked
    // effects; the retry button still calls load() directly.
    if (startedRef.current) return
    startedRef.current = true
    void load()
  }, [load])

  if (loading && !overview) return <LoadingSpinner className="min-h-[400px]" />

  if (error && !overview) {
    return (
      <div
        role="alert"
        className="border border-red-300 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30"
      >
        <p className="text-sm font-bold uppercase tracking-widest text-red-700 dark:text-red-300">
          The administration overview couldn’t load
        </p>
        <p className="mt-2 text-sm text-red-700/80 dark:text-red-300/80">{error}</p>
        <Button className="mt-5" onClick={() => void load()}>
          Try Again
        </Button>
      </div>
    )
  }

  const counts = overview?.counts
  const health = overview ? summarizeAdminHealth(overview.health) : null
  const accountSplits = counts ? buildAccountSplits(counts) : []
  const recentActivity = overview?.recentActivity ?? []

  const statCards = [
    {
      label: 'Active Faculty',
      value: counts?.activeFaculty ?? 0,
      caption: `${counts?.disabledFaculty ?? 0} disabled`,
      icon: UserCheck,
    },
    {
      label: 'Active Students',
      value: counts?.activeStudents ?? 0,
      caption: `${counts?.disabledStudents ?? 0} disabled`,
      icon: Users,
    },
    {
      label: 'Active Sessions Now',
      value: counts?.activeSessions ?? 0,
      caption: 'Live class sessions',
      icon: Activity,
    },
    {
      label: 'Pending Disputes',
      value: counts?.pendingDisputes ?? 0,
      caption: 'Awaiting faculty review',
      icon: ClipboardList,
    },
  ]

  const quickActions = [
    { label: 'Manage Users', href: '/faculty/users', icon: Users, description: 'Edit accounts, roles, and access.' },
    { label: 'Reports', href: '/faculty/reports', icon: BarChart3, description: 'Institution-wide attendance summaries.' },
    { label: 'Audit Log', href: '/faculty/audit-logs', icon: FileClock, description: 'Trace administrative changes.' },
    { label: 'Settings', href: '/faculty/settings', icon: Settings, description: 'Institution-wide defaults.' },
  ]

  return (
    <>
      {error ? (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      ) : null}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-8">
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            System Administration
          </p>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">
            {user.fullName}
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {overview?.scope === 'department'
              ? `${overview.department ?? 'Department'} scope`
              : 'Institution-wide accounts, audit, and operations.'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col items-start gap-2 md:items-end">
          <Badge variant='default' className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-none bg-golden text-maroon hover:bg-golden`}>
            Super Administrator
          </Badge>
          <Link
            href="/faculty/server-status"
            className="text-[10px] font-bold uppercase tracking-widest text-maroon hover:underline dark:text-golden"
          >
            View server status
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-zinc-300 dark:border-zinc-800 mb-12 bg-background shadow-[0_4px_20px_rgba(123,17,19,0.035)] dark:shadow-none">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`p-6 border-zinc-300 dark:border-zinc-800 ${index !== 0 ? 'border-l' : ''} ${index > 1 ? 'border-t lg:border-t-0' : ''}`}>
              <div className="flex items-center gap-3 mb-4 text-zinc-400">
                <Icon className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
              </div>
              <p className="text-4xl font-heading font-bold text-foreground">{stat.value}</p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-400">{stat.caption}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-8 mb-12 lg:grid-cols-5">
        {/* Accounts panel */}
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-maroon dark:text-golden" />
              Accounts
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-maroon dark:hover:text-golden" asChild>
              <Link href="/faculty/users">
                Manage
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {accountSplits.map((split) => (
              <div key={split.key}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">{split.label}</p>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400">
                      {split.active.toLocaleString()} active · {split.inactive.toLocaleString()} disabled
                    </p>
                  </div>
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {split.activePercent}% active
                  </p>
                </div>
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800"
                  role="img"
                  aria-label={`${split.label}: ${split.active} active, ${split.inactive} disabled`}
                >
                  <div
                    className="h-full bg-maroon dark:bg-golden"
                    style={{ width: `${split.activePercent}%` }}
                  />
                </div>
              </div>
            ))}
            {accountSplits.length === 0 ? (
              <p className="text-sm text-zinc-500">Account counts are unavailable right now.</p>
            ) : null}
          </CardContent>
        </Card>

        {/* Recent administrative activity */}
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-maroon dark:text-golden" />
              Recent administrative activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-maroon dark:hover:text-golden" asChild>
              <Link href="/faculty/audit-logs">
                Full log
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  No administrative activity yet
                </p>
              </div>
            ) : (
              <ul>
                {recentActivity.slice(0, 6).map((entry, index) => (
                  <li
                    key={entry.id}
                    className={`flex items-start justify-between gap-4 p-4 ${index !== 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {formatActivityAction(entry.action)}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {entry.actorName} · {entry.actorRole.replace('_', ' ')} · {formatRelativeTime(entry.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={outcomeStyles[activityOutcomeTone(entry.outcome)]}
                    >
                      {activityOutcomeLabel(entry.outcome)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System health + quick actions */}
      <div className="grid gap-8 lg:grid-cols-2 mb-12">
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Database className="w-4 h-4 text-maroon dark:text-golden" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {health ? (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center border ${healthToneClasses[health.state]}`}
                    aria-hidden="true"
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{health.label}</p>
                    <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
                      {health.statusLine}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 space-y-2">
                  {health.services.map((service) => (
                    <li key={service.label} className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-widest text-zinc-500">{service.label}</span>
                      <span className={service.ok ? 'font-bold text-green-700 dark:text-green-400' : 'font-bold text-red-700 dark:text-red-400'}>
                        {service.ok ? 'Connected' : 'Unavailable'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-dashed border-zinc-200 pt-4 text-[10px] uppercase tracking-widest text-zinc-400 dark:border-zinc-800">
                  Checked {overview ? formatHealthTimestamp(overview.health.timestamp) : '—'}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Health data is unavailable.</p>
            )}
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 bg-maroon dark:bg-golden" />
            <h2 className="text-lg font-heading font-bold uppercase tracking-wider">Administrative Controls</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group block border border-zinc-300 p-5 transition-colors hover:border-maroon hover:bg-maroon dark:border-zinc-800 dark:hover:border-golden dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-2 text-maroon dark:text-golden group-hover:text-white dark:group-hover:text-golden">
                    <Icon className="h-4 w-4" />
                    <h3 className="text-sm font-heading font-bold">{action.label}</h3>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 group-hover:text-white/80 dark:group-hover:text-zinc-400">
                    {action.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function FacultyPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fn = async () => {
      let cu = api.getCurrentUser()
      if (!cu) {
        cu = await api.restoreSession()
      }
      if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
        router.push('/login/faculty')
        return
      }
      setUser(cu)
      setLoading(false)
    }
    fn()
  }, [router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </div>
  )
  if (!user) return null
  
  const isSuper = user.role === 'super_admin'

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 md:p-12 max-w-6xl mx-auto">
          {isSuper ? (
            <SuperAdminDashboard user={user} />
          ) : (
            <>
              <OfflineSyncPanel className="mb-6" />
              <TeacherDashboard user={user} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
