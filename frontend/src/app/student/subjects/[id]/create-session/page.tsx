'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, MapPin } from 'lucide-react'
import { api } from '@/lib/api-client'
import { formatCampusDate, type User, type Section, type Subject } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function StudentCreateSessionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)

  const [date, setDate] = useState(() => formatCampusDate())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [latitude, setLatitude] = useState(14.8697)
  const [longitude, setLongitude] = useState(120.9991)
  const [radius, setRadius] = useState(40)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
        if (sec.schedule.length > 0) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          const currentDay = dayNames[new Date(`${date}T00:00:00`).getDay()]
          const matchedSched = sec.schedule.find((s) => s.day === currentDay) ?? sec.schedule[0]
          if (matchedSched) {
            setStartTime(matchedSched.startTime)
            setEndTime(matchedSched.endTime)
          }
        }
      }
    }
    fn()
  }, [id])

    const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime)
    if (formError) setFormError(null)
    if (newStartTime && endTime <= newStartTime) {
      const [h, m] = newStartTime.split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        const totalMinutes = h * 60 + m + 90
        const newH = Math.min(23, Math.floor(totalMinutes / 60))
        const newM = totalMinutes % 60
        const autoEnd = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
        if (autoEnd > newStartTime) {
          setEndTime(autoEnd)
        }
      }
    }
  }

  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime)
    if (formError) setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!section || !subject || !user || submitting) return
    if (endTime <= startTime) {
      setFormError('End time must be after start time.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const hasPerm = await api.checkSessionPermission(id, user.id)
      if (!hasPerm) {
        setFormError('Your session creation permission has expired. Ask your teacher to grant a new one.')
        return
      }

      await api.createSession({
        sectionId: section.id,
        subjectName: subject.name,
        date,
        startTime,
        endTime,
        room: room || undefined,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: section.teacherId,
      })
      alert('Session created successfully!')
      router.push(`/student/subjects/${id}`)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unable to create session. Please check your inputs.')
    } finally {
      setSubmitting(false)
    }
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
                    <Input id="startTime" type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input id="endTime" type="time" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} required />
                  </div>
                </div>
                {endTime <= startTime && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    End time must be after start time.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. CCIS Lab 3" />
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
