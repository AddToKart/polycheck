'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/mock-api'
import type { Student, Section, AttendanceRecord } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusBadge from '@/components/StatusBadge'
import ThemeToggle from '@/components/ThemeToggle'
import {
  LayoutDashboard,
  BookOpen,
  Clock,
  User,
  LogOut,
  GraduationCap,
  CalendarDays,
  Calendar,
  MapPin,
  X,
  Menu,
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getWeekDays, getDayName, getDayNameFull, formatDate, formatTime, isSameDay, getDateRangeForWeek, type CalendarEvent } from '@/lib/calendar-utils'

type NavTab = 'dashboard' | 'subjects' | 'schedule' | 'attendance'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'subjects', label: 'My Subjects', icon: BookOpen },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'attendance', label: 'Attendance History', icon: Clock },
] as const

const statCards = [
  { key: 'present', label: 'Present', color: 'text-golden' },
  { key: 'late', label: 'Late', color: 'text-maroon' },
  { key: 'absent', label: 'Absent', color: 'text-maroon-dark' },
  { key: 'disputed', label: 'Disputed', color: 'text-maroon-dark dark:text-golden' },
] as const
function generateStudentEvents(
  sections: { id: string; section: string; schedule: { day: string; startTime: string; endTime: string; room?: string }[]; subjectId: string; teacherName: string; room: string }[],
  getSubject: (id: string) => { name: string; code: string } | undefined,
  startDate: Date,
  endDate: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  for (const section of sections) {
    const subject = getSubject(section.subjectId)
    for (const sched of section.schedule) {
      const dayIndex = dayMap[sched.day]
      if (dayIndex === -1 || dayIndex === undefined) continue
      const current = new Date(startDate)
      while (current <= endDate) {
        if (current.getDay() === dayIndex) {
          events.push({
            id: `sched-${section.id}-${formatDate(current)}-${sched.startTime}`,
            title: subject?.name ?? section.id,
            sectionId: section.id,
            sectionName: `Sec ${section.section}`,
            subjectName: subject?.name ?? section.id,
            subjectCode: subject?.code,
            room: sched.room || section.room,
            startTime: sched.startTime,
            endTime: sched.endTime,
            date: formatDate(current),
            type: 'schedule',
            teacherName: section.teacherName,
          })
        }
        current.setDate(current.getDate() + 1)
      }
    }
  }
  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.startTime.localeCompare(b.startTime)
  })
}

export default function StudentDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [attendancePage, setAttendancePage] = useState(0)
  const [isIdModalOpen, setIsIdModalOpen] = useState(false)
  const [isIdFlipped, setIsIdFlipped] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState(new Date())
  const [disputeRecord, setDisputeRecord] = useState<AttendanceRecord | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputeFeedback, setDisputeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Enrollment Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollCode, setEnrollCode] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollSuccess, setEnrollSuccess] = useState(false)
  const [enrollError, setEnrollError] = useState('')

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnrollError('')
    setEnrollSuccess(false)

    const trimmed = enrollCode.trim()
    if (!trimmed) {
      setEnrollError('Please enter an enrollment code.')
      return
    }

    setEnrollLoading(true)

    const allSections = api.getSections()
    const foundSection = allSections.find((s) => s.enrollmentCode === trimmed)
    if (!foundSection) {
      setEnrollError('Invalid enrollment code. Please check and try again.')
      setEnrollLoading(false)
      return
    }

    if (new Date(foundSection.enrollmentCodeExpiry) < new Date()) {
      setEnrollError('This enrollment code has expired.')
      setEnrollLoading(false)
      return
    }

    const result = api.enrollStudent({
      sectionId: foundSection.id,
      studentId: user!.id,
      studentName: user!.fullName,
    })

    if (!result) {
      setEnrollError('You are already enrolled in this section.')
      setEnrollLoading(false)
      return
    }

    setEnrollSuccess(true)
    setEnrollCode('')
    setEnrollLoading(false)
    // Refresh student's enrolled subjects list
    setSections(api.getStudentSections(user!.id))
  }

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') {
      router.push('/')
      return
    }
    setUser(cu as Student)
    if (cu.studentId) {
      setSections(api.getStudentSections(cu.id))
      setRecords(api.getAttendanceForStudent(cu.id))
    }
  }, [router])
  
  useEffect(() => {
    setAttendancePage(0)
  }, [activeTab])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const sectionSubjectName = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId)
    if (!sec) return sectionId
    const subj = api.getSubject(sec.subjectId)
    return subj?.name ?? sectionId
  }

  const handleSubmitDispute = () => {
    if (!disputeRecord || !disputeReason) return
    const result = api.submitDispute({ recordId: disputeRecord.id, reason: disputeReason, description: disputeDescription })
    if (result) {
      setDisputeFeedback({ type: 'success', message: 'Dispute submitted successfully.' })
      setRecords(api.getAttendanceForStudent(user!.id))
    } else {
      setDisputeFeedback({ type: 'error', message: 'Failed to submit dispute.' })
    }
    setTimeout(() => setDisputeFeedback(null), 3000)
    setDisputeRecord(null)
    setDisputeReason('')
    setDisputeDescription('')
  }

