'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/mock-api'
import type { Student, Section, AttendanceRecord } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  MapPin,
  X,
} from 'lucide-react'

type NavTab = 'dashboard' | 'subjects' | 'attendance'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'subjects', label: 'My Subjects', icon: BookOpen },
  { key: 'attendance', label: 'Attendance History', icon: Clock },
] as const

const statCards = [
  { key: 'present', label: 'Present', color: 'text-golden' },
  { key: 'late', label: 'Late', color: 'text-maroon' },
  { key: 'absent', label: 'Absent', color: 'text-maroon-dark' },
] as const

export default function StudentDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [isIdModalOpen, setIsIdModalOpen] = useState(false)
  const [isIdFlipped, setIsIdFlipped] = useState(false)

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

  if (!user) return null

  const stats = {
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
  }

  return (
    <div className="min-h-screen flex bg-background selection:bg-golden selection:text-maroon">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
        <div className="p-6 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">
              Polycheck
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">Student</p>
          </div>
          {/* Minimal Star motif from PUP logo */}
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
             <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-golden dark:border-b-maroon-dark relative before:content-[''] before:absolute before:-top-[4px] before:-left-[8px] before:w-0 before:h-0 before:border-l-[8px] before:border-l-transparent before:border-r-[8px] before:border-r-transparent before:border-t-[14px] before:border-t-golden dark:before:border-t-maroon-dark"></div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col">
            {navItems.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as NavTab)}
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
              <div className="grid lg:grid-cols-3 gap-8 mb-8">
                {/* Digital ID Card */}
                <Card className="lg:col-span-1 rounded-none border-zinc-300 dark:border-zinc-800 shadow-none overflow-hidden flex flex-col relative bg-zinc-50 dark:bg-zinc-900/50">
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
                                       <div key={i} className={`bg-zinc-900 ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`}></div>
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
                  <div className="grid grid-cols-3 gap-0 border border-zinc-300 dark:border-zinc-800 bg-background">
                    {statCards.map(({ key, label, color }, index) => (
                      <div key={key} className={`p-6 border-zinc-300 dark:border-zinc-800 ${index !== 0 ? 'border-l' : ''}`}>
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
                  <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none bg-zinc-50 dark:bg-zinc-900/20 flex-1">
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
                            <tr className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30">
                              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                              <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th>
                              <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.slice(0, 5).map((r) => (
                              <tr
                                key={r.id}
                                className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                              >
                                <td className="px-6 py-4">
                                  <span className="font-bold text-foreground">
                    {sectionSubjectName(r.sectionId)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                  {new Date(r.timestamp).toLocaleDateString()} at {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <StatusBadge status={r.status} />
                                </td>
                              </tr>
                            ))}
                            {records.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm font-bold uppercase tracking-widest">
                                  No scan history available
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
            <div className="grid gap-6 sm:grid-cols-2">
              {sections.map((section) => {
                const subj = api.getSubject(section.subjectId)
                return (
                <Link key={section.id} href={`/student/subjects/${section.id}`} className="block group">
                  <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-l-4 border-l-maroon dark:border-l-golden shadow-none hover:border-maroon dark:hover:border-golden transition-colors bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer flex flex-col h-full">
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
          )}

          {/* Attendance History Tab */}
          {activeTab === 'attendance' && (
            <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none bg-zinc-50 dark:bg-zinc-900/20">
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
                      <tr className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30">
                        <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                        <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th>
                        <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
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
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-16 text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            Audit log is empty
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
