'use client'

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, QrCode } from 'lucide-react'
import type { AttendanceRecord, AttendanceStatus, Section, Session, Student, StudentDisputeReason, Subject } from '@polycheck/shared'
import { formatCampusDate, generateStudentCalendarEvents } from '@polycheck/shared/utils'
import { Sidebar } from '@/components/layout/sidebar'
import { StudentAttendanceAudit } from '@/components/student/StudentAttendanceAudit'
import { StudentDashboardOverview } from '@/components/student/StudentDashboardOverview'
import { StudentDisputeDialog, StudentEnrollmentDialog } from '@/components/student/StudentDashboardDialogs'
import { StudentSubjectsGrid } from '@/components/student/StudentSubjectsGrid'
import { StudentWeeklySchedule } from '@/components/student/StudentWeeklySchedule'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'

const ScanQrModal = lazy(() => import('@/components/ScanQrModal'))
const ATTENDANCE_PAGE_SIZE = 8
type NavTab = 'dashboard' | 'subjects' | 'schedule' | 'attendance'

function StudentDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<Student | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSubjects, setAllSubjects] = useState<Subject[]>([])
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [attendancePage, setAttendancePage] = useState(0)
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | AttendanceStatus>('all')
  const [isIdModalOpen, setIsIdModalOpen] = useState(false)
  const [isIdFlipped, setIsIdFlipped] = useState(false)
  const [scheduleDate, setScheduleDate] = useState(new Date())
  const [disputeRecord, setDisputeRecord] = useState<AttendanceRecord | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputeFeedback, setDisputeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)
  const [scanSessionId, setScanSessionId] = useState<string>()
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollCode, setEnrollCode] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollSuccess, setEnrollSuccess] = useState(false)
  const [enrollError, setEnrollError] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTab(tab && ['dashboard', 'subjects', 'schedule', 'attendance'].includes(tab) ? tab as NavTab : 'dashboard')
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      let currentUser = api.getCurrentUser()
      if (!currentUser) currentUser = await api.restoreSession()
      if (!currentUser || currentUser.role !== 'student') {
        router.push('/login/student')
        return
      }
      const student = currentUser as Student
      setUser(student)
      if (!student.studentId) return
      try {
        const [studentSections, studentRecords, allSessions, subjects] = await Promise.all([
          api.getStudentSections(student.id),
          api.getAttendanceForStudent(student.id),
          api.getSessions(),
          api.getSubjects(),
        ])
        setSections(studentSections)
        setRecords(studentRecords)
        setSessions(allSessions)
        setAllSubjects(subjects)
      } catch {
        // The authenticated shell stays usable while the next navigation retries data loading.
      }
    }
    void load()
  }, [router])

  useEffect(() => setAttendancePage(0), [activeTab, attendanceFilter])

  const subjectMap = useMemo(() => new Map(allSubjects.map((subject) => [subject.id, { name: subject.name, code: subject.code }])), [allSubjects])
  const todayEvents = useMemo(() => {
    const today = formatCampusDate()
    return generateStudentCalendarEvents(sections, sessions, records, (id) => subjectMap.get(id), today, today)
      .sort((left, right) => left.startTime.localeCompare(right.startTime))
  }, [records, sections, sessions, subjectMap])
  const sortedRecords = useMemo(() => [...records].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()), [records])
  const filteredRecords = useMemo(() => attendanceFilter === 'all' ? sortedRecords : sortedRecords.filter((record) => record.status === attendanceFilter), [attendanceFilter, sortedRecords])
  const attendancePageCount = Math.max(1, Math.ceil(filteredRecords.length / ATTENDANCE_PAGE_SIZE))
  const pagedRecords = useMemo(() => filteredRecords.slice(attendancePage * ATTENDANCE_PAGE_SIZE, (attendancePage + 1) * ATTENDANCE_PAGE_SIZE), [attendancePage, filteredRecords])
  const stats = useMemo(() => ({
    present: records.filter((record) => record.status === 'present').length,
    late: records.filter((record) => record.status === 'late').length,
    absent: records.filter((record) => record.status === 'absent').length,
    disputed: records.filter((record) => record.status === 'disputed').length,
  }), [records])

  const sectionSubjectName = (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId)
    return section ? subjectMap.get(section.subjectId)?.name ?? sectionId : sectionId
  }

  const openScanner = (sessionId?: string) => {
    setScanSessionId(sessionId)
    setIsScanModalOpen(true)
  }

  const openDispute = (record: AttendanceRecord) => {
    setDisputeRecord(record)
    setDisputeReason('')
    setDisputeDescription('')
    setDisputeFeedback(null)
  }

  const handleEnrollSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const code = enrollCode.trim()
    setEnrollError('')
    setEnrollSuccess(false)
    if (!code || !user) {
      setEnrollError('Please enter an enrollment code.')
      return
    }
    setEnrollLoading(true)
    try {
      await api.enrollByCode(code)
      setEnrollSuccess(true)
      setEnrollCode('')
      const [updatedSections, updatedRecords, updatedSessions] = await Promise.all([
        api.getStudentSections(user.id),
        api.getAttendanceForStudent(user.id),
        api.getSessions(),
      ])
      setSections(updatedSections)
      setRecords(updatedRecords)
      setSessions(updatedSessions)
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : 'Unable to enroll in this section.')
    } finally {
      setEnrollLoading(false)
    }
  }

  const handleSubmitDispute = async () => {
    if (!disputeRecord || !disputeReason || !user) return
    const result = await api.submitDispute({ recordId: disputeRecord.id, reason: disputeReason as StudentDisputeReason, description: disputeDescription })
    if (result) {
      setDisputeFeedback({ type: 'success', message: 'Dispute submitted successfully.' })
      setRecords(await api.getAttendanceForStudent(user.id))
    } else {
      setDisputeFeedback({ type: 'error', message: 'Failed to submit dispute.' })
    }
    setDisputeReason('')
    setDisputeDescription('')
    setTimeout(() => setDisputeFeedback(null), 3000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <Sidebar user={{ ...user, email: user.email || '' } as any} onLogout={() => { api.logout(); router.push('/') }} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-300 dark:border-zinc-800 pb-8">
            <div><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Student Portal</p><h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">{user.fullName}</h1></div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <Button onClick={() => { setIsEnrollModalOpen(true); setEnrollError(''); setEnrollSuccess(false); setEnrollCode('') }} className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-10 px-6"><GraduationCap className="w-4 h-4 mr-2" />Enroll in Subject</Button>
              <Button onClick={() => openScanner()} className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-10 px-6"><QrCode className="w-4 h-4 mr-2" />Scan Attendance QR</Button>
            </div>
          </div>

          {activeTab === 'dashboard' ? <StudentDashboardOverview user={user} stats={stats} todayEvents={todayEvents} records={records} isIdOpen={isIdModalOpen} isIdFlipped={isIdFlipped} onOpenId={() => setIsIdModalOpen(true)} onCloseId={() => setIsIdModalOpen(false)} onFlipId={() => setIsIdFlipped((value) => !value)} onOpenSchedule={() => router.push('?tab=schedule')} onOpenScanner={openScanner} onReportIssue={openDispute} sectionSubjectName={sectionSubjectName} /> : null}
          {activeTab === 'subjects' ? <StudentSubjectsGrid sections={sections} subjectMap={subjectMap} /> : null}
          {activeTab === 'schedule' ? <StudentWeeklySchedule date={scheduleDate} onDateChange={setScheduleDate} sections={sections} sessions={sessions} records={records} subjectMap={subjectMap} /> : null}
          {activeTab === 'attendance' ? <StudentAttendanceAudit records={pagedRecords} filteredCount={filteredRecords.length} filter={attendanceFilter} page={attendancePage} pageCount={attendancePageCount} pageSize={ATTENDANCE_PAGE_SIZE} onFilterChange={setAttendanceFilter} onPageChange={setAttendancePage} onReportIssue={openDispute} sectionSubjectName={sectionSubjectName} /> : null}

          <StudentDisputeDialog record={disputeRecord} reason={disputeReason} description={disputeDescription} feedback={disputeFeedback} subjectName={disputeRecord ? sectionSubjectName(disputeRecord.sectionId) : ''} onClose={() => { setDisputeRecord(null); setDisputeFeedback(null) }} onReasonChange={setDisputeReason} onDescriptionChange={setDisputeDescription} onSubmit={() => void handleSubmitDispute()} />
          <StudentEnrollmentDialog open={isEnrollModalOpen} code={enrollCode} loading={enrollLoading} success={enrollSuccess} error={enrollError} onOpenChange={setIsEnrollModalOpen} onCodeChange={setEnrollCode} onSubmit={(event) => void handleEnrollSubmit(event)} />
        </div>
      </main>

      {isScanModalOpen ? (
        <Suspense fallback={null}>
          <ScanQrModal user={user} sessionId={scanSessionId} onClose={async () => { setIsScanModalOpen(false); setScanSessionId(undefined); setRecords(await api.getAttendanceForStudent(user.id)) }} />
        </Suspense>
      ) : null}
    </div>
  )
}

export default function StudentDashboardPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-background text-zinc-500 uppercase tracking-widest text-xs font-bold">Loading portal...</div>}><StudentDashboardContent /></Suspense>
}
