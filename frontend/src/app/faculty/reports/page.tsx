'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Filter } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject, Teacher, AttendanceSummary } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'super_admin') {
      router.push('/faculty')
      return
    }
    setUser(cu)
    setSubjects(api.getSubjects())
    setTeachers(api.getTeachers())
    setSummaries(api.getAttendanceSummaries())
  }, [router])

  if (!user) return null

  const filteredSummaries = summaries.filter((s) => {
    if (selectedSubject && s.subjectId !== selectedSubject) return false
    return true
  })

  const total = filteredSummaries.reduce(
    (acc, s) => ({
      total: acc.total + s.present + s.late + s.absent,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
    }),
    { total: 0, present: 0, late: 0, absent: 0 }
  )

  const presentPct = total.total > 0 ? Math.round((total.present / total.total) * 100) : 0
  const latePct = total.total > 0 ? Math.round((total.late / total.total) * 100) : 0
  const absentPct = total.total > 0 ? Math.round((total.absent / total.total) * 100) : 0

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white">Reports</h1>
            <Button>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Attendance</p>
                <p className="text-3xl font-bold text-maroon">{total.total}</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaries.map((s) => (
                      <tr key={s.subjectId} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
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
                      </tr>
                    ))}
                    {filteredSummaries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500">
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
