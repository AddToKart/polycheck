'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserX, RefreshCw, School, QrCode } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Student, Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']

const statusConfig: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  present: { label: 'Present', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600' },
  late: { label: 'Late', bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700' },
  absent: { label: 'Absent', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600' },
  pending: { label: 'Pending', bg: 'bg-white dark:bg-zinc-900', text: 'text-maroon' },
}

const SESSION_PAGE_SIZE = 5

export default function StudentDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const studentId = params.id as string
  const subjectId = searchParams.get('subjectId') || ''
  const [user, setUser] = useState<User | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [ready, setReady] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!studentId || !subjectId) return
    const s = api.getStudent(studentId)
    if (!s) { router.push('/faculty/subjects'); return }
    setStudent(s)
    setSessions(api.getSubjectSessions(subjectId))
    setRecords(api.getStudentAttendanceForSubject(studentId, subjectId))
    setReady(true)
  }, [studentId, subjectId, router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const handleRemove = () => {
    if (!subjectId || !studentId) return
    if (window.confirm(`Remove ${student?.fullName} from this subject? This cannot be undone.`)) {
      api.removeStudentFromSubject(subjectId, studentId)
      router.push(`/faculty/subjects/${subjectId}`)
    }
  }

  const handleCycleStatus = (record: AttendanceRecord) => {
    const currentIdx = STATUS_CYCLE.indexOf(record.status)
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]
    api.updateAttendanceStatus(record.id, nextStatus)
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: nextStatus } : r))
    )
  }

  const handleAddAbsent = (session: Session) => {
    const existing = records.find((r) => r.sessionId === session.id)
    if (existing) return
    const newRecord: AttendanceRecord = {
      id: `a-manual-${Date.now()}`,
      sessionId: session.id,
      subjectId,
      studentId,
      studentName: student?.fullName ?? '',
      studentProgram: student?.program,
      timestamp: new Date().toISOString(),
      status: 'absent',
      coordinates: { latitude: 0, longitude: 0 },
      isSynced: false,
      notes: 'Manually marked by teacher',
    }
    api.addAttendanceRecord(newRecord)
    setRecords((prev) => [...prev, newRecord])
  }

  const getRecordForSession = (sessionId: string) =>
    records.find((r) => r.sessionId === sessionId)

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [sessions],
  )

  const sessionPageCount = Math.max(1, Math.ceil(sortedSessions.length / SESSION_PAGE_SIZE))
  const pagedSessions = sortedSessions.slice(sessionPage * SESSION_PAGE_SIZE, (sessionPage + 1) * SESSION_PAGE_SIZE)

  if (!user || !ready || !student) return null

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        backHref={`/faculty/subjects/${subjectId}`}
        backLabel="Back to Subject"
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href={`/faculty/subjects/${subjectId}`} className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subject
            </Link>
            <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{student.fullName}</h1>
          </div>

          {/* Virtual ID Card */}
          <Card className="mb-6 overflow-hidden border-2 border-maroon dark:border-golden">
            {/* PUP Header */}
            <div className="bg-maroon px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-golden tracking-wider">POLYTECHNIC UNIVERSITY</p>
                <p className="text-[10px] font-medium text-white/80 tracking-[3px] mt-0.5">OF THE PHILIPPINES</p>
              </div>
              <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
            </div>

            <CardContent className="p-6 flex gap-6">
              {/* Photo placeholder */}
              <div className="w-24 h-32 bg-maroon dark:bg-golden flex items-center justify-center shrink-0">
                <span className="text-2xl font-heading font-bold text-white dark:text-maroon-dark">
                  {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-lg font-heading font-bold text-zinc-800 dark:text-white">{student.fullName}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{student.studentId}</p>
                <hr className="my-3 border-zinc-200 dark:border-zinc-700" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Program</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{student.program}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Year Level</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{student.yearLevel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Student No.</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{student.studentId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Validity</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">2026-2027</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remove from Subject */}
          <div className="flex justify-center mb-8">
            <Button variant="outline" className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleRemove}>
              <UserX className="w-4 h-4 mr-2" /> Remove from Subject
            </Button>
          </div>

          {/* Attendance per Session */}
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1">Attendance per Session</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Tap a status badge to cycle between Present &rarr; Late &rarr; Absent
          </p>

          {sortedSessions.length === 0 ? (
            <p className="text-center py-12 text-zinc-400 dark:text-zinc-600">No sessions created yet.</p>
          ) : (
            <div className="space-y-2">
              {pagedSessions.map((session) => {
                const record = getRecordForSession(session.id)
                const config = record ? statusConfig[record.status] : statusConfig.absent
                return (
                  <Card key={session.id} className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                    <CardContent className="py-4 px-5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {new Date(session.date).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {session.startTime} &ndash; {session.endTime}
                        </p>
                      </div>

                      <div>
                        {record ? (
                          <button
                            onClick={() => handleCycleStatus(record)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none cursor-pointer transition-opacity hover:opacity-80 ${config.bg} ${config.text}`}
                          >
                            {config.label}
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddAbsent(session)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none cursor-pointer bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:opacity-80 transition-opacity"
                          >
                            No Record <span className="text-lg leading-none">+</span>
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Session Pagination */}
          {sessionPageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessionPage(Math.max(0, sessionPage - 1))}
                disabled={sessionPage === 0}
              >
                Prev
              </Button>
              {Array.from({ length: sessionPageCount }, (_, i) => (
                <Button
                  key={i}
                  variant={sessionPage === i ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-[36px]"
                  onClick={() => setSessionPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessionPage(Math.min(sessionPageCount - 1, sessionPage + 1))}
                disabled={sessionPage === sessionPageCount - 1}
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
