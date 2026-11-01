'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { canAccessAcademicOversight, type StudentAtRisk } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/lib/hooks'
import type { User } from '@polycheck/shared'

const STATUS_LABELS: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'Below threshold',
  at_risk: 'At risk',
  on_track: 'On track',
  insufficient_data: 'Insufficient data',
}

const STATUS_CLASSES: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'bg-maroon text-white dark:bg-maroon',
  at_risk: 'bg-golden text-maroon-dark',
  on_track: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  insufficient_data: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}

export default function AtRiskStudentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [rows, setRows] = useState<StudentAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || !canAccessAcademicOversight(current)) {
      router.replace('/faculty')
      return
    }
    setUser(current)
  }, [router])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setError('')
    api
      .getAtRiskStudents({ limit: 50 })
      .then((result) => {
        if (active) setRows(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load at-risk students')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  const threshold = rows[0]?.thresholdPercent

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          left.studentName.localeCompare(right.studentName) ||
          left.sectionName.localeCompare(right.sectionName),
      ),
    [rows],
  )

  const handleLogout = () => {
    void api.logout()
    router.push('/')
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Academic department oversight
              </p>
              <h1 className="flex items-center gap-2 text-3xl font-heading font-bold text-maroon dark:text-white">
                <AlertTriangle className="h-7 w-7" aria-hidden />
                At-risk students
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {user.role === 'teacher'
                  ? `Students in ${user.department ?? 'your department'} approaching the ${threshold ?? 75}% attendance floor.`
                  : `Students approaching the ${threshold ?? 75}% attendance floor in your scope.`}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true)
                api
                  .getAtRiskStudents({ limit: 50 })
                  .then(setRows)
                  .catch((cause) =>
                    setError(cause instanceof Error ? cause.message : 'Unable to refresh'),
                  )
                  .finally(() => setLoading(false))
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </Button>
          </div>

          {error ? (
            <p
              role="alert"
              className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500">
                  <LoadingSpinner />
                  Loading oversight data…
                </div>
              ) : sorted.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="font-heading text-lg font-bold text-maroon dark:text-golden">
                    Everyone is on track
                  </p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    No students are near the attendance threshold in your department yet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Phone layout: stacked rows from the same oversight data */}
                  <div className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800/60">
                    {sorted.map((row) => (
                      <div key={`${row.sectionId}:${row.studentId}`} className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.studentName}</p>
                            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                              {row.studentNumber ?? '—'}
                            </p>
                          </div>
                          <span
                            className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[row.status]}`}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                        </div>
                        <div className="min-w-0 text-xs text-zinc-600 dark:text-zinc-300">
                          <p className="font-medium">{row.subjectName}</p>
                          <p className="text-zinc-500 dark:text-zinc-400">
                            {row.sectionName} · {row.professorName}
                          </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Rate</dt>
                            <dd className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-100">
                              {row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Absences left</dt>
                            <dd className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                              {row.absencesBeforeBelowThreshold ?? '—'}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Last absence</dt>
                            <dd className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                              {row.lastAbsenceDate ?? '—'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <tr>
                          <th className="px-5 py-3">Student</th>
                          <th className="px-5 py-3">Section</th>
                          <th className="px-5 py-3">Professor</th>
                          <th className="px-5 py-3">Rate</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Absences left</th>
                          <th className="px-5 py-3">Last absence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((row) => (
                          <tr
                            key={`${row.sectionId}:${row.studentId}`}
                            className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                          >
                            <td className="px-5 py-3">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.studentName}</p>
                              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {row.studentNumber ?? '—'}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                              <p>{row.subjectName}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.sectionName}</p>
                            </td>
                            <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{row.professorName}</td>
                            <td className="px-5 py-3 font-semibold text-zinc-800 dark:text-zinc-100">
                              {row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[row.status]}`}
                              >
                                {STATUS_LABELS[row.status]}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                              {row.absencesBeforeBelowThreshold ?? '—'}
                            </td>
                            <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                              {row.lastAbsenceDate ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
