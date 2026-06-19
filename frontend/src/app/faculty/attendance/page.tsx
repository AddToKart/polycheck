'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/mock-api'
import type { User, AttendanceSummary } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { Sidebar } from '@/components/layout/sidebar'

export default function AttendanceOverviewPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    setSummaries(api.getAttendanceSummaries(cu.id))
  }, [router])

  if (!user) return null

  const totals = summaries.reduce(
    (acc, s) => ({
      totalSessions: acc.totalSessions + s.totalSessions,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
    }),
    { totalSessions: 0, present: 0, late: 0, absent: 0 }
  )

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }



  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-8">
            Attendance Overview
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                  Total Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-maroon">
                  {totals.totalSessions}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                  Present
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-golden">
                  {totals.present}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                  Late
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-maroon">
                  {totals.late}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                  Absent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-maroon-dark">
                  {totals.absent}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-800 dark:text-zinc-100">
                By Subject
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        Subject
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        Sessions
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="text-golden">Present</span>
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="text-maroon">Late</span>
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="text-maroon-dark">Absent</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((s) => (
                      <tr
                        key={s.sectionId}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-6 py-3 text-zinc-900 dark:text-zinc-100 font-medium">
                          {s.subjectName}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                          {s.totalSessions}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="present">{s.present}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="late">{s.late}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="absent">{s.absent}</Badge>
                        </td>
                      </tr>
                    ))}
                    {summaries.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            No attendance data available.
                            <StatusBadge status="pending" />
                          </span>
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
