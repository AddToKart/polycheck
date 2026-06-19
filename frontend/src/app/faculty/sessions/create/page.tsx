'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, MapPin } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export default function CreateSessionPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [gracePeriod, setGracePeriod] = useState(15)
  const [tokenWindow, setTokenWindow] = useState(180)
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
    setSubjects(api.getSubjects(cu.id))
  }, [router])

  if (!user) return null

  const selectedSubject = subjects.find((s) => s.id === subjectId)

  const handleSubjectChange = (id: string) => {
    setSubjectId(id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubject) return
    api.createSession({
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      date,
      startTime,
      endTime,
      room: room || undefined,
      gracePeriodMinutes: gracePeriod,
      tokenWindowSeconds: tokenWindow,
      geofence: {
        latitude,
        longitude,
        radiusMeters: radius,
      },
      teacherId: user.id,
    })
    router.push('/faculty/sessions')
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/sessions" backLabel="Back to Sessions" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-8">Create Session</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-maroon" />
                  Session Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <select
                    id="subject"
                    value={subjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select a subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) - Section {s.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. CCIS Lab 3" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="gracePeriod">Grace Period</Label>
                      <Badge variant="default">{gracePeriod} min</Badge>
                    </div>
                    <input
                      id="gracePeriod"
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={gracePeriod}
                      onChange={(e) => setGracePeriod(Number(e.target.value))}
                      className="w-full accent-maroon"
                    />
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>0 min</span>
                      <span>30 min</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tokenWindow">Token Window</Label>
                      <Badge variant="default">{tokenWindow}s</Badge>
                    </div>
                    <input
                      id="tokenWindow"
                      type="range"
                      min={60}
                      max={600}
                      step={30}
                      value={tokenWindow}
                      onChange={(e) => setTokenWindow(Number(e.target.value))}
                      className="w-full accent-maroon"
                    />
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>60s</span>
                      <span>600s</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-maroon" />
                  Geofence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Drag the pin to set the attendance location. Radius controls how close students must be.
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
              <Button type="submit" disabled={!selectedSubject}>
                Create Session
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/faculty/sessions">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
