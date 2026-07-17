'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, MapPin } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Subject, Section, Session } from '@polycheck/shared'
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
  const [sections, setSections] = useState<Section[]>([])

  const [subjectId, setSubjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [gracePeriod, setGracePeriod] = useState(15)
  const [qrValidity, setQrValidity] = useState(20)
  const [latitude, setLatitude] = useState(14.5863)
  const [longitude, setLongitude] = useState(120.9777)
  const [radius, setRadius] = useState(40)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 4)
    return d.toISOString().slice(0, 10)
  })
  const [bulkDays, setBulkDays] = useState<string[]>([])
  const [isRescheduled, setIsRescheduled] = useState(false)
  const [rescheduledFromDate, setRescheduledFromDate] = useState('')
  const [existingSessionOnDate, setExistingSessionOnDate] = useState<Session | null>(null)
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  useEffect(() => {
    if (!bulkMode && sectionId && date) {
      api.getSessions(sectionId).then((sessions) => {
        setExistingSessionOnDate(sessions.find((s) => s.date === date) ?? null)
      })
    } else {
      setExistingSessionOnDate(null)
    }
  }, [bulkMode, sectionId, date])

  useEffect(() => {
    const init = async () => {
      const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'teacher') {
      router.push(cu?.role === 'super_admin' ? '/faculty/sessions' : '/')
        return
      }
      setUser(cu)
      setSubjects(await api.getSubjects())
      const allSections = await api.getSections()
      setSections(allSections.filter((s) => s.teacherId === cu.id))
    }
    init()
  }, [router])

  useEffect(() => {
    setSectionId('')
  }, [subjectId])

  const selectedSection = sections.find((s) => s.id === sectionId)
  const selectedSubject = subjects.find((s) => s.id === subjectId)

  const hasDuplicateConflict = !!existingSessionOnDate && !isRescheduled

  useEffect(() => {
    if (selectedSection) {
      const scheduleDays = selectedSection.schedule.map((s) => s.day)
      setBulkDays(scheduleDays)
      setRoom(selectedSection.room || '')
      setIsRescheduled(false)
      setRescheduledFromDate('')
    }
  }, [selectedSection])

  const getStandardReplaceDates = () => {
    if (!selectedSection) return []
    const dates: { dateStr: string; label: string; scheduleTime: string; room?: string }[] = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    // Check next 14 days
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dayName = dayNames[d.getDay()]
      const sched = selectedSection.schedule.find((s) => s.day === dayName)
      if (sched) {
        const dateStr = d.toISOString().slice(0, 10)
        const dateLabel = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        dates.push({
          dateStr,
          label: `${dateLabel} (${sched.startTime} - ${sched.endTime})`,
          scheduleTime: `${sched.startTime} - ${sched.endTime}`,
          room: selectedSection.room || undefined,
        })
      }
    }
    return dates
  }

  const calculateBulkCount = () => {
    if (!bulkStartDate || !bulkEndDate || bulkDays.length === 0) return 0
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
    const targetDays = bulkDays.map((d) => dayMap[d])
    const start = new Date(bulkStartDate)
    const end = new Date(bulkEndDate)
    let count = 0
    const cursor = new Date(start)
    while (cursor <= end) {
      if (targetDays.includes(cursor.getDay())) count++
      cursor.setDate(cursor.getDate() + 1)
    }
    return count
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection || !selectedSubject || !user) return
    if (bulkMode) {
      const count = calculateBulkCount()
      if (count === 0) return
      await api.createBulkSessions({
        sectionId: selectedSection.id,
        subjectName: selectedSubject.name,
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        daysOfWeek: bulkDays,
        startTime,
        endTime,
        room: room || undefined,
        qrValidityMinutes: qrValidity,
        gracePeriodMinutes: gracePeriod,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: user.id,
      })
      alert(`Created ${count} sessions successfully!`)
      router.push('/faculty/sessions')
    } else {
      const replaceDates = getStandardReplaceDates()
      const selectedReplaceOption = replaceDates.find((d) => d.dateStr === rescheduledFromDate)

      await api.createSession({
        sectionId: selectedSection.id,
        subjectName: selectedSubject.name,
        date,
        startTime,
        endTime,
        room: room || undefined,
        qrValidityMinutes: qrValidity,
        gracePeriodMinutes: gracePeriod,
        geofence: {
          latitude,
          longitude,
          radiusMeters: radius,
        },
        teacherId: user.id,
        isRescheduled: isRescheduled || undefined,
        rescheduledFromDate: isRescheduled ? rescheduledFromDate : undefined,
        originalScheduleTime: isRescheduled ? selectedReplaceOption?.scheduleTime : undefined,
        originalRoom: isRescheduled ? selectedReplaceOption?.room : undefined,
      })
      router.push('/faculty/sessions')
    }
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
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

                {/* Duplicate session warning */}
                {hasDuplicateConflict && (
                  <div className="flex items-start gap-3 p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500">
                    <CalendarCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-0.5">Session Conflict Detected</p>
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        A session already exists for this section on <strong>{date}</strong> (Session ID: {existingSessionOnDate?.id}). Creating another may cause duplicate attendance records. Use &quot;Reschedule&quot; instead, or change the date.
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <select
                    id="subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select a subject...</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {subj.name} ({subj.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <select
                    id="section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    disabled={!subjectId}
                    className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select a section...</option>
                    {sections
                      .filter((s) => s.subjectId === subjectId)
                      .map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.section} &mdash; {sec.room} &mdash; {sec.schedule.map((d) => d.day).join(', ')}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Bulk Create Toggle */}
                <div className="flex items-center gap-3 py-3 border-t border-zinc-200 dark:border-zinc-700">
                  <input
                    id="bulkMode"
                    type="checkbox"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    className="accent-maroon h-4 w-4"
                  />
                  <Label htmlFor="bulkMode" className="cursor-pointer">Create recurring sessions for the semester</Label>
                </div>

                {bulkMode ? (
                  <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Create sessions for all selected days between the start and end dates.</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bulkStartDate">Start Date</Label>
                        <Input id="bulkStartDate" type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bulkEndDate">End Date</Label>
                        <Input id="bulkEndDate" type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="flex flex-wrap gap-3">
                        {ALL_DAYS.map((day) => {
                          const selected = bulkDays.includes(day)
                          return (
                            <label key={day} className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs cursor-pointer transition-colors ${selected ? 'bg-maroon text-white border-maroon dark:bg-golden dark:text-maroon dark:border-golden' : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400'}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setBulkDays((prev) => selected ? prev.filter((d) => d !== day) : [...prev, day])
                                }}
                                className="sr-only"
                              />
                              {day}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-maroon dark:text-golden font-semibold">
                      {calculateBulkCount()} session{calculateBulkCount() !== 1 ? 's' : ''} will be created
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </div>

                    {selectedSection && selectedSection.schedule.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-3">
                          <input
                            id="isRescheduled"
                            type="checkbox"
                            checked={isRescheduled}
                            onChange={(e) => {
                              setIsRescheduled(e.target.checked)
                              if (e.target.checked) {
                                const dates = getStandardReplaceDates()
                                if (dates.length > 0) {
                                  setRescheduledFromDate(dates[0].dateStr)
                                }
                              } else {
                                setRescheduledFromDate('')
                              }
                            }}
                            className="accent-maroon h-4 w-4"
                          />
                          <Label htmlFor="isRescheduled" className="cursor-pointer font-bold text-maroon dark:text-golden">
                            Reschedule a standard class slot
                          </Label>
                        </div>

                        {isRescheduled && (
                          <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700">
                            <Label htmlFor="replaceDate">Standard class slot to replace</Label>
                            <select
                              id="replaceDate"
                              value={rescheduledFromDate}
                              onChange={(e) => setRescheduledFromDate(e.target.value)}
                              className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                              required={isRescheduled}
                            >
                              <option value="">Select standard slot...</option>
                              {getStandardReplaceDates().map((d) => (
                                <option key={d.dateStr} value={d.dateStr}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-zinc-500 mt-1">
                              The selected standard slot will be visually marked as &quot;MOVED&quot; for students.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

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
                      <Label htmlFor="qrValidity">QR Validity (default)</Label>
                      <Badge variant="default">{qrValidity} min</Badge>
                    </div>
                    <input
                      id="qrValidity"
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={qrValidity}
                      onChange={(e) => setQrValidity(Number(e.target.value))}
                      className="w-full accent-maroon"
                    />
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>5 min</span>
                      <span>60 min</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Students scanned within this window are Present. After expiry, scans are Late.</p>
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
              <Button type="submit" disabled={!selectedSection || !selectedSubject || (bulkMode && calculateBulkCount() === 0) || hasDuplicateConflict}>
                {bulkMode ? `Create ${calculateBulkCount()} Sessions` : 'Create Session'}
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
