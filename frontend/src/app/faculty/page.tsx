'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/mock-api'
import type { User, Section, Session, AttendanceRecord } from '@polycheck/shared'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/sidebar'
import StatusBadge from '@/components/StatusBadge'
import { LoadingSpinner } from '@/lib/hooks'

import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Users,
  ArrowRight,
  Clock,
  ShieldCheck,
  BarChart3
} from 'lucide-react'

// ============================================================================
// Teacher Dashboard Component
// ============================================================================

function TeacherDashboard({ user }: { user: User }) {
  const [sections, setSections] = useState<Section[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const teacherSections = api.getSections().filter((s) => s.teacherId === user.id)
    setSections(teacherSections)
    const sectionIds = teacherSections.map((s) => s.id)
    setRecords(api.getAttendanceRecords().filter((r) => sectionIds.includes(r.sectionId)))
    setLoading(false)
  }, [user.id])

  const sessionsToday = api.getSessions().filter((s) => s.date === new Date().toISOString().slice(0, 10)).length
  const studentsInSubjects = new Set(api.getEnrollments().filter(e => sections.map(s => s.id).includes(e.sectionId)).map(e => e.studentId)).size
  
  const statCards = [
    { label: 'My Subjects', value: sections.length, icon: BookOpen },
    { label: 'My Students', value: studentsInSubjects, icon: Users },
    { label: 'Sessions Today', value: sessionsToday, icon: CalendarCheck },
    { label: 'Disputes', value: api.getDisputedRecords().length, icon: ClipboardList },
  ]

  if (loading) return <LoadingSpinner className="min-h-[400px]" />

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
              const subj = api.getSubject(sec.subjectId)
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
                {records.slice(0, 10).map((r) => (<tr key={r.id} className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4"><p className="font-bold text-foreground">{r.studentName}</p><p className="text-xs text-zinc-500">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></td>
                  <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">{(() => { const sess = api.getSession(r.sessionId); if (!sess) return r.sectionId; const sec = api.getSection(sess.sectionId); if (!sec) return r.sectionId; const subj = api.getSubject(sec.subjectId); return subj?.name ?? r.sectionId; })()}</td>
                  <td className="px-6 py-4 text-right"><StatusBadge status={r.status} /></td>
                </tr>))}
                {records.length === 0 && <tr><td colSpan={3} className="p-12 text-center text-sm font-bold text-zinc-400 uppercase tracking-widest">No recent activity</td></tr>}
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

