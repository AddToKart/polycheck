import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import type { AttendanceRecord, AttendanceStatus, ProofOfClass, Session, Student, User } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useAuthGate } from '../../../hooks/use-auth-gate'
import { sharePngFile } from '../../../services/file-sharing'
import { useTheme } from '../../../theme/ThemeContext'
import { pupColors } from '../../../theme/colors'
import MapView, { type StudentMapPin } from '../../../components/MapView'
import { subscribeToSession } from '../../../services/realtime'
import { CampusHeader } from '../../../components/CampusHeader'
import { AttendanceStatusPill, CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../../components/CampusPrimitives'
import { AttendanceMetricGrid } from '../../../components/AttendanceReportCards'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']
const FILTERS: Array<AttendanceStatus | 'all'> = ['all', 'present', 'late', 'absent', 'pending', 'disputed']
const ROSTER_PAGE_SIZE = 20
const E2E_MODE = process.env.EXPO_PUBLIC_E2E_MODE === 'true'
type QrSvgHandle = { toDataURL: (callback: (base64: string) => void) => void }

const CardTitle = ({ icon, title, detail }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail?: string }) => {
  const { isDark } = useTheme()
  return <View className="mb-4 flex-row items-center gap-2"><View className="h-9 w-9 items-center justify-center rounded-xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name={icon} size={18} color={isDark ? pupColors.golden : pupColors.maroon} /></View><Text className="flex-1 font-sans-bold text-base text-ink dark:text-white">{title}</Text>{detail ? <Text className="font-sans-medium text-xs text-muted dark:text-zinc-400">{detail}</Text> : null}</View>
}

