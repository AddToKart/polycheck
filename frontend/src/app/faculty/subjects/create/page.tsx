'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, MapPin, CalendarDays } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

export default function CreateSubjectPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState('2nd Semester AY 2025-2026')
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
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

  const toggleDay = (day: string) => {
    const next = new Set(selectedDays)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    setSelectedDays(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
                          selectedDays.has(day)
                            ? 'bg-maroon text-white dark:bg-maroon dark:text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
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
