'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, MapPin } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Section, Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export default function StudentCreateSessionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [gracePeriod, setGracePeriod] = useState(15)
  const [qrValidity, setQrValidity] = useState(20)
  const [latitude, setLatitude] = useState(14.5863)
  const [longitude, setLongitude] = useState(120.9777)
  const [radius, setRadius] = useState(40)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  useEffect(() => {
    if (!id) return
    const fn = async () => {
      const sec = await api.getSection(id)
      if (sec) {
        setSection(sec)
        const subj = await api.getSubject(sec.subjectId)
        setSubject(subj ?? null)
        setRoom(sec.room || '')
      }
    }
    fn()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!section || !subject || !user) return

    const hasPerm = await api.checkSessionPermission(id, user.id)
    if (!hasPerm) {
      alert('Your session creation permission has expired. Ask your teacher to grant a new one.')
      return
    }

    await api.createSession({
      sectionId: section.id,
      subjectName: subject.name,
      date,
      startTime,
      endTime,
      room: room || undefined,
      qrValidityMinutes: qrValidity,
      gracePeriodMinutes: gracePeriod,
      geofence: { latitude, longitude, radiusMeters: radius },
      teacherId: section.teacherId,
    })
    alert('Session created successfully!')
    router.push(`/student/subjects/${id}`)
  }

  const handleLogout = () => { api.logout(); router.push('/') }

  if (!user || !section) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={{ ...user, email: '' } as any} onLogout={handleLogout} backHref={`/student/subjects/${id}`} backLabel="Back to Subject" />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" className="text-maroon dark:text-golden text-sm" onClick={() => router.push(`/student/subjects/${id}`)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>

          <h1 className="text-3xl font-heading font-bold text-maroon dark:text-white mb-2">Create Session</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{subject?.name} &middot; Section {section.section}</p>

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
                      type="range" min={0} max={30} step={5}
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
                      <Label htmlFor="qrValidity">QR Validity</Label>
                      <Badge variant="default">{qrValidity} min</Badge>
                    </div>
                    <input
                      id="qrValidity"
                      type="range" min={5} max={60} step={5}
                      value={qrValidity}
                      onChange={(e) => setQrValidity(Number(e.target.value))}
                      className="w-full accent-maroon"
                    />
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>5 min</span>
                      <span>60 min</span>
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
                  Set the attendance location and radius.
                </p>
                <MapPicker
                  latitude={latitude}
                  longitude={longitude}
                  radius={radius}
                  onChange={(lat, lng, rad) => { setLatitude(lat); setLongitude(lng); setRadius(rad) }}
                />
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit" className="bg-maroon hover:bg-maroon-dark text-white">
                Create Session
              </Button>
              <Button variant="ghost" asChild>
                <Link href={`/student/subjects/${id}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
