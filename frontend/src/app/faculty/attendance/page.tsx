'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { User, AttendanceReport } from '@polycheck/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StatusBadge from '@/components/StatusBadge'
import { Sidebar } from '@/components/layout/sidebar'
import { Download, ChevronRight, CalendarDays } from 'lucide-react'

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

const defaultToDate = campusDate()
const defaultFrom = new Date(`${defaultToDate}T00:00:00.000Z`)
defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
const defaultFromDate = defaultFrom.toISOString().slice(0, 10)

export default function AttendanceOverviewPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!user || !fromDate || !toDate) return
    let active = true
    void api.getAttendanceReport({ startDate: fromDate, endDate: toDate }).then((nextReport) => {
      if (active) setReport(nextReport)
    })
    return () => { active = false }
  }, [user, fromDate, toDate])

  if (!user) return null

  const summaries = report?.summaries ?? []
  const totals = report?.totals ?? {
    totalRecords: 0,
    totalSessions: 0,
    present: 0,
    late: 0,
    absent: 0,
    pending: 0,
    disputed: 0,
  }

  const handleExport = async () => {
    const csv = await api.exportAttendanceCsv({ startDate: fromDate, endDate: toDate })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Attendance</p>
              <h1 className="text-3xl font-heading font-bold text-foreground">Attendance Overview</h1>
            </div>
            <Button onClick={handleExport} variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-wrap items-end gap-4 mb-8 p-5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2 text-zinc-400 mr-2">
              <CalendarDays className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Date Range</span>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="fromDate" className="text-[10px] uppercase tracking-widest">From</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-none w-40 h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="toDate" className="text-[10px] uppercase tracking-widest">To</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-none w-40 h-8 text-xs"
                />
              </div>
              {(fromDate !== defaultFromDate || toDate !== defaultToDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFromDate(defaultFromDate); setToDate(defaultToDate) }}
                  className="text-[10px] font-bold uppercase tracking-widest h-8 rounded-none text-zinc-500 hover:text-maroon dark:hover:text-golden"
                >
                  Clear
                </Button>
              )}
            </div>
            {(fromDate || toDate) && (
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest ml-auto">
                Showing filtered results
              </p>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 border border-zinc-300 dark:border-zinc-800 mb-8">
            <div className="p-6 border-r border-zinc-300 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Total Sessions</p>
              <p className="text-3xl font-heading font-bold text-foreground">{totals.totalSessions}</p>
            </div>
            <div className="p-6 border-r border-zinc-300 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Present</p>
              <p className="text-3xl font-heading font-bold text-golden">{totals.present}</p>
            </div>
            <div className="p-6 border-r border-zinc-300 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Late</p>
              <p className="text-3xl font-heading font-bold text-maroon">{totals.late}</p>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Absent</p>
              <p className="text-3xl font-heading font-bold text-maroon-dark dark:text-red-400">{totals.absent}</p>
            </div>
            <div className="p-6 border-l border-zinc-300 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Pending</p>
              <p className="text-3xl font-heading font-bold text-zinc-500">{totals.pending}</p>
            </div>
            <div className="p-6 border-l border-zinc-300 dark:border-zinc-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Disputed</p>
              <p className="text-3xl font-heading font-bold text-amber-600">{totals.disputed}</p>
            </div>
          </div>

          {/* By Subject Table — each row links to section detail */}
          <div className="border border-zinc-300 dark:border-zinc-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">By Subject · Click to view students</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sessions</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-golden">Present</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-maroon">Late</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-maroon-dark dark:text-red-400">Absent</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pending</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-600">Disputed</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                   {summaries.map((s) => (
                    <tr
                      key={s.sectionId}
                      className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/faculty/sections/${s.sectionId}`)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">{s.subjectName}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Section {s.sectionId.slice(-3).toUpperCase()}</p>
                      </td>
                      <td className="px-4 py-4 text-center text-zinc-600 dark:text-zinc-400 font-medium">{s.totalSessions}</td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="present">{s.present}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="late">{s.late}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="absent">{s.absent}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="pending">{s.pending}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className="bg-amber-600 text-white">{s.disputed}</Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-maroon dark:group-hover:text-golden transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))}
                  {summaries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          No attendance data available.
                          <StatusBadge status="pending" />
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
