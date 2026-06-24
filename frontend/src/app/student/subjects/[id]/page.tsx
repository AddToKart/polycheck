'use client'
/* eslint-disable */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CalendarDays, MapPin, User, GraduationCap, Clock, LogOut } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { Student, Section } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/sidebar'

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
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar user={{ ...user, email: user.email || '' } as any} onLogout={handleLogout} backHref="/student/dashboard" backLabel="Back to Dashboard" />

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
