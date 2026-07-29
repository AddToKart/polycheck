'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Filter } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Subject, Teacher, AttendanceReport } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

const defaultEndDate = campusDate()
const defaultStart = new Date(`${defaultEndDate}T00:00:00.000Z`)
defaultStart.setUTCDate(defaultStart.getUTCDate() - 29)
const defaultStartDate = defaultStart.toISOString().slice(0, 10)

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultStartDate)
  const [dateTo, setDateTo] = useState(defaultEndDate)
  const [report, setReport] = useState<AttendanceReport | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'super_admin') {
      router.push('/faculty')
      return
    }
    setUser(cu)
    const fetchData = async () => {
      const [subjectsData, teachersData] = await Promise.all([
        api.getSubjects(),
        api.getTeachers(),
      ])
      setSubjects(subjectsData)
      setTeachers(teachersData)
    }
    fetchData()
  }, [router])

  useEffect(() => {
    if (!user || !dateFrom || !dateTo) return
    let active = true
    void api.getAttendanceReport({
      startDate: dateFrom,
      endDate: dateTo,
      teacherId: selectedTeacher || undefined,
      subjectId: selectedSubject || undefined,
    }).then((nextReport) => { if (active) setReport(nextReport) })
    return () => { active = false }
  }, [user, selectedSubject, selectedTeacher, dateFrom, dateTo])

  const filteredSummaries = report?.summaries ?? []
  const total = {
    total: report?.totals.totalRecords ?? 0,
    present: report?.totals.present ?? 0,
    late: report?.totals.late ?? 0,
    absent: report?.totals.absent ?? 0,
    pending: report?.totals.pending ?? 0,
    disputed: report?.totals.disputed ?? 0,
  }

  const presentPct = total.total > 0 ? Math.round((total.present / total.total) * 100) : 0
  const latePct = total.total > 0 ? Math.round((total.late / total.total) * 100) : 0
  const absentPct = total.total > 0 ? Math.round((total.absent / total.total) * 100) : 0
  const pendingPct = total.total > 0 ? Math.round((total.pending / total.total) * 100) : 0
  const disputedPct = total.total > 0 ? Math.round((total.disputed / total.total) * 100) : 0

  const handleExport = async () => {
    const csv = await api.exportAttendanceCsv({
      startDate: dateFrom,
      endDate: dateTo,
      teacherId: selectedTeacher || undefined,
      subjectId: selectedSubject || undefined,
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        <div className="p-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">Reports</h1>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full h-10 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Teacher</label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full h-10 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors"
                  >
                    <option value="">All Teachers</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">From</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">To</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Records</p>
                <p className="text-3xl font-bold text-maroon">{report?.totals.totalRecords ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Present %</p>
                <p className="text-3xl font-bold text-golden">{presentPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Late %</p>
                <p className="text-3xl font-bold text-maroon">{latePct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Absent %</p>
                <p className="text-3xl font-bold text-maroon-dark">{absentPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Pending %</p>
                <p className="text-3xl font-bold text-zinc-500">{pendingPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Disputed %</p>
                <p className="text-3xl font-bold text-amber-600">{disputedPct}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Donut Chart */}
            <Card>
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Attendance Distribution</p>
                <div className="flex items-center justify-center gap-8">
                  <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
                    <circle cx="70" cy="70" r="60" fill="none" stroke="#E4E4E7" strokeWidth="20" />
                    {total.total > 0 && (
                      <>
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#FFDF00" strokeWidth="20"
                          strokeDasharray={`${(total.present / total.total) * 377} 377`}
                          strokeDashoffset="0"
                          transform="rotate(-90 70 70)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#7B1113" strokeWidth="20"
                          strokeDasharray={`${(total.late / total.total) * 377} 377`}
                          strokeDashoffset={-((total.present / total.total) * 377)}
                          transform="rotate(-90 70 70)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#4A0A0B" strokeWidth="20"
                          strokeDasharray={`${(total.absent / total.total) * 377} 377`}
                          strokeDashoffset={-(((total.present + total.late) / total.total) * 377)}
                          transform="rotate(-90 70 70)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#A1A1AA" strokeWidth="20"
                          strokeDasharray={`${(total.pending / total.total) * 377} 377`}
                          strokeDashoffset={-(((total.present + total.late + total.absent) / total.total) * 377)}
                          transform="rotate(-90 70 70)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#D97706" strokeWidth="20"
                          strokeDasharray={`${(total.disputed / total.total) * 377} 377`}
                          strokeDashoffset={-(((total.present + total.late + total.absent + total.pending) / total.total) * 377)}
                          transform="rotate(-90 70 70)"
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                      </>
                    )}
                    <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-zinc-900 dark:fill-zinc-100">{total.total}</text>
                    <text x="70" y="86" textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-zinc-500 uppercase tracking-widest">total</text>
                  </svg>
                  <div className="space-y-3">
                    {[
                      { label: 'Present', count: total.present, pct: presentPct, color: '#FFDF00', textColor: 'text-golden' },
                      { label: 'Late', count: total.late, pct: latePct, color: '#7B1113', textColor: 'text-maroon' },
                      { label: 'Absent', count: total.absent, pct: absentPct, color: '#4A0A0B', textColor: 'text-maroon-dark' },
                      { label: 'Pending', count: total.pending, pct: pendingPct, color: '#A1A1AA', textColor: 'text-zinc-500' },
                      { label: 'Disputed', count: total.disputed, pct: disputedPct, color: '#D97706', textColor: 'text-amber-600' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="w-3 h-3 shrink-0" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{item.label}</p>
                          <p className={`text-sm font-bold ${item.textColor}`}>{item.count} ({item.pct}%)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Rate Bar */}
            <Card>
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Attendance Rate</p>
                <p className="text-4xl font-heading font-bold text-golden mb-4">{presentPct}%</p>
                <div className="w-full h-6 bg-zinc-200 dark:bg-zinc-800 relative overflow-hidden">
                  <div
                    className="h-full bg-golden transition-all duration-700 ease-out"
                    style={{ width: `${presentPct}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-zinc-500 mt-2 uppercase tracking-wider">
                  {total.present} of {total.total} records marked present
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-800 dark:text-zinc-100">Attendance Summary by Subject</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">Subject</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Sessions</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Present</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Late</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Absent</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Pending</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Disputed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaries.map((s) => (
                      <tr key={s.sectionId} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100 font-medium">{s.subjectName}</td>
                        <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">{s.totalSessions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-semibold bg-golden text-maroon-dark">{s.present}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-semibold bg-maroon text-white">{s.late}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-semibold bg-maroon-dark text-golden border border-golden">{s.absent}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-semibold border border-zinc-300 text-zinc-500">{s.pending}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-semibold bg-amber-600 text-white">{s.disputed}</span>
                        </td>
                      </tr>
                    ))}
                    {filteredSummaries.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500">
                          No data matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
