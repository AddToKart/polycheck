'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, QrCode, Timer, Play, StopCircle, Share2, Maximize, RefreshCw, Users, ChevronRight, Edit3, Camera, Trash2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { User, Session, AttendanceRecord, AttendanceStatus, Student, ProofOfClass } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/lib/hooks'
import { useNotifications } from '@/lib/notifications'
import CampusMap from '@/components/CampusMap'
import { subscribeToSession } from '@/lib/realtime'
import QRCode from 'qrcode'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']

const STATUS_STYLES: Record<string, string> = {
  present: 'bg-[#FFDF00] text-[#4A0A0B]',
  late: 'bg-[#7B1113] text-white',
  absent: 'bg-[#4A0A0B] text-[#FFDF00] border border-[#FFDF00]',
  pending: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disputed: 'bg-[#4A0A0B] text-[#FFDF00] border border-[#FFDF00]',
}

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [proofsOfClass, setProofsOfClass] = useState<ProofOfClass[]>([])
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showValidityPrompt, setShowValidityPrompt] = useState(false)
  const [validityMinutes, setValidityMinutes] = useState('20')
  const [graceMinutes, setGraceMinutes] = useState('15')
  const [countdown, setCountdown] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshLabel, setRefreshLabel] = useState('Updated just now')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshData = useCallback(async () => {
    if (!id) return
    const s = await api.getSession(id)
    if (s) {
      setSession(s)
      setValidityMinutes(String(s.qrValidityMinutes || 20))
      setGraceMinutes(String(s.gracePeriodMinutes || 15))
      if (s.qrToken) {
        setQrDataUrl(await QRCode.toDataURL(s.qrToken, {
          width: 1024,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#0A0A0A', light: '#FFFFFF' },
        }))
      } else {
        setQrDataUrl(null)
      }
    }
    setRecords(await api.getAttendanceRecords(id))
    setProofsOfClass(await api.getProofsOfClass(id))
    setLastUpdated(new Date())
  }, [id])

  useEffect(() => {
    const init = async () => {
      const cu = api.getCurrentUser()
      if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
        router.push('/')
        return
      }
      setUser(cu)
      await refreshData()
      if (id) {
        const sections = await api.getSections()
        let foundSection = null
        for (const s of sections) {
          const ses = await api.getSectionSessions(s.id)
          if (ses.some((se) => se.id === id)) {
            foundSection = s
            break
          }
        }
        if (foundSection) {
          if (cu.role === 'teacher' && foundSection.teacherId !== cu.id) {
            router.push('/faculty')
            return
          }
          const students = await api.getSectionStudents(foundSection.id)
          setEnrolledStudents(students as Student[])
        }
      }
      setLoading(false)
    }
    init()
  }, [id, router, refreshData])

  useEffect(() => {
    if (!id) return
    return subscribeToSession(id, () => { void refreshData() }, setRealtimeConnected)
  }, [id, refreshData])

  useEffect(() => {
    if (!session?.isActive) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (realtimeConnected) return
    pollRef.current = setInterval(async () => {
      await refreshData()
    }, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [session?.isActive, id, realtimeConnected, refreshData])

  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (seconds < 5) setRefreshLabel('Updated just now')
      else if (seconds < 60) setRefreshLabel(`Updated ${seconds}s ago`)
      else setRefreshLabel(`Updated ${Math.floor(seconds / 60)}m ago`)
    }, 5000)
    return () => clearInterval(timer)
  }, [lastUpdated])

  useEffect(() => {
    if (!session || !session.isActive || !session.qrTokenExpiresAt) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    const tick = () => {
      const diff = new Date(session.qrTokenExpiresAt!).getTime() - Date.now()
      if (diff <= 0) {
        const graceEnd = new Date(session.qrTokenExpiresAt!).getTime() + session.gracePeriodMinutes * 60 * 1000
        const graceDiff = graceEnd - Date.now()
        setCountdown(graceDiff <= 0 ? 'Grace ended' : `Grace: ${String(Math.floor(graceDiff / 60000)).padStart(2, '0')}:${String(Math.floor((graceDiff % 60000) / 1000)).padStart(2, '0')}`)
        return
      }
      setCountdown(`${String(Math.floor(diff / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session])

  if (loading) return (
    <div className="flex h-screen bg-[#F5F5F5] dark:bg-[#0A0A0C] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
  if (!user || !session) return null
  const isTeacher = user.role === 'teacher'

  const presentCount = records.filter((r) => r.status === 'present').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const absentCount = records.filter((r) => r.status === 'absent').length
  const pendingCount = records.filter((r) => r.status === 'pending').length
  const studentMap = new Map(records.map((r) => [r.studentId, r]))

  const handleGenerateQr = async () => {
    const mins = parseInt(validityMinutes, 10)
    const grace = parseInt(graceMinutes, 10)
    if (isNaN(mins) || mins < 1 || isNaN(grace) || grace < 0) return
    await api.generateQrCode(session.id, mins, grace)
    setShowValidityPrompt(false)
    await refreshData()
    addNotification('success', 'QR Code Generated', `Session activated with ${mins}min validity and ${grace}min grace`)
  }

  const handleEndSession = async () => {
    if (confirm('Mark all pending students as absent and end the session?')) {
      await api.endSession(session.id)
      await refreshData()
      addNotification('info', 'Session Ended', 'All pending students marked as absent')
    }
  }

  const handleManualOverride = async (studentId: string, currentStatus: AttendanceStatus) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus)
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const existing = records.find((r) => r.studentId === studentId && r.sessionId === session.id)
    if (existing) {
      await api.updateAttendanceStatus(existing.id, nextStatus)
      const updated = await api.getAttendanceRecords(session.id).then((rs) => rs.find((r) => r.id === existing.id))
      if (updated) Object.assign(updated, { manuallySet: true })
    } else {
      const student = enrolledStudents.find((s) => s.id === studentId)
      const now = new Date()
      await api.addAttendanceRecord({
        id: `a-manual-${records.length}`,
        sessionId: session.id,
        sectionId: session.sectionId,
        studentId,
        studentName: student?.fullName ?? 'Unknown',
        timestamp: now.toISOString(),
        status: nextStatus,
        coordinates: { latitude: 0, longitude: 0 },
        deviceId: 'manual',
        isSynced: true,
        syncedAt: now.toISOString(),
        manuallySet: true,
      })
    }
    await refreshData()
    addNotification('info', 'Status Updated', `Student marked as ${nextStatus}`)
  }

  const handleShare = async () => {
    if (session.qrToken) {
      await navigator.clipboard.writeText(session.qrToken)
      alert('QR token copied to clipboard!')
    }
  }

  const handleLogout = () => { api.logout(); router.push('/') }

  return (
    <div className="flex h-screen bg-[#F5F5F5] dark:bg-[#0A0A0C]">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/sessions" backLabel="Back to Sessions" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#0A0A0C] border-b border-gray-200 dark:border-[#1C1C21]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 hover:opacity-70">
              <ArrowLeft className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
            </button>
            <div>
              <h1 className="text-xl font-heading font-bold text-[#4A0A0B] dark:text-[#FFDF00]">{session.subjectName}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {session.startTime}-{session.endTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshData} className="p-2 hover:opacity-70">
              <RefreshCw className="w-4 h-4 text-[#7B1113] dark:text-[#FFDF00]" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          {/* QR Code Card */}
          {isTeacher && <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
                <h2 className="text-base font-bold dark:text-white">QR Code</h2>
              </div>
              <div className="flex flex-col items-center py-4">
                {qrDataUrl ? (
                  <>
                    <div className="cursor-pointer" onClick={() => setShowQrModal(true)}>
                      <Image src={qrDataUrl} width={180} height={180} unoptimized alt="Scannable session QR code" />
                    </div>
                    {countdown && (
                      <p className={`text-sm mt-2 ${countdown === 'Grace ended' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {countdown.includes('Grace') ? countdown : `Expires in: ${countdown}`}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3">
                      <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" onClick={() => setShowQrModal(true)}>
                        <Maximize className="w-3.5 h-3.5" /> Full Screen
                      </Button>
                      <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" onClick={handleShare}>
                        <Share2 className="w-3.5 h-3.5" /> Copy Token
                      </Button>
                    </div>
                  </>
                ) : session.isActive ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Generating QR...</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Generate a QR code to start the session</p>
                    <Button className="bg-[#7B1113] hover:bg-[#4A0A0B] dark:bg-[#FFDF00] dark:hover:bg-[#E09A00] dark:text-[#4A0A0B] flex items-center gap-2" onClick={() => setShowValidityPrompt(true)}>
                      <Play className="w-4 h-4" /> Generate QR Code
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>}

          {/* Session Info */}
          <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
                <h2 className="text-base font-bold dark:text-white">Session Info</h2>
              </div>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-1">Status</p>
                  <Badge className={session.isActive ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}>
                    {session.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {session.isActive && session.qrValidityMinutes ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-1">QR Validity</p>
                    <p className="text-sm font-semibold dark:text-white">{session.qrValidityMinutes} min</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-1">Grace Period</p>
                  <p className="text-sm font-semibold dark:text-white">{session.gracePeriodMinutes} min</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5px] text-gray-400 dark:text-gray-500 mb-1">Room</p>
                  <p className="text-sm font-semibold dark:text-white">{session.room || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campus Map Card */}
          <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
            <CardContent className="p-6">
              <CampusMap
                session={session}
                records={records}
                isActive={session.isActive}
                refreshLabel={refreshLabel}
              />
            </CardContent>
          </Card>

          {/* Proof of Class */}
          <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
                <h2 className="text-base font-bold dark:text-white">Proof of Class</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">({proofsOfClass.length})</span>
              </div>
              {proofsOfClass.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No proof photos uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {proofsOfClass.map((poc) => (
                    <div key={poc.id} className="border border-gray-200 dark:border-[rgba(245,168,0,0.15)] p-3 bg-gray-50 dark:bg-[#0A0A0C]">
                      <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-2">
                        <Camera className="w-8 h-8 text-zinc-400" />
                      </div>
                      <p className="text-xs font-medium dark:text-white truncate">{poc.uploadedByStudentName}</p>
                      <p className="text-[10px] text-gray-400">{new Date(poc.uploadedAt).toLocaleString()}</p>
                      {poc.description && <p className="text-[10px] text-gray-500 mt-1 italic">&quot;{poc.description}&quot;</p>}
                      {isTeacher && (
                        <button
                          className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                          onClick={async () => { await api.deleteProofOfClass(poc.id); setProofsOfClass(await api.getProofsOfClass(id)) }}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Roster */}
          <Card className="dark:border-[rgba(245,168,0,0.15)] dark:bg-[#121215]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
                <h2 className="text-base font-bold dark:text-white">Student Roster</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">({enrolledStudents.length})</span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">{refreshLabel}</p>

              {/* Summary */}
              <div className="flex justify-around mb-4">
                {[
                  { label: 'Present', value: presentCount, color: 'text-[#FFDF00]' },
                  { label: 'Late', value: lateCount, color: 'text-[#7B1113] dark:text-[#FF6B6B]' },
                  { label: 'Absent', value: absentCount, color: 'text-[#4A0A0B] dark:text-[#FF4F5A]' },
                  { label: 'Pending', value: pendingCount, color: 'text-gray-400' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(['all', 'present', 'late', 'absent', 'pending'] as const).map((f) => (
                  <button
                    key={f}
                    className={`px-3 py-1 text-xs border ${filter === f ? 'bg-[#7B1113] dark:bg-[#FFDF00] border-[#7B1113] dark:border-[#FFDF00] text-white dark:text-[#4A0A0B]' : 'bg-gray-100 dark:bg-[#121215] border-gray-300 dark:border-[rgba(245,168,0,0.15)] text-gray-500 dark:text-gray-400'}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Student List */}
              {enrolledStudents.length === 0 ? (
                <p className="text-center py-8 text-gray-400 dark:text-gray-500">No enrolled students.</p>
              ) : (
                <div className="space-y-1">
                  {enrolledStudents.map((student) => {
                    const record = studentMap.get(student.id)
                    const status = (record?.status ?? 'pending') as AttendanceStatus
                    if (filter !== 'all' && status !== filter) return null
                    return (
                      <button
                        key={student.id}
                        className={`w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-[#222] text-left ${isTeacher ? 'hover:bg-gray-50 dark:hover:bg-[#1C1C21]' : 'cursor-default'}`}
                        onClick={() => { if (isTeacher) handleManualOverride(student.id, status) }}
                        disabled={!isTeacher}
                      >
                        <div>
                          <p className="text-sm font-medium dark:text-white">{student.fullName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{student.studentId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {record?.manuallySet && <Edit3 className="w-3.5 h-3.5 text-[#7B1113] dark:text-[#FFDF00]" />}
                          <span className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                          {isTeacher && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* End Session */}
          {isTeacher && session.isActive && (
            <Button className="w-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 py-6" onClick={handleEndSession}>
              <StopCircle className="w-5 h-5" /> End Session
            </Button>
          )}
        </div>
      </div>

      {/* Validity Prompt Modal */}
      {isTeacher && showValidityPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowValidityPrompt(false)}>
          <div className="bg-white dark:bg-[#121215] dark:border dark:border-[rgba(245,168,0,0.15)] p-8 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Timer className="w-10 h-10 text-[#7B1113] dark:text-[#FFDF00] mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-center dark:text-white mb-2">QR Settings</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-6">
              Set the duration for this session. After validity expires, scans are marked Late. After the grace period ends, scans are blocked.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">QR Validity</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-full text-center font-bold"
                    value={validityMinutes}
                    onChange={(e) => setValidityMinutes(e.target.value)}
                    min={1}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Grace Period</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-full text-center font-bold"
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(e.target.value)}
                    min={0}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowValidityPrompt(false)}>Cancel</Button>
              <Button className="flex-1 bg-[#7B1113] hover:bg-[#4A0A0B] dark:bg-[#FFDF00] dark:hover:bg-[#E09A00] dark:text-[#4A0A0B]" onClick={handleGenerateQr}>Generate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen QR Modal */}
      {isTeacher && showQrModal && qrDataUrl && (
        <div className="fixed inset-0 bg-white dark:bg-black z-50 flex items-center justify-center" onClick={() => setShowQrModal(false)}>
          <div className="text-center">
            <Image src={qrDataUrl} width={320} height={320} unoptimized alt="Scannable session QR code" />
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-6">Tap anywhere to close</p>
            <Button variant="outline" className="mt-4" onClick={(e) => { e.stopPropagation(); handleShare() }}>
              <Share2 className="w-4 h-4 mr-2" /> Copy Token
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
