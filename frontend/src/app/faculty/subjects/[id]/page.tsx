'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, Key, RefreshCw, Ban, Users, CalendarDays } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject, Student } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 10

export default function SubjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [students, setStudents] = useState<(Student & { attendance: { present: number; late: number; absent: number } })[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

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
    const s = api.getSubject(id)
    if (!s) { router.push('/faculty/subjects'); return }
    setSubject(s)
    setStudents(api.getSubjectStudents(id))
  }, [id, router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
    )
  }, [students, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search])

  const handleResetCode = () => {
    if (!id) return
    const code = api.resetEnrollmentCode(id)
    const s = api.getSubject(id)
    if (s) setSubject({ ...s })
    alert(`New enrollment code: ${code}`)
  }

  const handleDisableCode = () => {
    if (!id) return
    if (window.confirm('Students will no longer be able to enroll using this code. Continue?')) {
      api.disableEnrollmentCode(id)
      const s = api.getSubject(id)
      if (s) setSubject({ ...s })
    }
  }

  if (!user || !subject) return null

  const totalPresent = students.reduce((sum, s) => sum + s.attendance.present, 0)
  const totalLate = students.reduce((sum, s) => sum + s.attendance.late, 0)
  const totalAbsent = students.reduce((sum, s) => sum + s.attendance.absent, 0)

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/subjects" backLabel="Back to Subjects" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/faculty/subjects" className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subjects
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{subject.name}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{subject.code} &middot; Section {subject.section}</p>
            </div>
          </div>

          {/* Subject Info */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Room</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{subject.room}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Semester</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{subject.semester}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Enrolled</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{subject.studentCount} students</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Schedule</p>
                  <div className="flex flex-wrap gap-1">
                    {subject.schedule.map((sd, i) => (
                      <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-maroon dark:text-golden px-2 py-0.5 border border-zinc-200 dark:border-zinc-700">
                        {sd.day} {sd.startTime}-{sd.endTime}{sd.room ? ` (${sd.room})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrollment Code */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 text-base">
                <Key className="w-4 h-4 text-maroon dark:text-golden" />
                Enrollment Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subject.enrollmentCode ? (
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-2xl font-mono font-bold text-maroon dark:text-golden tracking-wider">{subject.enrollmentCode}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Expires: {new Date(subject.enrollmentCodeExpiry).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic mb-3">Enrollment code is disabled</p>
              )}
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={handleResetCode}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleDisableCode}>
                  <Ban className="w-3.5 h-3.5 mr-1.5" /> Disable
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-golden">{totalPresent}</p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-maroon">{totalLate}</p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold text-maroon-dark">{totalAbsent}</p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Absent</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
            />
          </div>

          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
          </p>

          {/* Student List */}
          {paged.length === 0 ? (
            <p className="text-center py-12 text-zinc-400 dark:text-zinc-600">No students found.</p>
          ) : (
            <div className="space-y-2">
              {paged.map((student) => {
                const total = student.attendance.present + student.attendance.late + student.attendance.absent
                const rate = total > 0 ? Math.round((student.attendance.present / total) * 100) : 0
                return (
                  <Link
                    key={student.id}
                    href={`/faculty/students/${student.id}?subjectId=${id}`}
                    className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors"
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-maroon dark:bg-golden flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white dark:text-maroon-dark">
                          {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{student.fullName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{student.studentId}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{student.program}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-1">
                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-600 border-amber-200 dark:border-amber-800">
                            P {student.attendance.present}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 border-red-200 dark:border-red-800">
                            L {student.attendance.late}
                          </Badge>
                          <Badge variant="outline" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 border-zinc-200 dark:border-zinc-700">
                            A {student.attendance.absent}
                          </Badge>
                        </div>
                        {total > 0 && (
                          <div className="w-24">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-golden rounded-full" style={{ width: `${rate}%` }} />
                              </div>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8 text-right">{rate}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Prev
              </Button>
              {Array.from({ length: pageCount }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-[36px]"
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                disabled={page === pageCount - 1}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
