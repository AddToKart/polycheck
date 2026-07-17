'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, MapPin, CalendarDays, Plus, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const SEMESTERS = [
  '1st Semester',
  '2nd Semester',
  'Summer',
] as const

function getCurrentAY() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function generateEnrollmentCode(subjectName: string) {
  const prefix = subjectName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4)
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${suffix}`
}

interface ScheduleEntry {
  day: string
  startTime: string
  endTime: string
  room: string
}

function CreateSectionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subjectId = searchParams.get('subjectId')
  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState(`1st Semester AY ${getCurrentAY()}`)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [currentDay, setCurrentDay] = useState('Mon')
  const [currentStartTime, setCurrentStartTime] = useState('09:00')
  const [currentEndTime, setCurrentEndTime] = useState('10:30')
  const [currentScheduleRoom, setCurrentScheduleRoom] = useState('')

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'teacher') {
      router.push(cu?.role === 'super_admin' ? '/faculty/subjects' : '/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!subjectId) return
    const fn = async () => {
      const subj = await api.getSubject(subjectId)
      if (!subj) {
        router.push('/faculty/subjects')
        return
      }
      setSubject(subj)
    }
    fn()
  }, [subjectId, router])

  const enrollmentCode = useMemo(() => {
    if (!subject) return ''
    return generateEnrollmentCode(subject.name)
  }, [subject])

  if (!user || !subject) return null

  const handleAddSchedule = () => {
    if (!currentDay || !currentStartTime || !currentEndTime) return
    setSchedule([
      ...schedule,
      {
        day: currentDay,
        startTime: currentStartTime,
        endTime: currentEndTime,
        room: currentScheduleRoom,
      },
    ])
    setCurrentScheduleRoom('')
  }

  const handleRemoveSchedule = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!section || !room || !semester || schedule.length === 0) return
    await api.createSection({
      subjectId: subject.id,
      section,
      room,
      schedule: schedule.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room || undefined,
      })),
      semester,
    })
    router.push('/faculty/subjects/' + subject.id)
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar
        user={user}
        onLogout={handleLogout}
        backHref={`/faculty/subjects/${subject.id}`}
        backLabel="Back to Subject"
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-8">Create Section</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Parent Subject Context */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <BookOpen className="w-5 h-5 text-maroon" />
                  Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  {subject.name}{' '}
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">({subject.code})</span>
                </p>
              </CardContent>
            </Card>

            {/* Section Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <MapPin className="w-5 h-5 text-maroon" />
                  Section Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <Input
                      id="section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. A"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">Room</Label>
                    <Input
                      id="room"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="e.g. CCIS Lab 3"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <select
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                    required
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={`${sem} AY ${getCurrentAY()}`}>
                        {sem} AY {getCurrentAY()}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Schedule Builder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <CalendarDays className="w-5 h-5 text-maroon" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Schedule Entry Form */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <select
                      value={currentDay}
                      onChange={(e) => setCurrentDay(e.target.value)}
                      className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start</Label>
                    <Input type="time" value={currentStartTime} onChange={(e) => setCurrentStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input type="time" value={currentEndTime} onChange={(e) => setCurrentEndTime(e.target.value)} />
                  </div>
                  <Button type="button" variant="default" size="sm" className="rounded-none h-10 w-full col-span-3 sm:col-span-1" onClick={handleAddSchedule}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Room (per schedule entry, optional)</Label>
                  <Input
                    value={currentScheduleRoom}
                    onChange={(e) => setCurrentScheduleRoom(e.target.value)}
                    placeholder="e.g. CCIS Lab 3"
                  />
                </div>

                {/* Schedule List */}
                {schedule.length > 0 ? (
                  <div className="space-y-2">
                    {schedule.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-white dark:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-bold text-maroon dark:text-golden uppercase w-10">{entry.day}</span>
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {entry.startTime} - {entry.endTime}
                          </span>
                          {entry.room && (
                            <span className="text-zinc-500 dark:text-zinc-400 text-xs">({entry.room})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSchedule(i)}
                          className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs uppercase tracking-widest text-zinc-400 text-center py-4">
                    No schedule entries added yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Enrollment Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <BookOpen className="w-5 h-5 text-maroon" />
                  Enrollment Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Auto-generated Code</Label>
                  <div className="font-mono text-lg font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-zinc-800 dark:text-zinc-200 select-all">
                    {enrollmentCode}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Students will use this code to enroll in this section. Generated from subject name.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!section || !room || schedule.length === 0}>
                Create Section
              </Button>
              <Button variant="ghost" asChild>
                <Link href={`/faculty/subjects/${subject.id}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default function CreateSectionPage() {
  return (
    <Suspense fallback={null}>
      <CreateSectionForm />
    </Suspense>
  )
}
