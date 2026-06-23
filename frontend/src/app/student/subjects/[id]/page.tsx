'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CalendarDays, MapPin, User, GraduationCap, Clock, LogOut } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { Student, Section } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

export default function StudentSubjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<Student | null>(null)
  const [section, setSection] = useState<Section | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') {
      router.push('/')
      return
    }
    setUser(cu as Student)
  }, [router])

  useEffect(() => {
    if (!id) return
    const sec = api.getSection(id)
    if (sec) setSection(sec)
  }, [id])

  if (!user || !section) return null

  const subj = api.getSubject(section.subjectId)

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
        <div className="p-6 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">Polycheck</h1>
            <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">Student</p>
          </div>
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
             <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-golden dark:border-b-maroon-dark relative before:content-[''] before:absolute before:-top-[4px] before:-left-[8px] before:w-0 before:h-0 before:border-l-[8px] before:border-l-transparent before:border-r-[8px] before:border-r-transparent before:border-t-[14px] before:border-t-golden dark:before:border-t-maroon-dark"></div>
          </div>
        </div>
        <div className="flex-1 py-4">
          <button
            onClick={() => router.push('/student/dashboard')}
            className="flex items-center gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-l-4 border-maroon dark:border-golden bg-zinc-100 dark:bg-zinc-900 text-maroon dark:text-golden w-full text-left"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
        <div className="p-6 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Appearance</p>
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
            <LogOut className="w-4 h-4" /> Disconnect
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" asChild className="text-maroon dark:text-golden text-sm">
              <button onClick={() => router.push('/student/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> My Subjects
              </button>
            </Button>
          </div>

          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{subj?.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{subj?.code} &middot; Section {section.section}</p>

          <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-maroon dark:text-golden" /> Subject Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Instructor</p>
                    <p className="text-sm font-bold text-foreground">{section.teacherName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Room</p>
                    <p className="text-sm font-bold text-foreground">{section.room}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <GraduationCap className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Semester</p>
                    <p className="text-sm font-bold text-foreground">{section.semester}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-zinc-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Schedule</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {section.schedule.map((sd, i) => (
                        <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-maroon dark:text-golden px-2 py-0.5 border border-zinc-200 dark:border-zinc-700">
                          {sd.day} {sd.startTime}-{sd.endTime}{sd.room ? ` (${sd.room})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
