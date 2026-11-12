'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, MapPin, ShieldCheck, School, Video } from 'lucide-react'
import { api, requestUserLogout } from '@/lib/api-client'
import { describeMutationError } from '@/lib/run-mutation'
import { createLatestRequestGuard, runLatest } from '@/lib/latest-request'
import { ErrorDisplay } from '@/lib/hooks'
import {
  formatCampusDate,
  sectionCourseLabel,
  type User,
  type Subject,
  type Section,
  type Session,
  type SessionMode,
} from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import MapPicker from '@/components/MapPicker'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CUSTOM_SLOT_VALUE,
  buildBulkRows,
  buildBulkSlots,
  countSlotOccurrences,
  defaultSlotSelection,
  firstInvalidSlotRow,
  nextOccurrenceDate,
  slotLabel,
  slotSelectionForDate,
  type BulkSlotRow,
  type SessionSlot,
} from '@/lib/session-slots'

export default function CreateSessionPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])

  const [subjectId, setSubjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(() => formatCampusDate())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [mode, setMode] = useState<SessionMode>('in_person')
  const [latitude, setLatitude] = useState(14.8697)
  const [longitude, setLongitude] = useState(120.9991)
  const [radius, setRadius] = useState(40)
  const [defaultQrValidity, setDefaultQrValidity] = useState(5)
  const [defaultGracePeriod, setDefaultGracePeriod] = useState(15)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStartDate, setBulkStartDate] = useState(() => formatCampusDate())
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 4)
    return formatCampusDate(d)
  })
  const [bulkDays, setBulkDays] = useState<string[]>([])
  const [bulkRows, setBulkRows] = useState<BulkSlotRow[]>([])
  const [slotSelection, setSlotSelection] = useState<string>(CUSTOM_SLOT_VALUE)
  const [isRescheduled, setIsRescheduled] = useState(false)
  const [rescheduledFromDate, setRescheduledFromDate] = useState('')
  const [existingSessionOnDate, setExistingSessionOnDate] = useState<Session | null>(null)
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(null)
  const duplicateGuardRef = useRef(createLatestRequestGuard())
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initRetry, setInitRetry] = useState(0)
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // The section-selection effect below initializes times based on the date that
  // is current when a section is chosen. Read the latest date through a ref so
  // that later date edits (handled by handleDateChange) do not re-run that
  // one-time initialization.
  const dateRef = useRef(date)
  useEffect(() => {
    dateRef.current = date
  }, [date])

  useEffect(() => {
    // Sequence guard (DD-W27): every dep change invalidates the previous
    // request, so a stale response can never leave a phantom conflict that
    // permanently blocks submit.
    const guard = duplicateGuardRef.current
    if (bulkMode || !sectionId || !date) {
      guard.invalidate()
      setExistingSessionOnDate(null)
      setDuplicateCheckError(null)
      return
    }
    setExistingSessionOnDate(null)
    setDuplicateCheckError(null)
    let active = true
    void runLatest(guard, () => api.getSessions(sectionId)).then(({ stale, result, error }) => {
      if (!active || stale) return
      if (error) {
        setExistingSessionOnDate(null)
        setDuplicateCheckError(
          describeMutationError(error, 'Could not check for an existing session on this date.'),
        )
        return
      }
      setExistingSessionOnDate(result?.find((s) => s.date === date) ?? null)
    })
    return () => {
      active = false
    }
  }, [bulkMode, sectionId, date])

  useEffect(() => {
    let active = true
    const init = async () => {
      const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'teacher') {
      router.push(cu?.role === 'super_admin' ? '/faculty/sessions' : '/')
        return
      }
      setUser(cu)
      try {
        const [subjectList, allSections, settings] = await Promise.all([
          api.getSubjects(),
          api.getSections(),
          api.getSettings(),
        ])
        if (!active) return
        setSubjects(subjectList)
        setSections(allSections.filter((s) => s.teacherId === cu.id))
        const settingValues = new Map(settings.map((setting) => [setting.key, Number(setting.value)]))
        const configuredRadius = settingValues.get('default_geofence_radius_meters')
        const configuredValidity = settingValues.get('default_qr_validity_minutes')
        const configuredGrace = settingValues.get('default_grace_period_minutes')
        if (configuredRadius && configuredRadius >= 10 && configuredRadius <= 500) setRadius(configuredRadius)
        if (configuredValidity && configuredValidity >= 1 && configuredValidity <= 15) setDefaultQrValidity(configuredValidity)
        if (configuredGrace !== undefined && configuredGrace >= 0 && configuredGrace <= 60) setDefaultGracePeriod(configuredGrace)
      } catch (error) {
        if (active) {
          setInitError(describeMutationError(error, 'Unable to load sections and defaults.'))
        }
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [router, initRetry])

  useEffect(() => {
    setSectionId('')
  }, [subjectId])

  const selectedSection = sections.find((s) => s.id === sectionId)
  const selectedSubject = subjects.find((s) => s.id === subjectId)

  // Class meetings from the selected section's schedule. A slot without its own
  // room falls back to the section room so the prefill stays truthful.
  const scheduleSlots: SessionSlot[] = (selectedSection?.schedule ?? []).map((slot) => ({
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room?.trim() || selectedSection?.room?.trim() || undefined,
  }))
  const hasScheduleSlots = scheduleSlots.length > 0

  const hasDuplicateConflict = !!existingSessionOnDate && !isRescheduled

  useEffect(() => {
    if (selectedSection) {
      setBulkDays(selectedSection.schedule.map((s) => s.day))
      setBulkRows(buildBulkRows(selectedSection.schedule, selectedSection.room))
      setRoom(selectedSection.room || '')
      setIsRescheduled(false)
      setRescheduledFromDate('')
      if (selectedSection.schedule.length > 0) {
        const selection = defaultSlotSelection(selectedSection.schedule, dateRef.current)
        setSlotSelection(selection)
        const matchedSched = selectedSection.schedule[Number(selection)]
        if (matchedSched) {
          setStartTime(matchedSched.startTime)
          setEndTime(matchedSched.endTime)
        }
      } else {
        setSlotSelection(CUSTOM_SLOT_VALUE)
      }
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
        const dateStr = formatCampusDate(d)
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

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    if (formError) setFormError(null)
    if (selectedSection && selectedSection.schedule.length > 0) {
      const selection = slotSelectionForDate(selectedSection.schedule, newDate)
      setSlotSelection(selection)
      if (selection !== CUSTOM_SLOT_VALUE) {
        const matchedSched = selectedSection.schedule[Number(selection)]
        if (matchedSched) {
          setStartTime(matchedSched.startTime)
          setEndTime(matchedSched.endTime)
        }
      }
    }
  }

  // Picking a class meeting refills its time/room and moves the date to that
  // meeting's next occurrence (today when it already matches). Times and date
  // stay editable afterwards; the custom option changes nothing.
  const handleSlotChange = (selection: string) => {
    setSlotSelection(selection)
    if (formError) setFormError(null)
    if (selection === CUSTOM_SLOT_VALUE) return
    const slot = scheduleSlots[Number(selection)]
    if (!slot) return
    setStartTime(slot.startTime)
    setEndTime(slot.endTime)
    if (slot.room) setRoom(slot.room)
    setDate(nextOccurrenceDate(slot.day))
  }

  const updateBulkRow = (index: number, patch: Partial<BulkSlotRow>) => {
    setBulkRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    if (formError) setFormError(null)
  }

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

  // Legacy fallback used only when a section somehow has no schedule entries:
  // the global time pair applies to every checked weekday.
  const legacyBulkCount = bulkDays.length
    ? countSlotOccurrences(
        bulkDays.map((day) => ({ day, selected: true })),
        bulkStartDate,
        bulkEndDate,
      )
    : 0

  const bulkCount = bulkMode
    ? hasScheduleSlots
      ? countSlotOccurrences(bulkRows, bulkStartDate, bulkEndDate)
      : legacyBulkCount
    : 0

  // In slot mode each row carries its own time pair, so the global pair is
  // hidden and validation runs per selected row instead.
  const showGlobalTimeRange = !bulkMode || !hasScheduleSlots
  const invalidBulkRow = bulkMode && hasScheduleSlots ? firstInvalidSlotRow(bulkRows) : null
  const timeRangeInvalid = showGlobalTimeRange ? endTime <= startTime : invalidBulkRow !== null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection || !selectedSubject || !user || submitting) return
    if (showGlobalTimeRange) {
      if (endTime <= startTime) {
        setFormError('End time must be after start time.')
        return
      }
    } else if (invalidBulkRow) {
      setFormError(`End time must be after start time for the ${invalidBulkRow.day} class meeting.`)
      return
    }
    if (bulkMode && bulkCount === 0) {
      setFormError('No matching sessions found for the selected date range and days.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (bulkMode) {
        const slots = hasScheduleSlots ? buildBulkSlots(bulkRows) : undefined
        await api.createBulkSessions({
          sectionId: selectedSection.id,
          subjectName: selectedSubject.name,
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          // Slot payload wins over the legacy global pair; the legacy shape is
          // kept only for the no-schedule fallback.
          ...(slots ? { slots } : { daysOfWeek: bulkDays, startTime, endTime }),
          room: room || undefined,
          mode,
          qrValidityMinutes: defaultQrValidity,
          gracePeriodMinutes: defaultGracePeriod,
          ...(mode === 'in_person' ? { geofence: { latitude, longitude, radiusMeters: radius } } : {}),
          teacherId: user.id,
        })
        alert(`Created ${bulkCount} sessions successfully!`)
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
          mode,
          qrValidityMinutes: defaultQrValidity,
          gracePeriodMinutes: defaultGracePeriod,
          ...(mode === 'in_person'
            ? { geofence: { latitude, longitude, radiusMeters: radius } }
            : {}),
          teacherId: user.id,
          isRescheduled: isRescheduled || undefined,
          rescheduledFromDate: isRescheduled ? rescheduledFromDate : undefined,
          originalScheduleTime: isRescheduled ? selectedReplaceOption?.scheduleTime : undefined,
          originalRoom: isRescheduled ? selectedReplaceOption?.room : undefined,
        })
        router.push('/faculty/sessions')
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unable to create session. Please check your inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  if (!user) return null

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-pup-black p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <ErrorDisplay message={initError} onRetry={() => setInitRetry((key) => key + 1)} />
          </CardContent>
        </Card>
      </div>
    )
  }

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
                {duplicateCheckError ? (
                  <div className="flex items-start gap-3 p-4 border-l-4 border-zinc-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-600">
                    <CalendarCheck className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest mb-0.5">Duplicate check unavailable</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {duplicateCheckError} Verify the date manually before creating the session.
                      </p>
                    </div>
                  </div>
                ) : null}
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
                {/* Session mode */}
                <div className="space-y-2">
                  <Label>Session mode</Label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Session mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mode === 'in_person'}
                      onClick={() => setMode('in_person')}
                      className={`flex items-center justify-center gap-2 border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                        mode === 'in_person'
                          ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                          : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      <School className="h-4 w-4" /> In-Person
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mode === 'online'}
                      onClick={() => setMode('online')}
                      className={`flex items-center justify-center gap-2 border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                        mode === 'online'
                          ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                          : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      <Video className="h-4 w-4" /> Online
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {mode === 'online'
                      ? 'Dual checkpoints: a start-of-class check-in and an end-of-class check-out.'
                      : 'Single QR check-in verified inside a campus geofence.'}
                  </p>
                </div>

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
                      .map((sec) => {
                        const course = sectionCourseLabel(sec.course)
                        return (
                          <option key={sec.id} value={sec.id}>
                            Section {sec.section} &mdash; {sec.room} &mdash; {sec.schedule.map((d) => d.day).join(', ')}{course ? ` · ${course}` : ''}
                          </option>
                        )
                      })}
                  </select>
                </div>

                {/* Bulk Create Toggle */}
                <div className="flex flex-wrap items-center gap-3 py-3 border-t border-zinc-200 dark:border-zinc-700">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bulkStartDate">Start Date</Label>
                        <Input id="bulkStartDate" type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bulkEndDate">End Date</Label>
                        <Input id="bulkEndDate" type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} required />
                      </div>
                    </div>
                    {hasScheduleSlots ? (
                      <div className="space-y-2">
                        <Label>Class meetings</Label>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          One row per meeting from the section schedule. Each row keeps its own time pair.
                        </p>
                        <div className="space-y-2">
                          {bulkRows.map((row, index) => (
                            <div
                              key={`${row.day}-${index}`}
                              className={`flex flex-col gap-2 border p-3 sm:flex-row sm:items-center ${
                                row.selected
                                  ? 'border-maroon/40 bg-white dark:border-golden/40 dark:bg-zinc-800'
                                  : 'border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60'
                              }`}
                            >
                              <label
                                htmlFor={`bulk-slot-${index}`}
                                className="flex min-w-24 cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200"
                              >
                                <input
                                  id={`bulk-slot-${index}`}
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={(e) => updateBulkRow(index, { selected: e.target.checked })}
                                  className="accent-maroon h-4 w-4"
                                />
                                {row.day}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  aria-label={`${row.day} start time`}
                                  type="time"
                                  value={row.startTime}
                                  onChange={(e) => updateBulkRow(index, { startTime: e.target.value })}
                                  className="w-32"
                                  required={row.selected}
                                />
                                <span aria-hidden="true" className="text-zinc-400">–</span>
                                <Input
                                  aria-label={`${row.day} end time`}
                                  type="time"
                                  value={row.endTime}
                                  onChange={(e) => updateBulkRow(index, { endTime: e.target.value })}
                                  className="w-32"
                                  required={row.selected}
                                />
                              </div>
                              {row.room && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{row.room}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {invalidBulkRow && (
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            End time must be after start time for each selected class meeting.
                          </p>
                        )}
                      </div>
                    ) : (
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
                    )}
                    <p className="text-xs text-maroon dark:text-golden font-semibold">
                      {bulkCount} session{bulkCount !== 1 ? 's' : ''} will be created
                    </p>
                  </div>
                ) : (
                  <>
                    {selectedSection && hasScheduleSlots && (
                      <div className="space-y-2">
                        <Label htmlFor="classMeeting">Class meeting</Label>
                        <select
                          id="classMeeting"
                          value={slotSelection}
                          onChange={(e) => handleSlotChange(e.target.value)}
                          aria-describedby="classMeetingHint"
                          className="flex h-10 w-full rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30 focus-visible:border-maroon"
                        >
                          {scheduleSlots.map((slot, index) => (
                            <option key={`${slot.day}-${index}`} value={String(index)}>
                              {slotLabel(slot)}
                            </option>
                          ))}
                          <option value={CUSTOM_SLOT_VALUE}>Not a scheduled day (custom)</option>
                        </select>
                        <p id="classMeetingHint" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Choosing a meeting fills in its time and room and moves the date to its next
                          occurrence. Every field stays editable.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} required />
                    </div>

                    {selectedSection && selectedSection.schedule.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex flex-wrap items-center gap-3">
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

                {showGlobalTimeRange && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. CCIS Lab 3" />
                </div>
              </CardContent>
            </Card>

            {mode === 'in_person' ? (
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
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-maroon dark:text-golden" />
                    Zero-GPS Privacy Notice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Polycheck will not request, read, or store student location for online sessions
                    (Data Privacy Act RA 10173, data-minimization principle). Attendance is verified by
                    dual QR checkpoints and the announced meeting PIN.
                  </p>
                </CardContent>
              </Card>
            )}

            {formError && (
              <div className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
                <p className="font-semibold">Error creating session</p>
                <p className="text-xs mt-0.5">{formError}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!selectedSection || !selectedSubject || (bulkMode && bulkCount === 0) || hasDuplicateConflict || timeRangeInvalid || submitting}>
                {submitting ? 'Creating...' : bulkMode ? `Create ${bulkCount} Sessions` : 'Create Session'}
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