const ATTENDANCE_PAGE_SIZE = 8
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [records]
  )
  const attendancePageCount = Math.max(1, Math.ceil(sortedRecords.length / ATTENDANCE_PAGE_SIZE))
  const pagedRecords = useMemo(
    () => sortedRecords.slice(attendancePage * ATTENDANCE_PAGE_SIZE, (attendancePage + 1) * ATTENDANCE_PAGE_SIZE),
    [sortedRecords, attendancePage]
  )

  if (!user) return null

  const stats = {
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
    disputed: records.filter((r) => r.status === 'disputed').length,
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">
            Polycheck
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">Student</p>
        </div>
        <div className="flex items-center gap-2">
          <img src="/pup-logo.png" alt="PUP Logo" className="w-8 h-8 shrink-0 object-contain" />
          <button
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden p-1 rounded-none hover:bg-white/10 text-white dark:text-maroon-dark transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key as NavTab); setIsMenuOpen(false) }}
                className={`flex items-center gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-l-4 w-full text-left ${
                  isActive
                    ? 'border-maroon dark:border-golden bg-zinc-100 dark:bg-zinc-900 text-maroon dark:text-golden'
                    : 'border-transparent text-zinc-500 hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon 
                  className={`w-5 h-5 shrink-0 ${isActive ? 'text-maroon dark:text-golden' : ''}`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="p-6 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            Appearance
          </p>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-maroon flex items-center justify-center text-golden font-heading font-bold text-sm shrink-0 border border-maroon-dark">
            {user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{user.fullName}</p>
            <p className="text-xs text-zinc-500 truncate">{user.studentId}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-white hover:bg-maroon hover:border-maroon transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden sticky top-0 z-30 w-full h-16 bg-maroon dark:bg-zinc-950 text-white dark:text-golden border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <img src="/pup-logo.png" alt="PUP Logo" className="w-6 h-6 shrink-0 object-contain" />
          <span className="font-heading font-bold text-lg tracking-tight">Polycheck</span>
        </div>
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2 hover:bg-white/10 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6 text-white dark:text-golden" />
        </button>
      </div>

      {/* Mobile Slide-Out Drawer Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Slide-out Menu Panel */}
          <aside className="relative w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col h-full z-50 overflow-hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 border-b border-zinc-300 dark:border-zinc-800 pb-8">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                Student Portal
              </p>
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground tracking-tight">
                {user.fullName}
              </h1>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <Button 
                onClick={() => {
                  setIsEnrollModalOpen(true)
                  setEnrollError('')
                  setEnrollSuccess(false)
                  setEnrollCode('')
                }}
                className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-10 px-6"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Enroll in Subject
              </Button>
              <Button asChild className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-10 px-6">
                <button onClick={() => {/* Future Scan QR Trigger */}}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Scan Attendance QR
                </button>
              </Button>
            </div>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              <div className="grid lg:grid-cols-3 gap-8 mb-8 items-start">
                {/* Digital ID Card */}
                <Card className="lg:col-span-1 lg:sticky lg:top-8 rounded-none border-zinc-300 dark:border-zinc-800 shadow-none overflow-hidden flex flex-col relative bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="h-24 bg-maroon flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #FFDF00 2px, transparent 2px)', backgroundSize: '16px 16px' }}></div>
                    <img src="/pup-logo.png" alt="PUP Logo" className="w-16 h-16 absolute right-4 bottom-4 opacity-20 filter grayscale contrast-200" />
                  </div>
                  <div className="absolute top-12 left-6 w-24 h-24 bg-zinc-200 dark:bg-zinc-800 border-4 border-background flex items-center justify-center overflow-hidden">
                     {/* Placeholder for actual photo */}
                     <User className="w-12 h-12 text-zinc-400" />
                  </div>
                  <CardContent className="pt-16 pb-6 px-6 flex-1 flex flex-col">
                    <div className="mb-6">
                      <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">{user.fullName}</h2>
                      <p className="text-xs font-mono font-bold text-maroon dark:text-golden uppercase tracking-widest mt-1">{user.studentId}</p>
                    </div>
                    <div className="space-y-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex-1">
                      <div>
                        <p className="text-[10px] text-zinc-400 mb-1">Academic Program</p>
                        <p className="text-foreground">{user.program}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400 mb-1">Year Level</p>
                        <p className="text-foreground">Year {user.yearLevel}</p>
                      </div>
                    </div>
                    <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700 flex justify-between items-center">
                      <button
                        onClick={() => setIsIdModalOpen(true)}
                        className="group flex items-center gap-3 hover:opacity-80 transition-opacity w-full justify-between"
                      >
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-maroon dark:group-hover:text-golden transition-colors">View Valid ID</span>
                        <div className="w-8 h-8 rounded-none border-2 border-foreground flex items-center justify-center group-hover:border-maroon dark:group-hover:border-golden transition-colors">
                          <div className="w-4 h-4 bg-foreground group-hover:bg-maroon dark:group-hover:bg-golden transition-colors"></div>
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* ID Modal */}
                {isIdModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
                    <div className="relative w-full max-w-xl">
                      {/* Close Button */}
                      <button
                        onClick={() => setIsIdModalOpen(false)}
                        className="absolute -top-12 right-0 p-2 text-zinc-500 hover:text-foreground transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>

                      {/* Flip Card Container */}
                      <div
                        className="relative w-full aspect-[1.586/1] cursor-pointer group perspective-[2000px]"
                        onClick={() => setIsIdFlipped(!isIdFlipped)}
                      >
                        <div className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${isIdFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                          
                          {/* Front Face */}
                          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white border-2 border-zinc-300 dark:border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="bg-maroon p-3 flex justify-between items-center border-b-2 border-zinc-300 dark:border-zinc-700">
                              <div className="flex items-center gap-3">
                                <img src="/pup-logo.png" alt="PUP Logo" className="w-8 h-8" />
                                <div>
                                  <h3 className="text-[9px] font-heading font-bold text-golden uppercase tracking-widest leading-none mb-1">Republic of the Philippines</h3>
                                  <h2 className="text-xs sm:text-sm font-heading font-bold text-white uppercase tracking-wider leading-none">Polytechnic University of the Philippines</h2>
                                </div>
                              </div>
                            </div>
                            {/* Body */}
                            <div className="flex-1 flex relative bg-[#fdfbf7] dark:bg-[#1a1a1a]">
                              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url(/pup-logo.png)', backgroundPosition: 'center', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }}></div>
                              
                              {/* Left: Photo */}
                              <div className="w-1/3 border-r-2 border-zinc-300 dark:border-zinc-700 p-4 flex flex-col items-center justify-center">
                                <div className="w-full aspect-[3/4] bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 mb-4 flex items-center justify-center relative overflow-hidden">
                                  <User className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <div className="text-center w-full mt-auto">
                                  <div className="border-b-2 border-zinc-800 dark:border-zinc-400 mb-1 h-6 flex items-end justify-center"><span className="text-[8px] font-mono opacity-50 text-black dark:text-white">SIGNATURE</span></div>
                                </div>
                              </div>

                              {/* Right: Details */}
                              <div className="w-2/3 p-5 relative z-10 flex flex-col justify-center">
                                <div className="mb-5">
                                  <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Student Number</p>
                                  <p className="text-xl sm:text-2xl font-mono font-bold text-maroon dark:text-golden">{user.studentId}</p>
                                </div>
                                <div className="mb-5">
                                  <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Full Name</p>
                                  <p className="text-lg sm:text-xl font-heading font-bold text-zinc-900 dark:text-white leading-tight uppercase">{user.fullName}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                  <div>
                                    <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Program</p>
                                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{user.program}</p>
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
                          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white border-2 border-zinc-300 dark:border-zinc-700 shadow-2xl flex flex-col">
                            <div className="bg-zinc-900 h-14 w-full mt-6"></div>
                            <div className="p-6 flex-1 flex text-zinc-900">
                              <div className="w-2/3 pr-6 flex flex-col justify-between">
                                <div>
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-maroon">Conditions of Use</h4>
                                  <p className="text-[9px] leading-relaxed text-zinc-600 mb-4 text-justify">
                                    This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.
                                  </p>
                                </div>
                                <div className="mt-auto">
                                  <p className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">In case of emergency, contact:</p>
                                  <div className="border-b border-zinc-400 h-6"></div>
                                  <div className="border-b border-zinc-400 h-6 mt-2"></div>
                                </div>
                              </div>
                              <div className="w-1/3 flex flex-col items-center justify-center border-l-2 border-dashed border-zinc-300 pl-6">
                                 <div className="w-full aspect-square bg-zinc-100 border-2 border-zinc-300 flex items-center justify-center p-2">
                                   <div className="grid grid-cols-5 grid-rows-5 w-full h-full gap-[1px]">
                                     {Array.from({length: 25}).map((_, i) => (
                                       <div key={i} className={`bg-zinc-900 ${(i * 17 + 5) % 3 === 0 ? 'opacity-100' : 'opacity-0'}`}></div>
                                     ))}
                                   </div>
                                 </div>
                                 <p className="text-[7px] font-mono mt-3 text-zinc-500 text-center tracking-widest">SCAN TO VERIFY</p>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                      <p className="text-center text-xs text-zinc-500 font-bold uppercase tracking-widest mt-8 animate-pulse">Click card to flip</p>
                    </div>
                  </div>
                )}

                <div className="lg:col-span-2 flex flex-col gap-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-zinc-300 dark:border-zinc-800 bg-background shadow-[0_4px_20px_rgba(123,17,19,0.035)] dark:shadow-none">
                    {statCards.map(({ key, label, color }, index) => (
                      <div key={key} className={`p-6 border-zinc-300 dark:border-zinc-800 ${index !== 0 ? 'border-l' : ''} ${index > 1 ? 'border-t lg:border-t-0' : ''}`}>
                        <div className="flex items-center gap-3 mb-4 text-zinc-400">
                          <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
                        </div>
                        <p className={`text-4xl font-heading font-bold ${color}`}>
                          {stats[key]}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Recent Attendance */}
                  <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
                    <CardHeader className="border-b border-zinc-300 dark:border-zinc-800 p-6">
                      <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-maroon dark:text-golden" />
                        Recent Scans
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30">
                              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th>
                              <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Result</th>
                              <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                        {records.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-bold text-foreground">
                              {sectionSubjectName(r.sectionId)}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                               {new Date(r.timestamp).toLocaleDateString()} &mdash; {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <StatusBadge status={r.status} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              {r.status === 'disputed' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                                  <AlertTriangle className="w-3 h-3" />
                                  Disputed
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setDisputeRecord(r); setDisputeReason(''); setDisputeDescription(''); setDisputeFeedback(null) }}
                                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-maroon dark:hover:text-golden transition-colors border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:border-maroon dark:hover:border-golden"
                                >
                                  Report Issue
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {records.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-16 text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                              Audit log is empty
                            </td>
                          </tr>
                        )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* My Subjects Tab */}
          {activeTab === 'subjects' && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
              {sections.map((section) => {
                const subj = api.getSubject(section.subjectId)
                return (
                <Link key={section.id} href={`/student/subjects/${section.id}`} className="block group">
                  <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer flex flex-col h-full">
                    <CardHeader className="pb-4 pt-6 px-6">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1">
                          {subj?.code}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          Sec {section.section}
                        </span>
                      </div>
                      <CardTitle className="text-xl font-heading font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors line-clamp-2 leading-tight">
                        {subj?.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 flex-1 flex flex-col">
                      <div className="space-y-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 flex-1 uppercase tracking-wider">
                        <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2">
                          <span className="text-zinc-400">Instructor</span>
                          <span className="text-foreground text-right">{section.teacherName}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2">
                          <span className="text-zinc-400">Room</span>
                          <span className="text-foreground text-right">{section.room}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-300 dark:border-zinc-800 pb-2">
                          <span className="text-zinc-400">Schedule</span>
                          <span className="text-foreground text-right">
                            {section.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                )
              })}
              {sections.length === 0 && (
                <div className="col-span-full border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
                  <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">Contact your instructor for the subject enrollment code.</p>
                </div>
              )}
            </div>
            </>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">My Weekly Schedule</p>
                  <h2 className="text-xl font-heading font-bold text-foreground">
                    {(() => {
                      const wd = getWeekDays(scheduleDate)
                      const s = wd[0]; const e = wd[6]
                      if (s.getMonth() === e.getMonth()) return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()} - ${e.getDate()}, ${s.getFullYear()}`
                      return `${s.toLocaleDateString('en-US', { month: 'short' })} ${s.getDate()} - ${e.toLocaleDateString('en-US', { month: 'short' })} ${e.getDate()}, ${s.getFullYear()}`
                    })()}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setScheduleDate(new Date())} className="text-[10px] font-bold uppercase tracking-widest rounded-none px-4">Today</Button>
                  <div className="flex items-center border border-zinc-300 dark:border-zinc-700">
                    <Button variant="ghost" size="icon" onClick={() => { const d = new Date(scheduleDate); d.setDate(d.getDate() - 7); setScheduleDate(d) }} className="rounded-none h-8 w-8 border-r border-zinc-300 dark:border-zinc-700"><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { const d = new Date(scheduleDate); d.setDate(d.getDate() + 7); setScheduleDate(d) }} className="rounded-none h-8 w-8"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              {sections.length === 0 ? (
                <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
                  <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                  <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">Enroll in a subject to see your schedule.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const weekDays = getWeekDays(scheduleDate)
                    const today = new Date()
                    const weekRange = getDateRangeForWeek(scheduleDate)
                    const schedEvents = generateStudentEvents(sections, (id) => { const s = api.getSubject(id); return s ? { name: s.name, code: s.code } : undefined }, weekRange.start, weekRange.end)
                    const weekDayEvents = new Map<string, CalendarEvent[]>()
                    for (const day of weekDays) {
                      weekDayEvents.set(formatDate(day), schedEvents.filter((e) => e.date === formatDate(day)))
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                        {weekDays.map((day, i) => {
                          const ds = formatDate(day)
                          const dayEvs = weekDayEvents.get(ds) || []
                          const isT = isSameDay(day, today)
                          return (
                            <div key={i} className={`rounded-none border ${isT ? 'border-maroon dark:border-golden border-t-4 border-t-maroon dark:border-t-golden' : 'border-zinc-300 dark:border-zinc-800'} bg-white dark:bg-zinc-900`}>
                              <div className={`p-3 border-b border-zinc-200 dark:border-zinc-700 ${isT ? 'bg-maroon/5 dark:bg-golden/10' : 'bg-zinc-50 dark:bg-zinc-900/50'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isT ? 'text-maroon dark:text-golden' : 'text-zinc-500'}`}>{getDayName(i)}</p>
                                <p className={`text-lg font-heading font-bold mt-0.5 ${isT ? 'text-maroon dark:text-golden' : 'text-foreground'}`}>{day.getDate()}</p>
                                <p className="text-[9px] text-zinc-400 uppercase tracking-wider mt-0.5">{getDayNameFull(i)}</p>
                              </div>
                              <div className="p-2 space-y-2 min-h-[120px]">
                                {dayEvs.length === 0 ? (
                                  <p className="text-[10px] text-zinc-400 text-center py-4">No classes</p>
                                ) : (
                                  dayEvs.map((ev) => (
                                    <Link key={ev.id} href={`/student/subjects/${ev.sectionId}`} className="block p-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors">
                                      <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 truncate leading-tight">{ev.subjectCode || ev.subjectName}</p>
                                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">{formatTime(ev.startTime)} - {formatTime(ev.endTime)}</p>
                                      {ev.room && <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{ev.room}</p>}
                                      {ev.teacherName && <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">{ev.teacherName}</p>}
                                    </Link>
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </>
              )}
            </>
          )}

          {/* Attendance History Tab */}
          {activeTab === 'attendance' && (
            <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
              <CardHeader className="border-b border-zinc-300 dark:border-zinc-800 p-6">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-4 h-4 text-maroon dark:text-golden" />
                  Full Attendance Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30">
                        <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                        <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th>
                        <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Result</th>
                        <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-foreground">
                            {sectionSubjectName(r.sectionId)}
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                             {new Date(r.timestamp).toLocaleDateString()} &mdash; {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.status === 'disputed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">
                                <AlertTriangle className="w-3 h-3" />
                                Disputed
                              </span>
                            ) : (
                              <button
                                onClick={() => { setDisputeRecord(r); setDisputeReason(''); setDisputeDescription(''); setDisputeFeedback(null) }}
                                className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-maroon dark:hover:text-golden transition-colors border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:border-maroon dark:hover:border-golden"
                              >
                                Report Issue
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            Audit log is empty
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>

              {/* Pagination controls */}
              {attendancePageCount > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/30 gap-4">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                    Showing {attendancePage * ATTENDANCE_PAGE_SIZE + 1} - {Math.min((attendancePage + 1) * ATTENDANCE_PAGE_SIZE, records.length)} of {records.length} scans
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs font-bold uppercase tracking-widest h-8"
                      onClick={() => setAttendancePage(Math.max(0, attendancePage - 1))}
                      disabled={attendancePage === 0}
                    >
                      Prev
                    </Button>
                    {Array.from({ length: attendancePageCount }, (_, i) => (
                      <Button
                        key={i}
                        variant={attendancePage === i ? 'default' : 'outline'}
                        size="sm"
                        className={`rounded-none text-xs font-bold w-8 h-8 p-0 ${attendancePage === i ? 'bg-maroon hover:bg-maroon-dark text-white border-maroon' : 'text-zinc-500 hover:text-foreground'}`}
                        onClick={() => setAttendancePage(i)}
                      >
                        {i + 1}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs font-bold uppercase tracking-widest h-8"
                      onClick={() => setAttendancePage(Math.min(attendancePageCount - 1, attendancePage + 1))}
                      disabled={attendancePage === attendancePageCount - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Dispute Modal */}
          <Dialog open={!!disputeRecord} onOpenChange={(open) => { if (!open) { setDisputeRecord(null); setDisputeFeedback(null) } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dispute Attendance Record</DialogTitle>
                <DialogDescription>
                  Report an issue with this attendance record.
                </DialogDescription>
              </DialogHeader>
              {disputeRecord && (
                <div className="space-y-4 mt-2">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Student:</span> {disputeRecord.studentName}</p>
                    <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Date:</span> {new Date(disputeRecord.timestamp).toLocaleDateString()} at {new Date(disputeRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Session:</span> {sectionSubjectName(disputeRecord.sectionId)}</p>
                    <p><span className="font-bold text-zinc-900 dark:text-zinc-100">Status:</span> <StatusBadge status={disputeRecord.status} /></p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Reason</label>
                    <select
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="w-full h-10 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors"
                    >
                      <option value="">Select a reason</option>
                      <option value="outside_geofence">Wrong location</option>
                      <option value="expired_token">Wrong time</option>
                      <option value="duplicate_submission">I was present</option>
                      <option value="invalid_signature">Technical issue</option>
                      <option value="device_mismatch">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Description</label>
                    <textarea
                      value={disputeDescription}
                      onChange={(e) => setDisputeDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-maroon focus:ring-2 focus:ring-maroon/30 outline-none transition-colors resize-none"
                      placeholder="Describe the issue..."
                    />
                  </div>

                  {disputeFeedback && (
                    <div className={`text-xs font-bold uppercase tracking-widest px-3 py-2 ${disputeFeedback.type === 'success' ? 'text-golden bg-maroon-dark' : 'text-white bg-red-600'}`}>
                      {disputeFeedback.message}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <DialogClose asChild>
                      <Button variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleSubmitDispute}
                      disabled={!disputeReason}
                      className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest"
                    >
                      <Flag className="w-3 h-3 mr-2" />
                      Submit Dispute
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Enroll in Subject Modal */}
          <Dialog open={isEnrollModalOpen} onOpenChange={(open) => { if (!open) setIsEnrollModalOpen(false) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl text-maroon dark:text-golden font-heading font-bold">
                  <GraduationCap className="w-5 h-5 text-maroon dark:text-golden" />
                  Enroll in a Subject
                </DialogTitle>
                <DialogDescription>
                  Enter the enrollment code provided by your instructor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {enrollSuccess ? (
                  <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-green-700 dark:text-green-300">Successfully enrolled!</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">You can now access your new subject from the dashboard.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleEnrollSubmit} className="space-y-4">
                    <div>
                      <Input
                        value={enrollCode}
                        onChange={(e) => setEnrollCode(e.target.value)}
                        placeholder="Enter enrollment code"
                        className="text-lg text-center tracking-widest font-mono uppercase rounded-none h-12"
                        autoFocus
                      />
                    </div>

                    {enrollError && (
                      <div className="border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 dark:text-red-400">{enrollError}</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                      <DialogClose asChild>
                        <Button type="button" variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest h-10">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={enrollLoading} className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest h-10 px-6">
                        {enrollLoading ? 'Enrolling...' : 'Enroll'}
                      </Button>
                    </div>
                  </form>
                )}

                {enrollSuccess && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setIsEnrollModalOpen(false)} className="rounded-none bg-maroon text-white hover:bg-maroon-dark text-xs font-bold uppercase tracking-widest h-10 px-6">
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
