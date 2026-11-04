import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, Animated, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import * as Crypto from 'expo-crypto'
import * as Location from 'expo-location'
import * as SecureStore from 'expo-secure-store'
import { io, type Socket } from 'socket.io-client'
import QRCode from 'react-native-qrcode-svg'
import {
  ATTENDANCE_ANOMALY_EVENT,
  randomMeetingPin,
  SESSION_FINALE_EVENT,
} from '@polycheck/shared'
import type {
  AttendanceAnomalyEvent,
  AttendanceRecord,
  AttendanceStatus,
  ProofOfClass,
  ScanAttemptView,
  Session,
  SessionFinaleSummary,
  Student,
  User,
} from '@polycheck/shared'
import type { TeacherActivationLocation } from '@polycheck/shared'
import { api, ApiRequestError } from '../../../services/api-client'
import { API_BASE } from '../../../services/api-config'
import { useAuthGate } from '../../../hooks/use-auth-gate'
import { sharePngFile } from '../../../services/file-sharing'
import { useTheme } from '../../../theme/ThemeContext'
import { pupColors } from '../../../theme/colors'
import MapView from '../../../components/MapView'
import {
  formatRadarCounters,
  mapFinaleBanner,
  mergeAnomaly,
  shapeRadarOverlay,
  type FinaleBannerModel,
  type RadarDeniedEntry,
} from '../../../lib/radar-overlay'
import { CampusHeader } from '../../../components/CampusHeader'
import { AttendanceStatusPill, CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../../components/CampusPrimitives'
import { AttendanceMetricGrid } from '../../../components/AttendanceReportCards'
import { useCampusToast } from '../../../components/CampusToast'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'incomplete', 'absent']
const FILTERS: Array<AttendanceStatus | 'all'> = ['all', 'present', 'late', 'incomplete', 'absent', 'excused', 'pending', 'disputed']
const ROSTER_PAGE_SIZE = 20
const E2E_MODE = process.env.EXPO_PUBLIC_E2E_MODE === 'true'
type QrSvgHandle = { toDataURL: (callback: (base64: string) => void) => void }
const radarStyles = StyleSheet.create({
  deniedDot: {
    width: 10,
    height: 10,
    marginTop: 4,
    borderRadius: 5,
    backgroundColor: pupColors.danger,
  },
})

const CardTitle = ({ icon, title, detail }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail?: string }) => {
  const { isDark } = useTheme()
  return <View className="mb-4 flex-row items-center gap-2"><View className="h-9 w-9 items-center justify-center rounded-xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name={icon} size={18} color={isDark ? pupColors.golden : pupColors.maroon} /></View><Text className="flex-1 font-sans-bold text-base text-ink dark:text-white">{title}</Text>{detail ? <Text className="font-sans-medium text-xs text-muted dark:text-zinc-400">{detail}</Text> : null}</View>
}

// F2/F1: the shared realtime helper (services/realtime.ts) is outside this
// task's ownership and only wires session:state/attendance:updated — the same
// precedent as the web radar modal, which replicates its connection recipe to
// add the anomaly + finale listeners on the same session room. One socket,
// same auth/join/leave discipline.
function subscribeToSessionEvents(
  sessionId: string,
  handlers: {
    onUpdate: () => void
    onAnomaly: (event: AttendanceAnomalyEvent) => void
    onFinale: (summary: SessionFinaleSummary) => void
    onConnectionChange?: (connected: boolean) => void
  },
): () => void {
  let disposed = false
  let socket: Socket | null = null

  void SecureStore.getItemAsync('polycheck-token').then((token) => {
    if (!token || disposed) return
    socket = io(`${API_BASE.replace(/\/api\/?$/, '')}/attendance`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
    })
    socket.on('connect', () => {
      handlers.onConnectionChange?.(true)
      socket?.emit('session:join', { sessionId })
    })
    socket.on('disconnect', () => handlers.onConnectionChange?.(false))
    socket.on('connect_error', () => handlers.onConnectionChange?.(false))
    socket.on('session:state', handlers.onUpdate)
    socket.on('attendance:updated', handlers.onUpdate)
    socket.on(ATTENDANCE_ANOMALY_EVENT, (event: AttendanceAnomalyEvent) => {
      if (event?.sessionId === sessionId) handlers.onAnomaly(event)
    })
    socket.on(SESSION_FINALE_EVENT, (summary: SessionFinaleSummary) => {
      if (summary?.sessionId === sessionId) handlers.onFinale(summary)
    })
  })

  return () => {
    disposed = true
    socket?.emit('session:leave', { sessionId })
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}

