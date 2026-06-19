'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, MapPin, CalendarDays, Plus, X, ArrowRight } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export default function CreateSubjectPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState('2nd Semester AY 2025-2026')
  const [schedule, setSchedule] = useState<{ day: string; startTime: string; endTime: string; room: string }[]>([])
  const [tempDay, setTempDay] = useState('Mon')
  const [tempStartTime, setTempStartTime] = useState('09:00')
  const [tempEndTime, setTempEndTime] = useState('10:30')
  const [tempRoom, setTempRoom] = useState('')
  const [latitude, setLatitude] = useState(14.5863)
  const [longitude, setLongitude] = useState(120.9777)
  const [radius, setRadius] = useState(40)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  if (!user) return null

  const addScheduleEntry = () => {
    setSchedule([...schedule, { day: tempDay, startTime: tempStartTime, endTime: tempEndTime, room: tempRoom }])
  }

  const removeScheduleEntry = (idx: number) => {
    setSchedule(schedule.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (schedule.length === 0) return
    const subj = api.createSubject({ name, code })
    api.createSection({
      subjectId: subj.id,
      section,
      room,
      schedule,
      semester,
      teacherId: user.id,
      teacherName: user.fullName,
    })
    router.push('/faculty/subjects')
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/subjects" backLabel="Back to Subjects" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-8">Create Subject</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <BookOpen className="w-5 h-5 text-maroon" />
                  Subject Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Subject Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. CCIS 3104"
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <Input
                      id="section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
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
                  >
                    <option>1st Semester AY 2025-2026</option>
                    <option>2nd Semester AY 2025-2026</option>
                    <option>Summer AY 2025-2026</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <CalendarDays className="w-5 h-5 text-maroon" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedule.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5"
                  >
                    <span className="px-2.5 py-1 bg-maroon dark:bg-golden text-white dark:text-maroon text-xs font-bold leading-none uppercase">
                      {entry.day}
                    </span>
                    <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                      {entry.startTime} — {entry.endTime}
                    </span>
                    {entry.room && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">{entry.room}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeScheduleEntry(idx)}
                      className="ml-auto p-1 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Day</Label>
                      <select
                        value={tempDay}
                        onChange={(e) => setTempDay(e.target.value)}
                        className="h-9 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                      >
                        {daysOfWeek.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Start</Label>
                      <Input
                        type="time"
                        value={tempStartTime}
                        onChange={(e) => setTempStartTime(e.target.value)}
                        className="h-9 w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-500">End</Label>
                      <Input
                        type="time"
                        value={tempEndTime}
                        onChange={(e) => setTempEndTime(e.target.value)}
                        className="h-9 w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Room</Label>
                      <Input
                        value={tempRoom}
                        onChange={(e) => setTempRoom(e.target.value)}
                        placeholder="e.g. Room 205"
                        className="h-9 w-28"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addScheduleEntry}
                      className="h-9 px-3 bg-maroon dark:bg-golden text-white dark:text-maroon text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                  <MapPin className="w-5 h-5 text-maroon" />
                  Geofence Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Drag the pin to set the attendance location. Adjust the radius with the slider.
                </p>
                <MapPicker
                  latitude={latitude}
                  longitude={longitude}
                  radius={radius}
                  onChange={(lat, lng, rad) => {
                    setLatitude(lat)
                    setLongitude(lng)
                    setRadius(rad)
                  }}
                />
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="default">
                Create Subject
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/faculty/subjects">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