export default function SessionDetailScreen() {
  const { isDark, toggle } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const currentUser = useAuthGate(['teacher', 'super_admin'])
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [rosterPage, setRosterPage] = useState(1)
  const [proofsOfClass, setProofsOfClass] = useState<ProofOfClass[]>([])
  const [showQrModal, setShowQrModal] = useState(false)
  const [showValidityPrompt, setShowValidityPrompt] = useState(false)
  const [validityMinutes, setValidityMinutes] = useState('15')
  const [graceMinutes, setGraceMinutes] = useState('15')
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
    } catch { Alert.alert('Unable to refresh session', 'Please check your connection and try again.') }
  }, [id])

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

  useEffect(() => {
    if (!session?.isActive || !session.qrTokenExpiresAt) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    const tick = () => {
      const expiry = new Date(session.qrTokenExpiresAt!).getTime()
      const remaining = expiry - Date.now()
      if (remaining <= 0) {
        const graceRemaining = expiry + session.gracePeriodMinutes * 60_000 - Date.now()
        if (graceRemaining <= 0) setCountdown('Grace ended')
        else setCountdown(`Grace: ${Math.floor(graceRemaining / 60_000)}:${Math.floor((graceRemaining % 60_000) / 1000).toString().padStart(2, '0')}`)
        return
      }
      setCountdown(`${Math.floor(remaining / 60_000)}:${Math.floor((remaining % 60_000) / 1000).toString().padStart(2, '0')}`)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session])

  useEffect(() => { if (id) return subscribeToSession(id, () => { void refreshData() }, setRealtimeConnected) }, [id, refreshData])
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

  const studentPins = useMemo<StudentMapPin[]>(() => records.filter((record) => record.coordinates && (record.coordinates.latitude !== 0 || record.coordinates.longitude !== 0)).map((record) => ({ id: record.studentId, latitude: record.coordinates.latitude, longitude: record.coordinates.longitude, label: record.studentName, program: record.studentProgram, status: record.status, timestamp: record.timestamp, deviceId: record.deviceId })), [records])

  if (!user || !session) return null
  const isTeacher = user.role === 'teacher'
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
    absent: records.filter((record) => record.status === 'absent').length,
    pending: records.filter((record) => record.status === 'pending').length,
    disputed: records.filter((record) => record.status === 'disputed').length,
  }

  const generateQr = async () => {
    const validity = Number(validityMinutes)
    const grace = Number(graceMinutes)
    if (!Number.isInteger(validity) || validity < 1 || validity > 15 || !Number.isInteger(grace) || grace < 0 || grace > 60) {
      Alert.alert('Check QR settings', 'Validity must be 1–15 minutes and grace period must be 0–60 minutes.')
      return
    }
    try { await api.generateQrCode(session.id, validity, grace); setShowValidityPrompt(false); await refreshData() }
    catch (error) { Alert.alert('Unable to generate QR code', error instanceof Error ? error.message : 'Please try again.') }
  }

  const endSession = () => Alert.alert('End session?', 'Pending students will be marked absent and the session will close.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'End session', style: 'destructive', onPress: () => { void api.endSession(session.id).then(refreshData) } },
  ])

  const override = async (studentId: string, currentStatus: AttendanceStatus) => {
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    try {
      const existing = records.find((record) => record.studentId === studentId && record.sessionId === session.id)
      if (existing) await api.updateAttendanceStatus(existing.id, nextStatus)
      else {
        const student = enrolledStudents.find((item) => item.id === studentId)
        await api.addAttendanceRecord({ id: `a-${Date.now()}`, sessionId: session.id, sectionId: session.sectionId, studentId, studentName: student?.fullName ?? 'Unknown', timestamp: new Date().toISOString(), status: nextStatus, coordinates: { latitude: 0, longitude: 0 }, deviceId: 'manual', isSynced: true, syncedAt: new Date().toISOString(), manuallySet: true })
      }
      await refreshData()
    } catch (error) { Alert.alert('Unable to update attendance', error instanceof Error ? error.message : 'Please try again.') }
  }

  const copyQrToken = async () => {
    if (!session.qrToken) return
    await Clipboard.setStringAsync(session.qrToken)
    Alert.alert('QR token copied', 'The signed session token is ready to paste.')
  }

  const shareQrToken = async () => {
    if (!session.qrToken) return
    await Share.share({
      title: `${session.subjectName} attendance QR`,
      message: session.qrToken,
    })
  }

  const shareQrImage = async () => {
    const qrCode = qrCodeRef.current
    if (!qrCode) {
      Alert.alert('QR image unavailable', 'Wait for the QR code to finish rendering and try again.')
      return
    }
    try {
      const base64 = await new Promise<string>((resolve) => qrCode.toDataURL(resolve))
      await sharePngFile(base64, `polycheck-qr-${session.id}.png`)
    } catch (error) {
      Alert.alert('Unable to share QR image', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Live attendance"
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
      {isTeacher ? <CampusCard className="mb-5 items-center overflow-hidden bg-maroon dark:bg-maroon-deep">
        <View className="mb-4 w-full flex-row items-center"><View className="h-9 w-9 items-center justify-center rounded-xl bg-white/10"><MaterialIcons name="qr-code-2" size={19} color={pupColors.golden} /></View><View className="ml-3 flex-1"><Text className="font-sans-bold text-base text-white">Session QR</Text><Text className="mt-1 font-sans text-xs text-white/60">Students scan this code inside the geofence.</Text></View></View>
        {session.qrToken ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open QR code full screen" onPress={() => setShowQrModal(true)} className="rounded-[26px] bg-white p-3"><QRCode value={session.qrToken} size={160} quietZone={6} backgroundColor="#FFFFFF" color="#0A0A0A" getRef={(ref: QrSvgHandle | null) => { qrCodeRef.current = ref }} /></Pressable>
          {E2E_MODE ? <Text testID="session-e2e-token" selectable numberOfLines={1} className="mt-1 max-w-full text-[1px] text-maroon">{session.qrToken}</Text> : null}
          <Text accessibilityLiveRegion="polite" className="mt-4 font-sans-bold text-sm text-golden">{countdown === 'Grace ended' ? 'Grace period ended' : countdown.includes('Grace') ? countdown : countdown ? `Expires in ${countdown}` : 'Active'}</Text>
          <View className="mt-3 flex-row flex-wrap justify-center gap-2">
            {[
              { label: 'Full screen', icon: 'fullscreen' as const, onPress: () => setShowQrModal(true) },
              { label: 'Copy token', icon: 'content-copy' as const, onPress: () => { void copyQrToken() } },
              { label: 'Share token', icon: 'share' as const, onPress: () => { void shareQrToken() } },
              { label: 'Share image', icon: 'image' as const, onPress: () => { void shareQrImage() } },
            ].map((action) => (
              <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} className="min-h-11 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                <MaterialIcons name={action.icon} size={18} color="#FFFFFF" />
                <Text className="font-sans-bold text-xs text-white">{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </> : session.isActive ? <Text className="py-10 font-sans text-sm text-white/60">Generating QR code…</Text> : <View className="w-full items-center py-5"><MaterialIcons name="qr-code-scanner" size={44} color="rgba(255,255,255,.25)" /><Text className="mb-5 mt-3 text-center font-sans text-sm text-white/60">Activate the session and issue a short-lived code.</Text><CampusButton testID="session-generate-open" label="Generate QR code" icon="play-arrow" variant="gold" onPress={() => setShowValidityPrompt(true)} /></View>}
      </CampusCard> : null}

      <SectionHeading eyebrow="Session state" title="Live overview" />
      <AttendanceMetricGrid metrics={[
        { label: 'Present', value: counts.present, tone: 'success' }, { label: 'Late', value: counts.late, tone: 'warning' }, { label: 'Absent', value: counts.absent, tone: 'danger' }, { label: 'Pending', value: counts.pending, tone: 'neutral' }, { label: 'Disputed', value: counts.disputed, tone: 'disputed' }, { label: session.isActive ? 'Active session' : 'Closed session', value: session.isActive ? 'Live' : 'Ended', tone: 'brand' },
      ]} />

      <CampusCard className="mb-5 p-4">
        <CardTitle icon="info-outline" title="Session details" />
        <View className="flex-row flex-wrap gap-3">{[
          { label: 'Status', value: session.isActive ? 'Active' : 'Inactive' },
          { label: 'QR validity', value: `${session.qrValidityMinutes || 0} min` },
          { label: 'Grace period', value: `${session.gracePeriodMinutes} min` },
          { label: 'Realtime', value: realtimeConnected ? 'Connected' : 'Polling' },
        ].map((item) => <View key={item.label} className="min-w-[45%] flex-1 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5"><Text className="font-sans-bold text-[9px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{item.label}</Text><Text className="mt-2 font-sans-bold text-sm text-ink dark:text-white">{item.value}</Text></View>)}</View>
      </CampusCard>

      <CampusCard className="mb-5 p-4">
        <CardTitle icon="location-on" title="Geofence evidence" detail={`${studentPins.length} locations`} />
        <View className="overflow-hidden rounded-2xl"><MapView latitude={session.geofence.latitude} longitude={session.geofence.longitude} radius={session.geofence.radiusMeters} studentPins={studentPins} /></View>
        <View className="mt-3 flex-row gap-2">{[
          { label: 'Latitude', value: session.geofence.latitude.toFixed(5) }, { label: 'Longitude', value: session.geofence.longitude.toFixed(5) }, { label: 'Radius', value: `${session.geofence.radiusMeters} m` },
        ].map((item) => <View key={item.label} className="flex-1 rounded-xl bg-zinc-50 p-2 dark:bg-white/5"><Text className="font-sans text-[9px] text-muted dark:text-zinc-500">{item.label}</Text><Text className="mt-1 font-sans-bold text-[10px] text-ink dark:text-white">{item.value}</Text></View>)}</View>
      </CampusCard>

      <CampusCard className="mb-5 p-4">
        <CardTitle icon="camera-alt" title="Proof of class" detail={`${proofsOfClass.length} uploads`} />
        {!proofsOfClass.length ? <CampusEmptyState icon="add-a-photo" title="No proof uploaded" description="QAC officers can attach classroom evidence during this session." /> : <View className="flex-row flex-wrap gap-3">{proofsOfClass.map((proof) => <View key={proof.id} className="min-w-[46%] flex-1 rounded-2xl border border-line bg-zinc-50 p-3 dark:border-line-dark dark:bg-white/5"><View className="mb-3 aspect-video items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800"><MaterialIcons name="camera-alt" size={25} color="#746C6E" /></View><Text className="font-sans-bold text-xs text-ink dark:text-white" numberOfLines={1}>{proof.uploadedByStudentName}</Text><Text className="mt-1 font-sans text-[9px] text-muted dark:text-zinc-500">{new Date(proof.uploadedAt).toLocaleString()}</Text>{proof.description ? <Text className="mt-2 font-sans text-[10px] italic text-muted dark:text-zinc-400" numberOfLines={2}>{proof.description}</Text> : null}{isTeacher ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete proof by ${proof.uploadedByStudentName}`} onPress={() => { void api.deleteProofOfClass(proof.id).then(refreshData) }} className="mt-2 min-h-10 flex-row items-center gap-1"><MaterialIcons name="delete-outline" size={15} color="#DC2626" /><Text className="font-sans-bold text-[10px] text-red-600">Delete</Text></Pressable> : null}</View>)}</View>}
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
          return <Pressable key={student.id} testID={`session-roster-${student.id}-${status}`} disabled={!isTeacher} accessibilityRole={isTeacher ? 'button' : undefined} accessibilityLabel={isTeacher ? `Change ${student.fullName} attendance, currently ${status}` : undefined} onPress={() => void override(student.id, status)} className="min-h-16 flex-row items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 dark:border-line-dark"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">{student.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{student.fullName}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{student.studentId}{record?.manuallySet ? ' · Manual override' : ''}</Text></View><AttendanceStatusPill status={status} />{isTeacher ? <MaterialIcons name="chevron-right" size={19} color="#746C6E" /> : null}</Pressable>
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

      <Modal visible={isTeacher && showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}><Pressable accessibilityRole="button" accessibilityLabel="Close full-screen QR code" className="flex-1 items-center justify-center bg-black/95 px-5" onPress={() => setShowQrModal(false)}>{session.qrToken ? <View className="rounded-[32px] bg-white p-4"><QRCode value={session.qrToken} size={270} quietZone={8} backgroundColor="#FFFFFF" color="#0A0A0A" /></View> : null}<Text className="mt-6 font-sans-medium text-sm text-white/60">Tap anywhere to close</Text></Pressable></Modal>
    </SafeAreaView>
  )
}
