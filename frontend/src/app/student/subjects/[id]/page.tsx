'use client'
/* eslint-disable */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, CalendarDays, MapPin, User, GraduationCap, Clock, LogOut, Plus, Camera, Play, Crown } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { Student, Section, Session, SectionRole } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/layout/sidebar'

export default function StudentSubjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<Student | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [roles, setRoles] = useState<SectionRole[]>([])
  const [hasPermission, setHasPermission] = useState(false)
  const [subject, setSubject] = useState<{ name: string; code: string } | null>(null)

  useEffect(() => {
    const fn = async () => {
      const cu = api.getCurrentUser()
      if (!cu || cu.role !== 'student') {
        router.push('/')
        return
      }
      const student = cu as Student
      setUser(student)
      const studentRoles = await api.getStudentRoles(student.id)
      setRoles(studentRoles)
      if (studentRoles.find(r => r.sectionId === id && r.role === 'president')) {
        const perm = await api.checkSessionPermission(id, student.id)
        setHasPermission(perm)
      }
    }
    fn()
  }, [router, id])

  useEffect(() => {
    if (!id) return
    const fn = async () => {
      const sec = await api.getSection(id)
      if (sec) {
        setSection(sec)
        const subj = await api.getSubject(sec.subjectId)
        if (subj) setSubject({ name: subj.name, code: subj.code })
      }
      const sess = await api.getSessions(id)
      setSessions(sess)
      if (user) {
        const perm = await api.checkSessionPermission(user.id, id)
        setHasPermission(perm)
      }
    }
    fn()
  }, [id, user?.id])

  if (!user || !section) return null
  const studentRoles = roles.filter(r => r.sectionId === id)
  const isPresident = studentRoles.some(r => r.role === 'president')
  const isQac = studentRoles.some(r => r.role === 'qac')

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

          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{subject?.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{subject?.code} &middot; Section {section.section}</p>

          {/* Role Badges */}
          {studentRoles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {isPresident && (
                <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
                  <Crown className="w-3 h-3" /> President
                </span>
              )}
              {isQac && (
                <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 bg-maroon-dark text-golden border border-golden">
                  <Camera className="w-3 h-3" /> QAC
                </span>
              )}
            </div>
          )}

          {/* President - Create Session Button */}
          {isPresident && (
            <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-maroon dark:text-golden" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Section President</p>
                      <p className="text-xs text-zinc-500">
                        {hasPermission
                          ? 'You have permission to create sessions for this section'
                          : 'No active session permission. Ask your teacher to grant it.'}
                      </p>
                    </div>
                  </div>
                  {hasPermission && (
                    <Button className="bg-maroon hover:bg-maroon-dark text-white" size="sm" onClick={() => router.push(`/student/subjects/${id}/create-session`)}>
                      <Plus className="w-4 h-4 mr-1" /> Create Session
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Sessions List */}
          <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Play className="w-4 h-4 text-maroon dark:text-golden" /> Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">No sessions yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((session) => (
                    <Link
                      key={session.id}
                      href={`/student/subjects/${id}/sessions/${session.id}`}
                      className="block bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-maroon/30 dark:hover:border-golden/30 transition-colors p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-zinc-500">{session.startTime} - {session.endTime}{session.room ? ` · ${session.room}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.isActive && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                          <span className="text-[10px] text-zinc-400">{session.isActive ? 'Active' : 'Completed'}</span>
                          {isQac && (
                            <span className="flex items-center gap-1 text-[10px] text-maroon dark:text-golden font-medium">
                              <Camera className="w-3 h-3" /> Upload
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