// Denied-attempt log row: blinking red dot (static under reduce-motion).
const RadarDeniedRow = ({ entry }: { entry: RadarDeniedEntry }) => {
  const pulse = useRef(new Animated.Value(1)).current
  const [reduceMotion, setReduceMotion] = useState(true)

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion) }, [])

  useEffect(() => {
    if (reduceMotion) { pulse.setValue(1); return }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse, reduceMotion])

  return (
    <View testID={`radar-denied-${entry.key}`} className="flex-row items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/30">
      <Animated.View style={[radarStyles.deniedDot, { opacity: pulse }]} />
      <View className="flex-1">
        <Text className="font-sans-bold text-xs text-ink dark:text-white" numberOfLines={2}>{entry.copy}</Text>
        <Text className="mt-0.5 font-sans text-[10px] text-muted dark:text-zinc-400" numberOfLines={1}>
          {entry.studentName}{entry.reason ? ` · ${entry.reason.replace(/_/g, ' ')}` : ''} · {new Date(entry.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </View>
      <MaterialIcons name="block" size={15} color={pupColors.danger} />
    </View>
  )
}

export default function SessionDetailScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const { id } = useLocalSearchParams<{ id: string }>()
  const currentUser = useAuthGate(['teacher', 'super_admin'])
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  // V4 anti-ghost-professor evidence + pending override fix.
  const teacherFixRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const lastConflictFixRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [rosterPage, setRosterPage] = useState(1)
  const [proofsOfClass, setProofsOfClass] = useState<ProofOfClass[]>([])
  // F2 radar: stored scan attempts + live anomaly events + F1 finale broadcast.
  const [attempts, setAttempts] = useState<ScanAttemptView[]>([])
  const [anomalies, setAnomalies] = useState<AttendanceAnomalyEvent[]>([])
  const [finale, setFinale] = useState<SessionFinaleSummary | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showValidityPrompt, setShowValidityPrompt] = useState(false)
  const [validityMinutes, setValidityMinutes] = useState('15')
  const [graceMinutes, setGraceMinutes] = useState('15')
  const [checkpointTab, setCheckpointTab] = useState<'start' | 'end'>('start')
  const [showCheckpointPrompt, setShowCheckpointPrompt] = useState(false)
  const [checkpointValiditySeconds, setCheckpointValiditySeconds] = useState('90')
  const [checkpointGraceMinutes, setCheckpointGraceMinutes] = useState('10')
  const [checkpointPinRequired, setCheckpointPinRequired] = useState(false)
  const [checkpointPin, setCheckpointPin] = useState('')
  const [regeneratingCheckpoint, setRegeneratingCheckpoint] = useState(false)
  const [startPinPlain, setStartPinPlain] = useState<string | null>(null)
  const [endPinPlain, setEndPinPlain] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshLabel, setRefreshLabel] = useState('Updated just now')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrCodeRef = useRef<QrSvgHandle | null>(null)

  const refreshData = useCallback(async () => {
    if (!id) return
    try {
      const [nextSession, nextRecords, nextProofs] = await Promise.all([api.getSession(id), api.getAttendanceRecords(id), api.getProofsOfClass(id)])
      setSession(nextSession)
      if (nextSession) {
        setValidityMinutes(String(Math.min(nextSession.qrValidityMinutes || 15, 15)))
        setGraceMinutes(String(Math.min(nextSession.gracePeriodMinutes || 15, 60)))
      }
      setRecords(nextRecords)
      setProofsOfClass(nextProofs)
      setLastUpdated(new Date())
      // F2 radar: cheap attempts refetch rides the same refresh cadence (live
      // socket updates + polling fallback). Failures keep the previous pins —
      // an offline cockpit must not blank the radar it already drew.
      if (nextSession.mode !== 'online') {
        void api.getScanAttempts(id).then((rows) => setAttempts(rows)).catch(() => undefined)
      } else {
        setAttempts([])
      }
    } catch { showToast('error', 'Unable to refresh session', 'Please check your connection and try again.') }
  }, [id, showToast])

  useEffect(() => {
    if (!currentUser) return
    setUser(currentUser)
    if (!id) return
    void api.getSession(id).then(async (nextSession) => {
      const section = await api.getSection(nextSession.sectionId)
      if (currentUser.role === 'teacher' && section.teacherId !== currentUser.id) { router.replace('/'); return }
      const students = await api.getSectionStudents(section.id)
      setEnrolledStudents(students.map(({ attendance: _attendance, ...student }) => student))
      await refreshData()
    }).catch(() => router.replace('/'))
  }, [id, currentUser, refreshData])

  const onlineMode = session?.mode === 'online'
  const activeCheckpointExpiry = onlineMode
    ? checkpointTab === 'start'
      ? session?.startTokenExpiresAt
      : session?.endTokenExpiresAt
    : session?.qrTokenExpiresAt
  const activeGraceMinutes = onlineMode
    ? checkpointTab === 'start'
      ? session?.startGraceMinutes ?? 0
      : 0
    : session?.gracePeriodMinutes ?? 0

  useEffect(() => {
    if (!session?.isActive || !activeCheckpointExpiry) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    const tick = () => {
      const expiry = new Date(activeCheckpointExpiry).getTime()
      const remaining = expiry - Date.now()
      if (remaining <= 0) {
        const graceRemaining = expiry + activeGraceMinutes * 60_000 - Date.now()
        if (graceRemaining <= 0) setCountdown('Grace ended')
        else setCountdown(`Grace: ${Math.floor(graceRemaining / 60_000)}:${Math.floor((graceRemaining % 60_000) / 1000).toString().padStart(2, '0')}`)
        return
      }
      setCountdown(`${Math.floor(remaining / 60_000)}:${Math.floor((remaining % 60_000) / 1000).toString().padStart(2, '0')}`)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session, activeCheckpointExpiry, activeGraceMinutes])

  useEffect(() => {
    if (!id) return
    return subscribeToSessionEvents(id, {
      onUpdate: () => { void refreshData() },
      onAnomaly: (event) => { setAnomalies((prev) => mergeAnomaly(prev, event)) },
      // Idempotent by the server commit instant: repeated broadcasts keep the
      // first banner instead of re-rendering the finale.
      onFinale: (summary) => { setFinale((prev) => (prev && prev.endedAt === summary.endedAt ? prev : summary)) },
      onConnectionChange: setRealtimeConnected,
    })
  }, [id, refreshData])
  useEffect(() => {
    if (!session?.isActive || realtimeConnected) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }; return }
    pollRef.current = setInterval(() => { void refreshData() }, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [realtimeConnected, refreshData, session?.isActive])
  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      setRefreshLabel(seconds < 5 ? 'Updated just now' : seconds < 60 ? `Updated ${seconds}s ago` : `Updated ${Math.floor(seconds / 60)}m ago`)
    }, 5000)
    return () => clearInterval(timer)
  }, [lastUpdated])

  // F2 radar shaping: record pins keep their status colours (existing map
  // behaviour preserved); denied attempts and live anomalies add red pins and
  // the forensic log. Shaped above the early return to preserve the
  // hooks-order fix.
  const radar = useMemo(() => shapeRadarOverlay({
    geofence: session?.mode === 'online' ? null : session?.geofence ?? null,
    attempts,
    records,
    students: enrolledStudents,
    anomalies,
  }), [session?.mode, session?.geofence, attempts, records, enrolledStudents, anomalies])

  if (!user || !session) return null
  const isTeacher = user.role === 'teacher'
  const activeQrToken = onlineMode
    ? checkpointTab === 'start'
      ? session.startQrToken
      : session.endQrToken
    : session.qrToken
  const activePinPlain = checkpointTab === 'start' ? startPinPlain : endPinPlain
  const visibleRecords = filter === 'all' ? records : records.filter((record) => record.status === filter)
  const visibleStudentIds = new Set(visibleRecords.map((record) => record.studentId))
  const studentMap = new Map(records.map((record) => [record.studentId, record]))
  const filteredStudents = enrolledStudents.filter((student) => {
    const status = studentMap.get(student.id)?.status ?? 'pending'
    return filter === 'all' || visibleStudentIds.has(student.id) || status === filter
  })
  const rosterPageCount = Math.max(1, Math.ceil(filteredStudents.length / ROSTER_PAGE_SIZE))
  const safeRosterPage = Math.min(rosterPage, rosterPageCount)
  const pagedStudents = filteredStudents.slice(
    (safeRosterPage - 1) * ROSTER_PAGE_SIZE,
    safeRosterPage * ROSTER_PAGE_SIZE,
  )
  const counts = {
    present: records.filter((record) => record.status === 'present').length,
    late: records.filter((record) => record.status === 'late').length,
    incomplete: records.filter((record) => record.status === 'incomplete').length,
    absent: records.filter((record) => record.status === 'absent').length,
    pending: records.filter((record) => record.status === 'pending').length,
    disputed: records.filter((record) => record.status === 'disputed').length,
    excused: records.filter((record) => record.status === 'excused').length,
  }
  // F1 parity: the finale banner renders from the session:finale broadcast
  // (idempotent by endedAt); the kiosk itself stays web-only by design.
  const finaleModel: FinaleBannerModel | null = finale ? mapFinaleBanner(finale) : null

  const openCheckpointPrompt = (checkpoint: 'start' | 'end', options?: { regenerate?: boolean }) => {
    const remembered = checkpoint === 'start' ? startPinPlain : endPinPlain
    setCheckpointTab(checkpoint)
    setCheckpointValiditySeconds(
      String(
        (checkpoint === 'start' ? session.startQrValiditySeconds : session.endQrValiditySeconds) ?? 90,
      ),
    )
    setCheckpointGraceMinutes(String(checkpoint === 'start' ? session.startGraceMinutes ?? 10 : 0))
    setCheckpointPinRequired(false)
    setCheckpointPin(options?.regenerate && remembered ? remembered : '')
    setRegeneratingCheckpoint(Boolean(options?.regenerate))
    setShowCheckpointPrompt(true)
  }

  const generateCheckpointQr = async () => {
    const validitySeconds = Number(checkpointValiditySeconds)
    const grace = Number(checkpointGraceMinutes)
    if (!Number.isInteger(validitySeconds) || validitySeconds < 60 || validitySeconds > 300) {
      showToast('warning', 'Check QR settings', 'Validity must be between 60 and 300 seconds.')
      return
    }
    if (checkpointTab === 'start' && (!Number.isInteger(grace) || grace < 0 || grace > 60)) {
      showToast('warning', 'Check QR settings', 'Grace must be between 0 and 60 minutes.')
      return
    }
    const pin = checkpointPin.trim()
    if (checkpointPinRequired && !/^\d{2,4}$/.test(pin)) {
      showToast('warning', 'Check meeting PIN', 'The PIN must be 2–4 digits.')
      return
    }
    try {
      await api.generateCheckpointQrCode({
        sessionId: session.id,
        checkpoint: checkpointTab,
        validitySeconds,
        graceMinutes: checkpointTab === 'start' ? grace : undefined,
        pin: checkpointPinRequired ? pin : undefined,
        regenerate: regeneratingCheckpoint || undefined,
      })
      if (checkpointTab === 'start') setStartPinPlain(checkpointPinRequired ? pin : null)
      else setEndPinPlain(checkpointPinRequired ? pin : null)
      setShowCheckpointPrompt(false)
      await refreshData()
      showToast(
        'success',
        regeneratingCheckpoint ? 'Checkpoint QR regenerated' : 'Checkpoint QR generated',
        `${checkpointTab === 'start' ? 'Start' : 'End'}-of-class QR is live for ${validitySeconds}s${
          checkpointPinRequired ? ' — announce the PIN aloud.' : '.'
        }`,
      )
    } catch (error) {
      showToast('error', 'Unable to generate QR code', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  // V4 anti-ghost-professor: one-shot classroom fix. Failure is non-blocking
  // (an absent fix keeps today's behavior for offline use); an off-campus fix
  // requires the explicit native override confirm, which is audited.
  const captureTeacherFix = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (teacherFixRef.current) return teacherFixRef.current
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return null
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const payload = { latitude: fix.coords.latitude, longitude: fix.coords.longitude }
      teacherFixRef.current = payload
      return payload
    } catch {
      return null
    }
  }

  const generateQr = async (overrideTeacherLocation = false) => {
    const validity = Number(validityMinutes)
    const grace = Number(graceMinutes)
    if (!Number.isInteger(validity) || validity < 1 || validity > 15 || !Number.isInteger(grace) || grace < 0 || grace > 60) {
      showToast('warning', 'Check QR settings', 'Validity must be 1-15 minutes and grace period must be 0-60 minutes.')
      return
    }
    try {
      const fix = overrideTeacherLocation && lastConflictFixRef.current
        ? lastConflictFixRef.current
        : await captureTeacherFix()
      if (!fix) {
        showToast('info', 'No location fix', 'Activating without a location fix is allowed for offline use.')
      }
      await api.generateQrCode(
        session.id,
        validity,
        grace,
        fix
          ? { latitude: fix.latitude, longitude: fix.longitude, ...(overrideTeacherLocation ? { override: true } : {}) }
          : undefined,
      )
      setShowValidityPrompt(false)
      await refreshData()
      showToast('success', 'QR code generated', `Students can scan within the ${validity}-minute window.`)
    } catch (error) {
      if (
        overrideTeacherLocation === false &&
        error instanceof ApiRequestError &&
        error.code === 'teacher_location_outside_geofence'
      ) {
        // Destructive confirms stay native: ask for the explicit override
        // (recorded in the audit log) before re-sending the activation.
        Alert.alert(
          'Outside the classroom geofence',
          `Your device is ${error.distanceMeters ? `${error.distanceMeters} m` : 'far'} from the classroom geofence (allowed: ${error.allowedDistanceMeters ?? 150} m). Activating anyway is recorded in the audit log.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Activate anyway',
              style: 'destructive',
              onPress: () => {
                void generateQr(true)
              },
            },
          ],
        )
        return
      }
      showToast('error', 'Unable to generate QR code', error instanceof Error ? error.message : 'Please try again.')
      setShowValidityPrompt(false)
    }
  }

  const endSession = () => Alert.alert('End session?', onlineMode
    ? 'The checkpoint matrix is resolved: present / late / incomplete. Students with neither scan become absent.'
    : 'Pending students will be marked absent and the session will close.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'End session', style: 'destructive', onPress: () => { void api.endSession(session.id).then(refreshData).catch((error) => showToast('error', 'Unable to end session', error instanceof Error ? error.message : 'Please try again.')) } },
  ])

  const override = async (studentId: string, currentStatus: AttendanceStatus) => {
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    try {
      const existing = records.find((record) => record.studentId === studentId && record.sessionId === session.id)
      if (existing) await api.updateAttendanceStatus(existing.id, nextStatus)
      else {
        const student = enrolledStudents.find((item) => item.id === studentId)
        await api.addAttendanceRecord({ id: `a-${Date.now()}`, sessionId: session.id, sectionId: session.sectionId, studentId, studentName: student?.fullName ?? 'Unknown', timestamp: new Date().toISOString(), status: nextStatus, coordinates: onlineMode ? { latitude: null, longitude: null } : { latitude: 0, longitude: 0 }, deviceId: 'manual', isSynced: true, syncedAt: new Date().toISOString(), manuallySet: true })
      }
      await refreshData()
    } catch (error) { showToast('error', 'Unable to update attendance', error instanceof Error ? error.message : 'Please try again.') }
  }

  const copyQrToken = async () => {
    if (!activeQrToken) return
    await Clipboard.setStringAsync(activeQrToken)
    showToast('success', 'QR token copied', 'The signed session token is ready to paste.')
  }

  const shareQrToken = async () => {
    if (!activeQrToken) return
    await Share.share({
      title: `${session.subjectName} attendance QR`,
      message: activeQrToken,
    })
  }

  const shareQrImage = async () => {
    const qrCode = qrCodeRef.current
    if (!qrCode) {
      showToast('warning', 'QR image unavailable', 'Wait for the QR code to finish rendering and try again.')
      return
    }
    try {
      const base64 = await new Promise<string>((resolve) => qrCode.toDataURL(resolve))
      await sharePngFile(base64, `polycheck-qr-${session.id}.png`)
    } catch (error) {
      showToast('error', 'Unable to share QR image', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow={onlineMode ? 'Online attendance · no GPS' : 'Live attendance'}
        title={session.subjectName}
        subtitle={`${new Date(session.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · ${session.startTime}–${session.endTime}`}
        onBack={() => router.back()}
        actions={(
          <>
            <CampusIconButton inverse icon="refresh" label="Refresh session" onPress={() => void refreshData()} />
            <CampusIconButton inverse icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} />
          </>
        )}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      {finaleModel ? (
        <CampusCard testID="session-finale-banner" className="mb-5 overflow-hidden bg-maroon dark:bg-maroon-deep">
          <View className="flex-row items-center gap-3">
            <Image source={require('../../../assets/pup-logo.png')} className="h-12 w-12" resizeMode="contain" />
            <View className="flex-1">
              <Text className="font-sans-bold text-[9px] uppercase tracking-[2px] text-golden">
                Class complete · {new Date(finaleModel.endedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text className="mt-0.5 font-heading text-lg text-white">Attendance finalized</Text>
            </View>
            <View className="items-center rounded-2xl bg-golden px-3 py-2">
              <Text className="font-heading text-xl text-maroon-dark">{finaleModel.rateLabel}</Text>
              <Text className="font-sans-bold text-[8px] uppercase tracking-widest text-maroon-dark">rate</Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {([
              { label: 'P', title: 'Present', value: finaleModel.counts.present },
              { label: 'L', title: 'Late', value: finaleModel.counts.late },
              { label: 'A', title: 'Absent', value: finaleModel.counts.absent },
              { label: 'E', title: 'Excused', value: finaleModel.counts.excused },
              { label: 'I', title: 'Incomplete', value: finaleModel.counts.incomplete },
            ] as const).map((item) => (
              <View key={item.label} className="min-w-[18%] flex-1 items-center rounded-xl border border-golden/30 bg-white/5 py-2">
                <Text accessibilityLabel={`${item.title}: ${item.value}`} className="font-heading text-base text-golden">{item.value}</Text>
                <Text className="font-sans-bold text-[8px] uppercase tracking-widest text-white/60">{item.label}</Text>
              </View>
            ))}
          </View>
          <Text className="mt-2 font-sans text-[10px] text-white/60">
            {finaleModel.capacity} students on the roster{finaleModel.counts.disputed || finaleModel.counts.pending ? ` · ${finaleModel.counts.disputed} disputed / ${finaleModel.counts.pending} pending await review` : ''}. Excused rows sit outside the rate.
          </Text>
        </CampusCard>
      ) : null}
      {isTeacher ? <CampusCard className="mb-5 overflow-hidden bg-maroon dark:bg-maroon-deep">
        <View className="mb-4 w-full flex-row items-center"><View className="h-9 w-9 items-center justify-center rounded-xl bg-white/10"><MaterialIcons name={onlineMode ? 'videocam' : 'qr-code-2'} size={19} color={pupColors.golden} /></View><View className="ml-3 flex-1"><Text className="font-sans-bold text-base text-white">{onlineMode ? 'Checkpoint QR codes' : 'Session QR'}</Text><Text className="mt-1 font-sans text-xs text-white/60">{onlineMode ? 'Students check in at the start and check out at the end.' : 'Students scan this code inside the geofence.'}</Text></View></View>
        {onlineMode ? (
          <>
            <View className="mb-3 flex-row gap-2">
              {([
                { key: 'start' as const, label: 'Step 1 · Start QR', armed: Boolean(session.startQrToken) },
                { key: 'end' as const, label: 'Step 2 · End QR', armed: Boolean(session.endQrToken) },
              ]).map((step) => (
                <Pressable
                  key={step.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: checkpointTab === step.key }}
                  onPress={() => setCheckpointTab(step.key)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-2xl border px-2 ${checkpointTab === step.key ? 'border-golden bg-golden' : 'border-white/25 bg-white/10'}`}
                >
                  <Text className={`font-sans-bold text-[10px] uppercase tracking-[1px] ${checkpointTab === step.key ? 'text-maroon-dark' : 'text-white/80'}`}>{step.label}{step.armed ? ' ●' : ''}</Text>
                </Pressable>
              ))}
            </View>
            {activeQrToken ? (
              <View className="items-center">
                <Pressable accessibilityRole="button" accessibilityLabel="Open QR code full screen" onPress={() => setShowQrModal(true)} className="rounded-[26px] bg-white p-3"><QRCode value={activeQrToken} size={160} quietZone={6} backgroundColor={pupColors.white} color={pupColors.black} getRef={(ref: QrSvgHandle | null) => { qrCodeRef.current = ref }} /></Pressable>
                {E2E_MODE ? <Text testID="session-e2e-token" selectable numberOfLines={1} className="mt-1 max-w-full text-[1px] text-maroon">{activeQrToken}</Text> : null}
                <Text accessibilityLiveRegion="polite" className="mt-4 font-sans-bold text-sm text-golden">{countdown === 'Grace ended' ? (checkpointTab === 'end' ? 'Check-out window ended' : 'Grace period ended') : countdown.includes('Grace') ? countdown : countdown ? `Expires in ${countdown}` : 'Active'}</Text>
                {activePinPlain ? <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-golden bg-maroon-dark px-4 py-2"><MaterialIcons name="pin" size={16} color={pupColors.golden} /><Text className="font-sans-bold text-xs uppercase tracking-[1px] text-golden">PIN {activePinPlain} · announce aloud</Text></View> : null}
                <View className="mt-3 flex-row flex-wrap justify-center gap-2">
                  {[
                    { label: 'Full screen', icon: 'fullscreen' as const, onPress: () => setShowQrModal(true) },
                    { label: 'Copy token', icon: 'content-copy' as const, onPress: () => { void copyQrToken() } },
                    { label: 'Share token', icon: 'share' as const, onPress: () => { void shareQrToken() } },
                    { label: 'Share image', icon: 'image' as const, onPress: () => { void shareQrImage() } },
                    { label: 'Regenerate', icon: 'refresh' as const, onPress: () => openCheckpointPrompt(checkpointTab, { regenerate: true }) },
                  ].map((action) => (
                    <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} className="min-h-11 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                      <MaterialIcons name={action.icon} size={18} color={pupColors.white} />
                      <Text className="font-sans-bold text-xs text-white">{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View className="w-full items-center py-4">
                <MaterialIcons name="qr-code-2" size={44} color="rgba(255,255,255,.25)" />
                <Text className="mb-4 mt-3 text-center font-sans text-xs leading-5 text-white/70">
                  {checkpointTab === 'start'
                    ? 'Generate the start-of-class QR. Students scan it once at the beginning.'
                    : 'Generate the end-of-class QR in the final 5–10 minutes. Zero grace.'}
                </Text>
                <CampusButton
                  testID={checkpointTab === 'start' ? 'session-generate-open' : 'session-generate-end-open'}
                  label={checkpointTab === 'start' ? 'Generate Start QR' : 'Generate End QR'}
                  icon="play-arrow"
                  variant="gold"
                  disabled={checkpointTab === 'end' && !session.isActive}
                  onPress={() => openCheckpointPrompt(checkpointTab)}
                />
                {checkpointTab === 'end' && !session.isActive ? <Text className="mt-2 font-sans text-[10px] text-white/50">Arm Step 1 first.</Text> : null}
              </View>
            )}
            <View className="mt-3 flex-row items-start gap-2 rounded-2xl border border-white/15 p-3">
              <MaterialIcons name="shield" size={15} color={pupColors.golden} />
              <Text className="flex-1 font-sans text-[10px] leading-4 text-white/60">
                No location is collected for online sessions (RA 10173). Students may upload a screenshot; the meeting PIN blocks forwarded images.
              </Text>
            </View>
          </>
        ) : activeQrToken ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open QR code full screen" onPress={() => setShowQrModal(true)} className="self-center rounded-[26px] bg-white p-3"><QRCode value={activeQrToken} size={160} quietZone={6} backgroundColor={pupColors.white} color={pupColors.black} getRef={(ref: QrSvgHandle | null) => { qrCodeRef.current = ref }} /></Pressable>
          {E2E_MODE ? <Text testID="session-e2e-token" selectable numberOfLines={1} className="mt-1 max-w-full text-[1px] text-maroon">{activeQrToken}</Text> : null}
          <Text accessibilityLiveRegion="polite" className="mt-4 text-center font-sans-bold text-sm text-golden">{countdown === 'Grace ended' ? 'Grace period ended' : countdown.includes('Grace') ? countdown : countdown ? `Expires in ${countdown}` : 'Active'}</Text>
          <View className="mt-3 flex-row flex-wrap justify-center gap-2">
            {[
              { label: 'Full screen', icon: 'fullscreen' as const, onPress: () => setShowQrModal(true) },
              { label: 'Copy token', icon: 'content-copy' as const, onPress: () => { void copyQrToken() } },
              { label: 'Share token', icon: 'share' as const, onPress: () => { void shareQrToken() } },
              { label: 'Share image', icon: 'image' as const, onPress: () => { void shareQrImage() } },
            ].map((action) => (
              <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} className="min-h-11 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                <MaterialIcons name={action.icon} size={18} color={pupColors.white} />
                <Text className="font-sans-bold text-xs text-white">{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </> : session.isActive ? <Text className="py-10 text-center font-sans text-sm text-white/60">Generating QR code…</Text> : <View className="w-full items-center py-5"><MaterialIcons name="qr-code-scanner" size={44} color="rgba(255,255,255,.25)" /><Text className="mb-5 mt-3 text-center font-sans text-sm text-white/60">Activate the session and issue a short-lived code.</Text><CampusButton testID="session-generate-open" label="Generate QR code" icon="play-arrow" variant="gold" onPress={() => setShowValidityPrompt(true)} /></View>}
      </CampusCard> : null}

      <SectionHeading eyebrow="Session state" title="Live overview" />
      <AttendanceMetricGrid metrics={[
        { label: 'Present', value: counts.present, tone: 'success' }, { label: 'Late', value: counts.late, tone: 'warning' }, { label: 'Incomplete', value: counts.incomplete, tone: 'excused' }, { label: 'Absent', value: counts.absent, tone: 'danger' }, { label: 'Excused', value: counts.excused, tone: 'excused' }, { label: 'Pending', value: counts.pending, tone: 'neutral' }, { label: 'Disputed', value: counts.disputed, tone: 'disputed' }, { label: session.isActive ? 'Active session' : 'Closed session', value: session.isActive ? 'Live' : 'Ended', tone: 'brand' },
      ]} />

      <CampusCard className="mb-5 p-4">
        <CardTitle icon="info-outline" title="Session details" />
        <View className="flex-row flex-wrap gap-3">{[
          { label: 'Mode', value: onlineMode ? 'Online · No GPS' : 'In-person' },
          { label: 'Status', value: session.isActive ? 'Active' : 'Inactive' },
          onlineMode
            ? { label: 'Start checkpoint', value: `${session.startQrValiditySeconds ?? 90}s + ${session.startGraceMinutes ?? 0}m` }
            : { label: 'QR validity', value: `${session.qrValidityMinutes || 0} min` },
          onlineMode
            ? { label: 'End checkpoint', value: `${session.endQrValiditySeconds ?? 90}s · no grace` }
            : { label: 'Grace period', value: `${session.gracePeriodMinutes} min` },
          { label: 'Realtime', value: realtimeConnected ? 'Connected' : 'Polling' },
        ].map((item) => <View key={item.label} className="min-w-[45%] flex-1 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5"><Text className="font-sans-bold text-[9px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{item.label}</Text><Text className="mt-2 font-sans-bold text-sm text-ink dark:text-white">{item.value}</Text></View>)}</View>
      </CampusCard>

      {onlineMode ? (
        <CampusCard className="mb-5 p-4">
          <CardTitle icon="shield" title="Zero-GPS session" detail="RA 10173" />
          <Text className="font-sans text-xs leading-5 text-muted dark:text-zinc-400">
            Location is not requested, read, or stored for this session. Attendance is verified by the
            start/end QR checkpoints{session.pinRequired ? ' and the announced meeting PIN' : ''}.
          </Text>
        </CampusCard>
      ) : (
        <CampusCard className="mb-5 p-4">
          <CardTitle icon="location-on" title="Geofence evidence" detail={`${radar.recordPinCount} locations`} />
          <View className="mb-3 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full border border-line bg-zinc-50 px-3 py-1.5 dark:border-line-dark dark:bg-white/5">
              <MaterialIcons name="my-location" size={13} color={pupColors.success} />
              <Text accessibilityLabel={`${radar.insideCount} students inside the geofence`} className="font-sans-bold text-[11px] text-ink dark:text-white">Inside: {radar.insideCount}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-line bg-zinc-50 px-3 py-1.5 dark:border-line-dark dark:bg-white/5">
              <MaterialIcons name="gps-off" size={13} color={pupColors.danger} />
              <Text accessibilityLabel={`${radar.deniedCount} denied scan attempts`} className="font-sans-bold text-[11px] text-ink dark:text-white">Denied: {radar.deniedCount}</Text>
            </View>
            <Text className="flex-1 text-right font-sans text-[10px] text-muted dark:text-zinc-500">Live geofence radar</Text>
          </View>
          <View className="overflow-hidden rounded-2xl"><MapView latitude={session.geofence!.latitude} longitude={session.geofence!.longitude} radius={session.geofence!.radiusMeters} studentPins={radar.mapPins} /></View>
          {radar.deniedLog.length || radar.noGps.length ? (
            <View className="mt-3 gap-2" accessibilityLabel={formatRadarCounters(radar.insideCount, radar.deniedCount)}>
              {radar.deniedLog.map((entry) => <RadarDeniedRow key={entry.key} entry={entry} />)}
              {radar.noGps.length ? (
                <View className="rounded-2xl border border-line bg-zinc-50 px-3 py-2.5 dark:border-line-dark dark:bg-white/5">
                  <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-500">No GPS fix · {radar.noGps.length}</Text>
                  <Text className="mt-1 font-sans text-[11px] leading-4 text-ink dark:text-zinc-200" numberOfLines={3}>
                    {radar.noGps.map((entry) => entry.studentName).join(' · ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View className="mt-3 flex-row gap-2">{[
            { label: 'Latitude', value: session.geofence!.latitude.toFixed(5) }, { label: 'Longitude', value: session.geofence!.longitude.toFixed(5) }, { label: 'Radius', value: `${session.geofence!.radiusMeters} m` },
          ].map((item) => <View key={item.label} className="flex-1 rounded-xl bg-zinc-50 p-2 dark:bg-white/5"><Text className="font-sans text-[9px] text-muted dark:text-zinc-500">{item.label}</Text><Text className="mt-1 font-sans-bold text-[10px] text-ink dark:text-white">{item.value}</Text></View>)}</View>
        </CampusCard>
      )}

      <CampusCard className="mb-5 p-4">
        <CardTitle icon="camera-alt" title="Proof of class" detail={`${proofsOfClass.length} uploads`} />
        {!proofsOfClass.length ? <CampusEmptyState icon="add-a-photo" title="No proof uploaded" description="QAC officers can attach classroom evidence during this session." /> : <View className="flex-row flex-wrap gap-3">{proofsOfClass.map((proof) => <View key={proof.id} className="min-w-[46%] flex-1 rounded-2xl border border-line bg-zinc-50 p-3 dark:border-line-dark dark:bg-white/5"><View className="mb-3 aspect-video items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800"><MaterialIcons name="camera-alt" size={25} color={isDark ? pupColors.mutedLight : pupColors.muted} /></View><Text className="font-sans-bold text-xs text-ink dark:text-white" numberOfLines={1}>{proof.uploadedByStudentName}</Text><Text className="mt-1 font-sans text-[9px] text-muted dark:text-zinc-500">{new Date(proof.uploadedAt).toLocaleString()}</Text>{proof.description ? <Text className="mt-2 font-sans text-[10px] italic text-muted dark:text-zinc-400" numberOfLines={2}>{proof.description}</Text> : null}{isTeacher ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete proof by ${proof.uploadedByStudentName}`} onPress={() => { void api.deleteProofOfClass(proof.id).then(refreshData).catch((error) => showToast('error', 'Unable to delete proof', error instanceof Error ? error.message : 'Please try again.')) }} className="mt-2 min-h-10 flex-row items-center gap-1"><MaterialIcons name="delete-outline" size={15} color={isDark ? pupColors.dangerLight : pupColors.danger} /><Text className="font-sans-bold text-[10px] text-red-600 dark:text-red-300">Delete</Text></Pressable> : null}</View>)}</View>}
      </CampusCard>

      <SectionHeading eyebrow="Roster" title="Student attendance" />
      <CampusCard className="mb-5 p-0">
        <View className="border-b border-line px-4 pb-3 pt-4 dark:border-line-dark"><View className="flex-row items-center justify-between"><Text className="font-sans-bold text-sm text-ink dark:text-white">{enrolledStudents.length} enrolled students</Text><Text accessibilityLiveRegion="polite" className="font-sans text-[10px] text-muted dark:text-zinc-500">{refreshLabel}</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pt-4">{FILTERS.map((status) => {
            const active = filter === status
            return <Pressable key={status} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { setFilter(status); setRosterPage(1) }} className={`min-h-11 justify-center rounded-full border px-4 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}><Text className={`font-sans-bold text-xs capitalize ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{status}</Text></Pressable>
          })}</ScrollView>
        </View>
        {!filteredStudents.length ? <View className="p-4"><CampusEmptyState icon="group-off" title={enrolledStudents.length ? 'No matching students' : 'No enrolled students'} description={enrolledStudents.length ? 'Choose a different attendance filter.' : 'Add students from the section details screen.'} /></View> : pagedStudents.map((student) => {
          const record = studentMap.get(student.id)
          const status = record?.status ?? 'pending'
          return <Pressable key={student.id} testID={`session-roster-${student.id}-${status}`} disabled={!isTeacher} accessibilityRole={isTeacher ? 'button' : undefined} accessibilityLabel={isTeacher ? `Change ${student.fullName} attendance, currently ${status}` : undefined} onPress={() => void override(student.id, status)} className="min-h-16 flex-row items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 dark:border-line-dark"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">{student.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{student.fullName}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{student.studentId}{record?.manuallySet ? ' · Manual override' : ''}</Text>
            {onlineMode ? (
              <View className="mt-1 flex-row gap-1">
                <Text accessibilityLabel={record?.checkInTime ? `Checked in${record.checkInStatus === 'late' ? ' late' : ''}` : 'No check-in'} className={`rounded border px-1.5 py-0.5 font-sans-bold text-[9px] uppercase ${record?.checkInStatus ? (record.checkInStatus === 'late' ? 'border-maroon bg-maroon text-white' : 'border-golden bg-golden/20 text-maroon dark:text-golden') : 'border-zinc-300 text-zinc-400 dark:border-zinc-700'}`}>In{record?.checkInStatus === 'late' ? ' · late' : record?.checkInStatus ? ' ✓' : ' —'}</Text>
                <Text accessibilityLabel={record?.checkOutTime ? 'Checked out' : 'No check-out'} className={`rounded border px-1.5 py-0.5 font-sans-bold text-[9px] uppercase ${record?.checkOutStatus ? 'border-golden bg-golden text-maroon-dark' : 'border-zinc-300 text-zinc-400 dark:border-zinc-700'}`}>Out{record?.checkOutStatus ? ' ✓' : ' —'}</Text>
              </View>
            ) : null}
          </View><AttendanceStatusPill status={status} />{isTeacher ? <MaterialIcons name="chevron-right" size={19} color={isDark ? pupColors.mutedLight : pupColors.muted} /> : null}</Pressable>
        })}
        {rosterPageCount > 1 ? <View className="flex-row items-center justify-between border-t border-line px-4 py-3 dark:border-line-dark"><CampusButton className="min-h-11 px-3" label="Previous" variant="secondary" disabled={safeRosterPage === 1} onPress={() => setRosterPage((page) => Math.max(1, page - 1))} /><Text className="font-sans-medium text-xs text-muted dark:text-zinc-400">Page {safeRosterPage} of {rosterPageCount}</Text><CampusButton className="min-h-11 px-3" label="Next" variant="secondary" disabled={safeRosterPage === rosterPageCount} onPress={() => setRosterPage((page) => Math.min(rosterPageCount, page + 1))} /></View> : null}
      </CampusCard>

      {isTeacher && session.isActive ? <CampusButton label="End session" icon="stop" onPress={endSession} className="border-red-600 bg-red-600 dark:border-red-600 dark:bg-red-600" /> : null}
    </ScrollView>

    <Modal visible={isTeacher && showValidityPrompt} transparent animationType="slide" onRequestClose={() => setShowValidityPrompt(false)}>
      <Pressable className="flex-1 justify-end bg-black/80" onPress={() => setShowValidityPrompt(false)}>
        <Pressable onPress={() => undefined} className="rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-surface-dark">
          <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
          <View className="mb-5 flex-row items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-golden">
              <MaterialIcons name="timer" size={23} color={pupColors.maroonDark} />
            </View>
            <View className="flex-1">
              <Text className="font-heading text-2xl text-ink dark:text-white">QR settings</Text>
              <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">Set a short validity window and a late-arrival grace period.</Text>
            </View>
          </View>
          <View className="mb-5 flex-row gap-3">
            {[
              { label: 'QR validity', value: validityMinutes, setValue: setValidityMinutes, hint: '1–15 min' },
              { label: 'Grace period', value: graceMinutes, setValue: setGraceMinutes, hint: '0–60 min' },
            ].map((field) => (
              <View key={field.label} className="flex-1">
                <Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">{field.label}</Text>
                <View className="min-h-14 flex-row items-center rounded-2xl border border-zinc-300 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-white/5">
                  <TextInput accessibilityLabel={field.label} className="flex-1 text-center font-heading text-xl text-ink dark:text-white" keyboardType="number-pad" value={field.value} onChangeText={field.setValue} />
                  <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">min</Text>
                </View>
                <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{field.hint}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row gap-3">
            <CampusButton className="flex-1" label="Cancel" variant="secondary" onPress={() => setShowValidityPrompt(false)} />
            <CampusButton testID="session-generate-submit" className="flex-1" label="Generate" icon="qr-code-2" onPress={() => void generateQr()} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>

      <Modal visible={isTeacher && showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}><Pressable accessibilityRole="button" accessibilityLabel="Close full-screen QR code" className="flex-1 items-center justify-center bg-black/95 px-5" onPress={() => setShowQrModal(false)}>{activeQrToken ? <View className="rounded-[32px] bg-white p-4"><QRCode value={activeQrToken} size={270} quietZone={8} backgroundColor={pupColors.white} color={pupColors.black} /></View> : null}{onlineMode && activePinPlain ? <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-golden px-4 py-2"><MaterialIcons name="pin" size={16} color={pupColors.golden} /><Text className="font-sans-bold text-sm uppercase tracking-[1px] text-golden">PIN {activePinPlain} · announce aloud</Text></View> : null}<Text className="mt-6 font-sans-medium text-sm text-white/60">Tap anywhere to close</Text></Pressable></Modal>

      <Modal visible={isTeacher && showCheckpointPrompt} transparent animationType="slide" onRequestClose={() => setShowCheckpointPrompt(false)}>
        <Pressable className="flex-1 justify-end bg-black/80" onPress={() => setShowCheckpointPrompt(false)}>
          <Pressable onPress={() => undefined} className="rounded-t-[36px] border-t-2 border-x border-maroon/20 bg-white px-5 pb-10 pt-4 shadow-2xl dark:border-golden/25 dark:bg-surface-dark">
            <View className="mb-4 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
            <View className="mb-5 flex-row items-start gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-golden">
                <MaterialIcons name="pin" size={23} color={pupColors.maroonDark} />
              </View>
              <View className="flex-1">
                <Text className="font-heading text-2xl text-ink dark:text-white">
                  {regeneratingCheckpoint ? 'Regenerate' : 'Generate'} {checkpointTab === 'start' ? 'start' : 'end'} QR
                </Text>
                <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">
                  {checkpointTab === 'start'
                    ? 'Students check in once when the online lecture begins.'
                    : 'Students check out at the end. Zero grace: late check-outs are rejected.'}
                </Text>
              </View>
            </View>
            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">Validity (seconds)</Text>
                <View className="min-h-14 flex-row items-center rounded-2xl border border-zinc-300 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-white/5">
                  <TextInput accessibilityLabel="Checkpoint validity seconds" className="flex-1 text-center font-heading text-xl text-ink dark:text-white" keyboardType="number-pad" value={checkpointValiditySeconds} onChangeText={setCheckpointValiditySeconds} />
                  <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">sec</Text>
                </View>
                <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">60–300 sec</Text>
              </View>
              {checkpointTab === 'start' ? (
                <View className="flex-1">
                  <Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">Grace (minutes)</Text>
                  <View className="min-h-14 flex-row items-center rounded-2xl border border-zinc-300 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-white/5">
                    <TextInput accessibilityLabel="Check-in grace minutes" className="flex-1 text-center font-heading text-xl text-ink dark:text-white" keyboardType="number-pad" value={checkpointGraceMinutes} onChangeText={setCheckpointGraceMinutes} />
                    <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">min</Text>
                  </View>
                  <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">0–60 min</Text>
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: checkpointPinRequired }}
              onPress={() => {
                setCheckpointPinRequired((value) => !value)
                if (checkpointPinRequired) setCheckpointPin('')
              }}
              className="mb-3 min-h-12 flex-row items-center justify-between rounded-2xl border border-zinc-300 px-4 dark:border-zinc-700"
            >
              <Text className="font-sans-bold text-xs text-ink dark:text-zinc-200">Require meeting PIN</Text>
              <View className={`h-6 w-11 justify-center rounded-full px-0.5 ${checkpointPinRequired ? 'bg-maroon dark:bg-golden' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <View className={`h-5 w-5 rounded-full bg-white ${checkpointPinRequired ? 'self-end' : 'self-start'}`} />
              </View>
            </Pressable>
            {checkpointPinRequired ? (
              <View className="mb-3">
                <View className="flex-row gap-2">
                  <View className="min-h-14 flex-1 flex-row items-center rounded-2xl border border-zinc-300 bg-zinc-50 px-4 dark:border-zinc-700 dark:bg-white/5">
                    <TextInput
                      accessibilityLabel="Meeting PIN"
                      className="flex-1 text-center font-heading text-xl tracking-[6px] text-ink dark:text-white"
                      keyboardType="number-pad"
                      maxLength={4}
                      value={checkpointPin}
                      onChangeText={(value) => setCheckpointPin(value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="2–4 digits"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : pupColors.mutedLight}
                    />
                  </View>
                  <CampusButton
                    className="px-4"
                    label="Auto"
                    variant="secondary"
                    onPress={() => setCheckpointPin(randomMeetingPin(3, (length) => Crypto.getRandomBytes(length)))}
                  />
                </View>
                <Text className="mt-2 font-sans text-[10px] leading-4 text-muted dark:text-zinc-400">
                  Announce this PIN verbally in the meeting. Screenshots cannot carry audio.
                </Text>
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <CampusButton className="flex-1" label="Cancel" variant="secondary" onPress={() => setShowCheckpointPrompt(false)} />
              <CampusButton
                testID="session-generate-checkpoint-submit"
                className="flex-1"
                label={regeneratingCheckpoint ? 'Regenerate' : 'Generate'}
                icon="qr-code-2"
                onPress={() => void generateCheckpointQr()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
