'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserX, RefreshCw, School, QrCode } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Student, Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']

const statusConfig: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  present: { label: 'Present', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600' },
  late: { label: 'Late', bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700' },
  absent: { label: 'Absent', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600' },
  pending: { label: 'Pending', bg: 'bg-white dark:bg-zinc-900', text: 'text-maroon' },
  disputed: { label: 'Disputed', bg: 'bg-zinc-900 dark:bg-black', text: 'text-amber-400' },
}

const SESSION_PAGE_SIZE = 5

export default function StudentDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const studentId = params.id as string
  const sectionId = searchParams.get('sectionId') || ''
  const [user, setUser] = useState<User | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [ready, setReady] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    const init = async () => {
      if (!studentId) return
      let secId = sectionId
      if (!secId) {
        const enrollments = await api.getEnrollments()
        const enr = enrollments.find((e) => e.studentId === studentId)
        if (enr) secId = enr.sectionId
      }
      if (!secId) return
      const s = await api.getStudent(studentId)
      if (!s) { router.push('/faculty/subjects'); return }
      setStudent(s)
      setSessions(await api.getSectionSessions(secId))
      setRecords(await api.getStudentAttendanceForSection(studentId, secId))
      setReady(true)
    }
    init()
  }, [studentId, sectionId, router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const handleRemove = async () => {
    if (!sectionId || !studentId) return
    if (window.confirm(`Remove ${student?.fullName} from this subject? This cannot be undone.`)) {
      await api.removeStudentFromSection(sectionId, studentId)
      router.push(`/faculty/sections/${sectionId}`)
    }
  }

  const handleCycleStatus = async (record: AttendanceRecord) => {
    const currentIdx = STATUS_CYCLE.indexOf(record.status)
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]
    await api.updateAttendanceStatus(record.id, nextStatus)
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: nextStatus } : r))
    )
  }

  const handleAddAbsent = async (session: Session) => {
    const existing = records.find((r) => r.sessionId === session.id)
    if (existing) return
    const newRecord: AttendanceRecord = {
      id: `a-manual-${Date.now()}`,
      sessionId: session.id,
      sectionId,
      studentId,
      studentName: student?.fullName ?? '',
      studentProgram: student?.program,
      timestamp: new Date().toISOString(),
      status: 'absent',
      coordinates: { latitude: 0, longitude: 0 },
      isSynced: false,
      notes: 'Manually marked by teacher',
    }
    await api.addAttendanceRecord(newRecord)
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
  const isTeacher = user.role === 'teacher'

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        backHref={`/faculty/sections/${sectionId}`}
        backLabel="Back to Subject"
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href={`/faculty/sections/${sectionId}`} className="text-maroon dark:text-golden hover:underline text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Subject
            </Link>
            <h1 className="text-2xl font-heading font-bold text-maroon-dark dark:text-white">{student.fullName}</h1>
          </div>

          {/* Flippable Virtual ID Card */}
          <div className="mb-8 flex flex-col items-center">
            {/* Flip Card Container */}
            <div
              className="relative w-full max-w-xl aspect-[1.586/1] cursor-pointer group perspective-[2000px]"
              onClick={() => setFlipped(!flipped)}
            >
              <div className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
                
                {/* Front Face */}
                <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white border-2 border-maroon dark:border-golden shadow-xl overflow-hidden flex flex-col rounded-none">
                  {/* PUP Header */}
                  <div className="bg-maroon px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                      <p className="text-xs font-bold text-golden tracking-wider">POLYTECHNIC UNIVERSITY</p>
                      <p className="text-[10px] font-medium text-white/80 tracking-[3px] mt-0.5">OF THE PHILIPPINES</p>
                    </div>
                    <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
                      <School className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 flex p-5 items-center gap-6 relative bg-[#fdfbf7] dark:bg-[#1a1a1a]">
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'url(/pup-logo.png)', backgroundPosition: 'center', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }}></div>
                    <div className="w-24 h-32 bg-maroon dark:bg-golden flex items-center justify-center shrink-0 border-2 border-zinc-300 dark:border-zinc-800 shadow-md relative z-10">
                      <span className="text-2xl font-heading font-bold text-white dark:text-maroon-dark">
                        {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center relative z-10">
                      <h2 className="text-lg font-heading font-bold text-zinc-900 dark:text-white leading-tight uppercase">{student.fullName}</h2>
                      <p className="text-sm font-mono font-bold text-maroon dark:text-golden mt-1">{student.studentId}</p>
                      <hr className="my-3 border-zinc-200 dark:border-zinc-700" />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Program</p>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">{student.program}</p>
                        </div>
                        <div>
                          <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Year Level</p>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">Year {student.yearLevel}</p>
                        </div>
                        <div>
                          <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Validity</p>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">2026-2027</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Face */}
                <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white border-2 border-maroon dark:border-golden shadow-xl overflow-hidden flex flex-col rounded-none">
                  {/* Magnetic Stripe */}
                  <div className="bg-zinc-950 h-10 w-full mt-5"></div>
                  
                  {/* Content */}
                  <div className="flex-1 p-5 flex text-zinc-950 dark:text-zinc-50 gap-4 bg-[#fdfbf7] dark:bg-[#1a1a1a]">
                    <div className="w-2/3 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-maroon dark:text-golden uppercase tracking-wider mb-1">Conditions of Use</p>
                        <p className="text-[8px] text-zinc-600 dark:text-zinc-400 leading-relaxed text-justify">
                          This ID card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.
                        </p>
                      </div>
                      <div className="mt-auto">
                        <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">In case of emergency, contact:</p>
                        <div className="border-b border-zinc-300 dark:border-zinc-700 h-5 mt-0.5"></div>
                        <div className="border-b border-zinc-300 dark:border-zinc-700 h-5 mt-1"></div>
                      </div>
                    </div>

                    <div className="w-1/3 flex flex-col items-center justify-center border-l-2 border-dashed border-zinc-300 dark:border-zinc-700 pl-4">
                      <div className="w-full aspect-square bg-white border border-zinc-300 dark:border-zinc-700 flex items-center justify-center p-1.5 shadow-sm">
                        <div className="grid grid-cols-5 grid-rows-5 w-full h-full gap-[1px]" aria-hidden="true">
                          {Array.from({ length: 25 }).map((_, i) => (
                            <div key={i} className={`bg-zinc-950 ${(i * 17 + 5) % 3 === 0 ? 'opacity-100' : 'opacity-0'}`}></div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[7px] font-mono mt-2 text-zinc-400 dark:text-zinc-500 text-center tracking-widest uppercase">SCAN TO VERIFY</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            <p className="text-center text-xs text-zinc-500 font-bold uppercase tracking-widest mt-4 animate-pulse">Click card to flip</p>
          </div>

          {/* Remove from Subject */}
          {isTeacher && (
            <div className="flex justify-center mb-8">
              <Button variant="outline" className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={handleRemove}>
                <UserX className="w-4 h-4 mr-2" /> Remove from Subject
              </Button>
            </div>
          )}

          {/* Attendance per Session */}
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1">Attendance per Session</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {isTeacher ? 'Tap a status badge to cycle between Present, Late, and Absent.' : 'Read-only attendance history.'}
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
                            onClick={() => { if (isTeacher) handleCycleStatus(record) }}
                            disabled={!isTeacher}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none ${isTeacher ? 'cursor-pointer transition-opacity hover:opacity-80' : 'cursor-default'} ${config.bg} ${config.text}`}
                          >
                            {config.label}
                            {isTeacher && <RefreshCw className="w-3 h-3" />}
                          </button>
                        ) : (
                          <button
                            onClick={() => { if (isTeacher) handleAddAbsent(session) }}
                            disabled={!isTeacher}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ${isTeacher ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                          >
                            No Record {isTeacher && <span className="text-lg leading-none">+</span>}
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