function SuperAdminDashboard({ user }: { user: User }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  const totalFaculty = api.getTeachers().length
  const totalStudents = api.getStudents().length
  const totalSubjects = api.getSubjects().length
  
  const statCards = [
    { label: 'Total Faculty', value: totalFaculty, icon: Users },
    { label: 'Total Students', value: totalStudents, icon: Users },
    { label: 'Total Subjects', value: totalSubjects, icon: BookOpen },
    { label: 'System Health', value: 'Nominal', icon: ShieldCheck },
  ]

  if (loading) return <LoadingSpinner className="min-h-[400px]" />
  
  // Mock trend data for the chart
  const weeklyTrends = [
    { day: 'Mon', present: 85, late: 10, absent: 5 },
    { day: 'Tue', present: 82, late: 12, absent: 6 },
    { day: 'Wed', present: 88, late: 8, absent: 4 },
    { day: 'Thu', present: 75, late: 15, absent: 10 },
    { day: 'Fri', present: 90, late: 5, absent: 5 },
  ]

  // Mock anomaly records
  const anomalies = [
    { id: 1, type: 'Duplicate Scan', student: 'Conrad', time: '10:42 AM', severity: 'High' },
    { id: 2, type: 'Geofence Bypass', student: 'Alice', time: '09:15 AM', severity: 'Medium' },
    { id: 3, type: 'Multiple Logins', student: 'Bob', time: '08:30 AM', severity: 'High' }
  ]
  
  return (
    <>
      {/* Header Area */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-8">
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            System Administration
          </p>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">
            {user.fullName}
          </h1>
        </div>
        <div className="mt-4 md:mt-0">
          <Badge variant='default' className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-none bg-golden text-maroon hover:bg-golden`}>
            Super Administrator
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

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        {/* System Activity Chart */}
        <Card className="lg:col-span-2 rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-maroon dark:text-golden" />
              University Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex items-end justify-between h-48 gap-2">
              {weeklyTrends.map((day) => (
                <div key={day.day} className="flex-1 flex flex-col justify-end items-center group">
                  <div className="w-full flex flex-col justify-end gap-[1px]">
                    <div className="w-full bg-maroon-dark dark:bg-maroon transition-all" style={{ height: `${day.absent}%` }} title={`Absent: ${day.absent}%`} />
                    <div className="w-full bg-golden transition-all" style={{ height: `${day.late}%` }} title={`Late: ${day.late}%`} />
                    <div className="w-full bg-maroon dark:bg-white transition-all group-hover:opacity-90" style={{ height: `${day.present}%` }} title={`Present: ${day.present}%`} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-4">{day.day}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-8 pt-6 border-t border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-maroon dark:bg-white border border-zinc-900/10"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-golden border border-zinc-900/10"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Late</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-maroon-dark dark:bg-maroon border border-zinc-900/10"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Absent</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anomaly Log */}
        <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden flex flex-col">
          <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-maroon dark:text-red-400">
              <ShieldCheck className="w-4 h-4" />
              Detected Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex-1">
              {anomalies.map((anomaly, idx) => (
                <div key={anomaly.id} className={`p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${idx !== 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-foreground">{anomaly.type}</span>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 ${anomaly.severity === 'High' ? 'bg-maroon text-white dark:bg-red-900/30 dark:text-red-400' : 'bg-golden/20 text-golden'}`}>{anomaly.severity}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>{anomaly.student}</span>
                    <span>{anomaly.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
              <Button variant="outline" className="w-full text-[10px] font-bold uppercase tracking-widest rounded-none">
                View Audit Log <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 bg-maroon dark:bg-golden" />
          <h2 className="text-lg font-heading font-bold uppercase tracking-wider">Administrative Controls</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/faculty/users" className="group block p-6 border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-maroon hover:border-maroon dark:hover:bg-zinc-800 transition-all duration-300 relative overflow-hidden shadow-[0_4px_20px_rgba(123,17,19,0.02)] hover:shadow-md">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-white dark:text-golden" /></div>
            <h3 className="text-xl font-heading font-bold text-foreground group-hover:text-white dark:group-hover:text-golden mb-2">Manage Users</h3>
            <p className="text-sm text-zinc-500 group-hover:text-zinc-300 dark:group-hover:text-zinc-400">Add, edit, or remove faculty and student accounts.</p>
          </Link>
          <Link href="/faculty/subjects" className="group block p-6 border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-maroon hover:border-maroon dark:hover:bg-zinc-800 transition-all duration-300 relative overflow-hidden shadow-[0_4px_20px_rgba(123,17,19,0.02)] hover:shadow-md">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-white dark:text-golden" /></div>
            <h3 className="text-xl font-heading font-bold text-foreground group-hover:text-white dark:group-hover:text-golden mb-2">View Global Subjects</h3>
            <p className="text-sm text-zinc-500 group-hover:text-zinc-300 dark:group-hover:text-zinc-400">Oversee all active subjects and enrollment metrics.</p>
          </Link>
          <Link href="/faculty/reports" className="group block p-6 border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-maroon hover:border-maroon dark:hover:bg-zinc-800 transition-all duration-300 relative overflow-hidden shadow-[0_4px_20px_rgba(123,17,19,0.02)] hover:shadow-md">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-white dark:text-golden" /></div>
            <h3 className="text-xl font-heading font-bold text-foreground group-hover:text-white dark:group-hover:text-golden mb-2">System Reports</h3>
            <p className="text-sm text-zinc-500 group-hover:text-zinc-300 dark:group-hover:text-zinc-400">Export structured data and generate audit logs.</p>
          </Link>
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
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    setLoading(false)
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
          {isSuper ? <SuperAdminDashboard user={user} /> : <TeacherDashboard user={user} />}
        </div>
      </main>
    </div>
  )
}
