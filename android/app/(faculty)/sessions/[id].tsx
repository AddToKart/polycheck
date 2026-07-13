import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import MapView, { type StudentMapPin } from '../../../components/MapView'
import type { User, Session, AttendanceRecord, AttendanceStatus, Student, ProofOfClass } from '@polycheck/shared'
import { subscribeToSession } from '../../../services/realtime'
import QRCode from 'react-native-qrcode-svg'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']

export default function SessionDetailScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [proofsOfClass, setProofsOfClass] = useState<ProofOfClass[]>([])
  const [showQrModal, setShowQrModal] = useState(false)
  const [showValidityPrompt, setShowValidityPrompt] = useState(false)
  const [validityMinutes, setValidityMinutes] = useState('20')
  const [countdown, setCountdown] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshLabel, setRefreshLabel] = useState('Updated just now')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshData = useCallback(async () => {
    if (!id) return
    try {
      const [nextSession, nextRecords, nextProofs] = await Promise.all([
        api.getSession(id),
        api.getAttendanceRecords(id),
        api.getProofsOfClass(id),
      ])
      setSession(nextSession)
      setRecords(nextRecords)
      setProofsOfClass(nextProofs)
      setLastUpdated(new Date())
    } catch {
      Alert.alert('Unable to refresh session', 'Please check your connection and try again.')
    }
  }, [id])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu) { router.replace('/'); return }
    setUser(cu)
    if (!id) return
    void api.getSession(id).then(async (nextSession) => {
      const section = await api.getSection(nextSession.sectionId)
      if (cu.role === 'teacher' && section.teacherId !== cu.id) { router.replace('/'); return }
      const students = await api.getSectionStudents(section.id)
      setEnrolledStudents(students.map(({ attendance: _attendance, ...student }) => student))
      await refreshData()
    }).catch(() => router.replace('/'))
  }, [id, refreshData])

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
        if (graceDiff <= 0) {
          setCountdown('Grace ended')
        } else {
          const gm = Math.floor(graceDiff / 60000)
          const gs = Math.floor((graceDiff % 60000) / 1000)
          setCountdown(`Grace: ${gm}:${gs.toString().padStart(2, '0')}`)
        }
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session])

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
    pollRef.current = setInterval(() => { void refreshData() }, 10000)
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

  if (!user || !session) return null

  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#EEE'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const textTertiary = isDark ? 'rgba(255,255,255,0.5)' : '#999'

  const filteredRecords = filter === 'all' ? records : records.filter((r) => r.status === filter)
  const presentCount = records.filter((r) => r.status === 'present').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const absentCount = records.filter((r) => r.status === 'absent').length
  const pendingCount = records.filter((r) => r.status === 'pending').length

  const studentMap = new Map(records.map((r) => [r.studentId, r]))

  const studentPins: StudentMapPin[] = records
    .filter((r) => r.coordinates && (r.coordinates.latitude !== 0 || r.coordinates.longitude !== 0))
    .map((r) => ({
      id: r.studentId,
      latitude: r.coordinates.latitude,
      longitude: r.coordinates.longitude,
      label: r.studentName,
      program: r.studentProgram,
      status: r.status,
      timestamp: r.timestamp,
      deviceId: r.deviceId,
    }))

  const handleGenerateQr = async () => {
    const mins = parseInt(validityMinutes, 10)
    if (isNaN(mins) || mins < 1) return
    try {
      await api.generateQrCode(session.id, mins)
      setShowValidityPrompt(false)
      await refreshData()
    } catch (error) {
      Alert.alert('Unable to generate QR code', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleEndSession = () => {
    Alert.alert('End Session', 'Mark all pending students as absent and end the session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: () => { void api.endSession(session.id).then(refreshData) } },
    ])
  }

  const handleManualOverride = async (studentId: string, currentStatus: AttendanceStatus) => {
    const idx = STATUS_CYCLE.indexOf(currentStatus)
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const existing = records.find((r) => r.studentId === studentId && r.sessionId === session.id)
    if (existing) {
      await api.updateAttendanceStatus(existing.id, nextStatus)
    } else {
      const student = enrolledStudents.find((s) => s.id === studentId)
      await api.addAttendanceRecord({
        id: `a-${Date.now()}`,
        sessionId: session.id,
        sectionId: session.sectionId,
        studentId,
        studentName: student?.fullName ?? 'Unknown',
        timestamp: new Date().toISOString(),
        status: nextStatus,
        coordinates: { latitude: 0, longitude: 0 },
        deviceId: 'manual',
        isSynced: true,
        syncedAt: new Date().toISOString(),
        manuallySet: true,
      })
    }
    await refreshData()
  }

  const handleShare = async () => {
    if (session.qrToken) {
      await Clipboard.setStringAsync(session.qrToken)
      Alert.alert('Copied', 'QR token copied to clipboard. You can share it in your class group chat.')
    }
  }

  const handleRefresh = () => {
    void refreshData()
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.heading, isDark && styles.textGolden]} numberOfLines={1}>{session.subjectName}</Text>
          <Text style={[styles.headerSub, isDark && styles.textWhite50]}>
            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}{session.startTime}-{session.endTime}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.iconBtn}>
          <MaterialIcons name="refresh" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* QR Code Card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="qr-code" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>QR Code</Text>
          </View>
          <View style={styles.qrContainer}>
            {session.qrToken ? (
              <>
                <TouchableOpacity onPress={() => setShowQrModal(true)} style={styles.qrContainer}>
                  <QRCode value={session.qrToken} size={140} quietZone={10} backgroundColor="#FFFFFF" color="#0A0A0A" />
                </TouchableOpacity>
                {countdown ? (
                  <Text style={[styles.countdown, isDark && styles.textWhite70]}>
                    {countdown === 'Grace ended' ? 'Grace period ended' : countdown.includes('Grace') ? countdown : `Expires in: ${countdown}`}
                  </Text>
                ) : null}
                <View style={styles.qrActions}>
                  <TouchableOpacity style={[styles.qrActionBtn, isDark && styles.qrActionBtnDark]} onPress={() => setShowQrModal(true)}>
                    <MaterialIcons name="fullscreen" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
                    <Text style={[styles.qrActionText, isDark && styles.qrActionTextDark]}>Full Screen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qrActionBtn, isDark && styles.qrActionBtnDark]} onPress={handleShare}>
                    <MaterialIcons name="share" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
                    <Text style={[styles.qrActionText, isDark && styles.qrActionTextDark]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : session.isActive ? (
              <Text style={[styles.qrHint, isDark && styles.textWhite50]}>Generating QR...</Text>
            ) : (
              <>
                <Text style={[styles.qrHint, isDark && styles.textWhite50]}>Generate a QR code to start the session</Text>
                <TouchableOpacity
                  style={[styles.activateBtn, isDark && styles.activateBtnDark]}
                  onPress={() => setShowValidityPrompt(true)}
                  accessibilityRole="button"
                >
                  <MaterialIcons name="play-arrow" size={18} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
                  <Text style={[styles.activateText, isDark && styles.activateTextDark]}>Generate QR Code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Session Info */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="info" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Session Info</Text>
          </View>
          <View style={styles.infoGrid}>
            <View>
              <Text style={[styles.infoLabel, isDark && styles.textWhite50]}>Status</Text>
              <View style={[styles.statusBadge, session.isActive ? styles.statusActive : (isDark ? styles.statusInactiveDark : styles.statusInactive)]}>
                <Text style={session.isActive ? styles.statusActiveText : (isDark ? styles.statusInactiveTextDark : styles.statusInactiveText)}>
                  {session.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            {session.isActive && session.qrValidityMinutes ? (
              <View>
                <Text style={[styles.infoLabel, isDark && styles.textWhite50]}>QR Validity</Text>
                <Text style={[styles.infoValue, isDark && styles.textWhite]}>{session.qrValidityMinutes} min</Text>
              </View>
            ) : null}
            <View>
              <Text style={[styles.infoLabel, isDark && styles.textWhite50]}>Grace Period</Text>
              <Text style={[styles.infoValue, isDark && styles.textWhite]}>{session.gracePeriodMinutes} min</Text>
            </View>
          </View>
        </View>

        {/* Geofence Map */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Geofence</Text>
          </View>
          <MapView latitude={session.geofence.latitude} longitude={session.geofence.longitude} radius={session.geofence.radiusMeters} studentPins={studentPins} />
          <View style={styles.coordRow}>
            <View style={styles.coord}>
              <Text style={[styles.coordLabel, isDark && styles.textWhite50]}>Lat</Text>
              <Text style={[styles.coordValue, isDark && styles.textWhite]}>{session.geofence.latitude}</Text>
            </View>
            <View style={styles.coord}>
              <Text style={[styles.coordLabel, isDark && styles.textWhite50]}>Lng</Text>
              <Text style={[styles.coordValue, isDark && styles.textWhite]}>{session.geofence.longitude}</Text>
            </View>
            <View style={styles.coord}>
              <Text style={[styles.coordLabel, isDark && styles.textWhite50]}>Radius</Text>
              <Text style={[styles.coordValue, isDark && styles.textWhite]}>{session.geofence.radiusMeters}m</Text>
            </View>
          </View>
        </View>

        {/* Proof of Class */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="camera-alt" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Proof of Class</Text>
            <Text style={[styles.rosterCount, isDark && styles.textWhite50]}>({proofsOfClass.length})</Text>
          </View>
          {proofsOfClass.length === 0 ? (
            <Text style={[styles.empty, isDark && styles.textWhite50]}>No proof photos uploaded yet.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {proofsOfClass.map((poc) => (
                <View key={poc.id} style={{ width: '47%', backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', borderWidth: 1, borderColor: border, padding: 10 }}>
                  <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: isDark ? '#1A1A1D' : '#E5E5E5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <MaterialIcons name="camera-alt" size={24} color={isDark ? 'rgba(255,255,255,0.3)' : '#BBB'} />
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: textPrimary }}>{poc.uploadedByStudentName}</Text>
                  <Text style={{ fontSize: 9, color: textSecondary }}>{new Date(poc.uploadedAt).toLocaleString()}</Text>
                  {poc.description && <Text style={{ fontSize: 9, color: textTertiary, marginTop: 2, fontStyle: 'italic' }}>"{poc.description}"</Text>}
                  <TouchableOpacity
                    style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      void api.deleteProofOfClass(poc.id).then(refreshData)
                    }}
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="delete" size={12} color="#EF4444" />
                    <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Student Roster */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="people" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Student Roster</Text>
            <Text style={[styles.rosterCount, isDark && styles.textWhite50]}>({enrolledStudents.length})</Text>
          </View>

          <Text style={[styles.rosterRefreshLabel, isDark && styles.textWhite50]}>{refreshLabel}</Text>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#FFDF00' }]}>{presentCount}</Text>
              <Text style={[styles.summaryLabel, isDark && styles.textWhite50]}>Present</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: isDark ? '#FF6B6B' : '#7B1113' }]}>{lateCount}</Text>
              <Text style={[styles.summaryLabel, isDark && styles.textWhite50]}>Late</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: isDark ? '#FF4F5A' : '#4A0A0B' }]}>{absentCount}</Text>
              <Text style={[styles.summaryLabel, isDark && styles.textWhite50]}>Absent</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: isDark ? '#888' : '#AAA' }]}>{pendingCount}</Text>
              <Text style={[styles.summaryLabel, isDark && styles.textWhite50]}>Pending</Text>
            </View>
          </View>

          {/* Student List */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {(['all', 'present', 'late', 'absent', 'pending'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive, isDark && styles.filterTabDark, filter === f && isDark && styles.filterTabActiveDark]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {enrolledStudents.length === 0 ? (
            <Text style={[styles.empty, isDark && styles.textWhite50]}>No enrolled students.</Text>
          ) : (
            enrolledStudents.map((student) => {
              const record = studentMap.get(student.id)
              const status = record?.status ?? 'pending'
              if (filter !== 'all' && status !== filter) return null
              return (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.rosterRow, isDark && styles.rosterRowDark]}
                  onPress={() => handleManualOverride(student.id, status)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rosterLeft}>
                    <Text style={[styles.rosterName, isDark && styles.textWhite]}>{student.fullName}</Text>
                    <Text style={[styles.rosterMeta, isDark && styles.textWhite50]}>{student.studentId}</Text>
                  </View>
                  <View style={styles.rosterRight}>
                    {record?.manuallySet && (
                      <MaterialIcons name="edit" size={14} color={isDark ? '#FFDF00' : '#7B1113'} style={{ marginRight: 4 }} />
                    )}
                    <RosterStatusBadge status={status} isDark={isDark} />
                    <MaterialIcons name="chevron-right" size={18} color={isDark ? 'rgba(255,255,255,0.2)' : '#CCC'} />
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* End Session Button */}
        {session.isActive && (
          <TouchableOpacity style={[styles.endSessionBtn, isDark && styles.endSessionBtnDark]} onPress={handleEndSession} accessibilityRole="button">
            <MaterialIcons name="stop" size={18} color="#FFFFFF" />
            <Text style={styles.endSessionText}>End Session</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Validity Prompt Modal */}
      <Modal visible={showValidityPrompt} transparent animationType="fade" onRequestClose={() => setShowValidityPrompt(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowValidityPrompt(false)}>
          <View style={[styles.promptSheet, isDark && styles.promptSheetDark]} onStartShouldSetResponder={() => true}>
            <MaterialIcons name="timer" size={32} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.promptTitle, isDark && styles.promptTitleDark]}>QR Validity Duration</Text>
            <Text style={[styles.promptHint, isDark && styles.textWhite50]}>
              How many minutes should the QR code be valid?{'\n'}After it expires, students who scan will be marked Late.
            </Text>
            <View style={[styles.promptInputRow, isDark && styles.promptInputRowDark]}>
              <TextInput
                style={[styles.promptInput, isDark && styles.promptInputDark]}
                value={validityMinutes}
                onChangeText={setValidityMinutes}
                keyboardType="number-pad"
                placeholder="20"
                placeholderTextColor="#AAA"
              />
              <Text style={[styles.promptUnit, isDark && styles.textWhite70]}>minutes</Text>
            </View>
            <View style={styles.promptActions}>
              <TouchableOpacity style={[styles.promptCancelBtn, isDark && styles.promptCancelBtnDark]} onPress={() => setShowValidityPrompt(false)}>
                <Text style={[styles.promptCancelText, isDark && styles.promptCancelTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.promptConfirmBtn, isDark && styles.promptConfirmBtnDark]} onPress={handleGenerateQr}>
                <Text style={[styles.promptConfirmText, isDark && styles.promptConfirmTextDark]}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen QR Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <TouchableOpacity style={[styles.overlay, { justifyContent: 'center', backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]} activeOpacity={1} onPress={() => setShowQrModal(false)}>
          <View style={{ alignItems: 'center' }}>
            {session?.qrToken && (
              <QRCode value={session.qrToken} size={260} quietZone={14} backgroundColor="#FFFFFF" color="#0A0A0A" />
            )}
            <Text style={[styles.fullscreenHint, isDark && styles.textWhite50]}>Tap anywhere to close</Text>
            <TouchableOpacity style={[styles.qrActionBtn, isDark && styles.qrActionBtnDark, { marginTop: 16 }]} onPress={handleShare}>
              <MaterialIcons name="share" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
              <Text style={[styles.qrActionText, isDark && styles.qrActionTextDark]}>Copy Token to Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

function RosterStatusBadge({ status, isDark }: { status: AttendanceStatus; isDark: boolean }) {
  const colors: Record<string, { bg: string; text: string; border?: string }> = {
    present: { bg: '#FFDF00', text: '#4A0A0B' },
    late: { bg: '#7B1113', text: '#FFFFFF' },
    absent: { bg: '#4A0A0B', text: '#FFDF00', border: '#FFDF00' },
    pending: { bg: isDark ? '#222' : '#E0E0E0', text: isDark ? 'rgba(255,255,255,0.5)' : '#666' },
    disputed: { bg: '#4A0A0B', text: '#FFDF00', border: '#FFDF00' },
  }
  const c = colors[status] || colors.pending
  return (
    <View style={[sBadge.badge, { backgroundColor: c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border }]}>
      <Text style={[sBadge.text, { color: c.text }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
    </View>
  )
}

const sBadge = StyleSheet.create({
  badge: { borderRadius: 0, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: '600', fontFamily: fonts.bodySemiBold },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1 },
  heading: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerSub: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 1 },
  iconBtn: { padding: 6 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#333' },
  qrContainer: { alignItems: 'center', paddingVertical: 8 },
  qrBox: { alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CCC' },
  qrBoxDark: { borderColor: 'rgba(245, 168, 0, 0.2)' },
  countdown: { fontSize: 13, fontFamily: fonts.body, color: '#888', marginBottom: 8 },
  qrHint: { fontSize: 13, fontFamily: fonts.body, color: '#AAA', marginBottom: 12, textAlign: 'center' },
  qrActions: { flexDirection: 'row', gap: 12 },
  qrActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD' },
  qrActionBtnDark: { borderColor: 'rgba(245, 168, 0, 0.3)' },
  qrActionText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#7B1113' },
  qrActionTextDark: { color: '#FFDF00' },
  activateBtn: { backgroundColor: '#7B1113', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  activateBtnDark: { backgroundColor: '#FFDF00' },
  activateText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  activateTextDark: { color: '#4A0A0B' },
  infoGrid: { flexDirection: 'row', gap: 24 },
  infoLabel: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 14, fontFamily: fonts.bodyBold, color: '#333' },
  statusBadge: { borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#4CAF50' },
  statusInactive: { backgroundColor: '#E0E0E0' },
  statusInactiveDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusActiveText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  statusInactiveText: { fontSize: 12, fontWeight: '600', color: '#666' },
  statusInactiveTextDark: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  coordRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  coord: { flex: 1 },
  coordLabel: { fontSize: 10, fontFamily: fonts.bodyMedium, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  coordValue: { fontSize: 12, fontFamily: fonts.mono, color: '#333', marginTop: 2 },
  rosterCount: { fontSize: 12, fontFamily: fonts.body, color: '#AAA', marginLeft: 4 },
  rosterRefreshLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold },
  summaryLabel: { fontSize: 10, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  filterRow: { marginBottom: 8, flexDirection: 'row' },
  filterTab: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#DDD', marginRight: 6 },
  filterTabActive: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  filterTabDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  filterTabActiveDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  filterTabText: { fontSize: 11, fontFamily: fonts.bodyMedium, color: '#888' },
  filterTabTextActive: { color: '#FFFFFF' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 24, color: '#AAA' },
  rosterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rosterRowDark: { borderBottomColor: '#222' },
  rosterLeft: { flex: 1 },
  rosterName: { fontSize: 14, fontFamily: fonts.body, color: '#333' },
  rosterMeta: { fontSize: 11, fontFamily: fonts.body, color: '#888', marginTop: 1 },
  rosterRight: { flexDirection: 'row', alignItems: 'center' },
  endSessionBtn: { backgroundColor: '#EF4444', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14, marginTop: 8 },
  endSessionBtnDark: { backgroundColor: '#DC2626' },
  endSessionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  promptSheet: { backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center' },
  promptSheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  promptTitle: { fontSize: 20, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', marginTop: 12, marginBottom: 8 },
  promptTitleDark: { color: '#FFFFFF' },
  promptHint: { fontSize: 13, fontFamily: fonts.body, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  promptInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  promptInputRowDark: { borderColor: 'rgba(245, 168, 0, 0.15)' },
  promptInput: { borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 16, paddingVertical: 10, fontSize: 24, fontFamily: fonts.bodyBold, color: '#333', textAlign: 'center', width: 80 },
  promptInputDark: { borderColor: 'rgba(245, 168, 0, 0.3)', backgroundColor: '#0A0A0C', color: '#FFDF00' },
  promptUnit: { fontSize: 16, fontFamily: fonts.body, color: '#888' },
  promptActions: { flexDirection: 'row', gap: 12, width: '100%' },
  promptCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#DDD' },
  promptCancelBtnDark: { borderColor: 'rgba(245, 168, 0, 0.3)' },
  promptCancelText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: '#888' },
  promptCancelTextDark: { color: 'rgba(255,255,255,0.5)' },
  promptConfirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#7B1113' },
  promptConfirmBtnDark: { backgroundColor: '#FFDF00' },
  promptConfirmText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  promptConfirmTextDark: { color: '#4A0A0B' },
  fullscreenHint: { fontSize: 12, fontFamily: fonts.body, color: '#AAA', marginTop: 20 },
})
