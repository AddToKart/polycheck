import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import MapView from '../../../components/MapView'
import type { User, Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'

const statusFilters: (AttendanceStatus | 'all')[] = ['all', 'present', 'late', 'absent']

export default function SessionDetailScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [countdown, setCountdown] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu) { router.replace('/'); return }
    setUser(cu)
    const s = id ? api.getSession(id) : undefined
    if (!s) { router.back(); return }
    setSession(s)
    setRecords(api.getAttendanceRecords(id))
  }, [id])

  useEffect(() => {
    if (!session || !session.isActive || !session.qrTokenExpiresAt) return
    const tick = () => {
      const diff = new Date(session.qrTokenExpiresAt!).getTime() - Date.now()
      if (diff <= 0) { setCountdown('Expired'); return }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session])

  if (!user || !session) return null

  const filteredRecords = filter === 'all' ? records : records.filter((r) => r.status === filter)

  const presentCount = records.filter((r) => r.status === 'present').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const absentCount = records.filter((r) => r.status === 'absent').length

  const handleActivate = () => {
    api.activateSession(session.id)
    setSession({ ...session, isActive: true })
  }

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.heading, isDark && styles.textGolden]} numberOfLines={1}>{session.subjectName}</Text>
          <Text style={[styles.headerSub, isDark && styles.textWhite50]}>
            {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}{session.startTime}-{session.endTime}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
          <MaterialIcons name="logout" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* QR Code Card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="qr-code" size={18} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>QR Code</Text>
          </View>
          <View style={styles.qrContainer}>
            <View style={[styles.qrBox, isDark && styles.qrBoxDark]}>
              <MaterialIcons name="qr-code" size={64} color={isDark ? 'rgba(245, 168, 0, 0.4)' : '#999'} />
              <Text style={[styles.qrToken, isDark && styles.textWhite50]}>TOKEN:{session.id}</Text>
            </View>
            {session.isActive && countdown ? (
              <Text style={[styles.countdown, isDark && styles.textWhite70]}>
                Expires in: <Text style={[styles.countdownValue, isDark && styles.textGolden, countdown === 'Expired' && { color: '#EF4444' }]}>{countdown}</Text>
              </Text>
            ) : (
              <Text style={[styles.qrHint, isDark && styles.textWhite50]}>Activate session to generate QR</Text>
            )}
            {!session.isActive && (
              <TouchableOpacity style={[styles.activateBtn, isDark && styles.activateBtnDark]} onPress={handleActivate} accessibilityRole="button">
                <MaterialIcons name="play-arrow" size={18} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
                <Text style={[styles.activateText, isDark && styles.activateTextDark]}>Activate Session</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Session Info */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="info" size={18} color={isDark ? '#F5A800' : '#7B1113'} />
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
            <View>
              <Text style={[styles.infoLabel, isDark && styles.textWhite50]}>Grace</Text>
              <Text style={[styles.infoValue, isDark && styles.textWhite]}>{session.gracePeriodMinutes} min</Text>
            </View>
            <View>
              <Text style={[styles.infoLabel, isDark && styles.textWhite50]}>Token Window</Text>
              <Text style={[styles.infoValue, isDark && styles.textWhite]}>{session.tokenWindowSeconds}s</Text>
            </View>
          </View>
        </View>

        {/* Geofence Card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={18} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Geofence</Text>
          </View>
          <MapView
            latitude={session.geofence.latitude}
            longitude={session.geofence.longitude}
            radius={session.geofence.radiusMeters}
          />
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

        {/* Attendance Records */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="assignment" size={18} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Attendance</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#F5A800' }]}>{presentCount}</Text>
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
          </View>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {statusFilters.map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterTab,
                  filter === f && styles.filterTabActive,
                  isDark && styles.filterTabDark,
                  filter === f && isDark && styles.filterTabActiveDark
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                  isDark && filter === f && styles.filterTabTextActiveDark
                ]}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredRecords.length === 0 ? (
            <Text style={[styles.empty, isDark && styles.textWhite50]}>No records match this filter.</Text>
          ) : (
            filteredRecords.map((r) => (
              <View key={r.id} style={[styles.recordRow, isDark && styles.recordRowDark]}>
                <View style={styles.recordLeft}>
                  <Text style={[styles.recordName, isDark && styles.textWhite]}>{r.studentName}</Text>
                  <Text style={[styles.recordTime, isDark && styles.textWhite50]}>
                    {new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const colors: Record<string, { bg: string; text: string; border?: string }> = {
    present: { bg: '#F5A800', text: '#4A0A0B' },
    late: { bg: '#7B1113', text: '#FFFFFF' },
    absent: { bg: '#4A0A0B', text: '#F5A800', border: '#F5A800' },
  }
  const c = colors[status] || { bg: '#E0E0E0', text: '#666' }
  return (
    <View style={[sBadge.badge, { backgroundColor: c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border }]}>
      <Text style={[sBadge.text, { color: c.text }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
    </View>
  )
}

const sBadge = StyleSheet.create({
  badge: { borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold },
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
  textGolden: { color: '#F5A800' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#333' },
  qrContainer: { alignItems: 'center', paddingVertical: 8 },
  qrBox: { width: 160, height: 160, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#CCC', marginBottom: 12 },
  qrBoxDark: { backgroundColor: '#0A0A0C', borderColor: 'rgba(245, 168, 0, 0.2)' },
  qrToken: { fontSize: 10, fontFamily: fonts.mono, color: '#999', marginTop: 6, paddingHorizontal: 8, textAlign: 'center' },
  countdown: { fontSize: 13, fontFamily: fonts.body, color: '#888', marginBottom: 8 },
  countdownValue: { fontFamily: fonts.bodyBold, color: '#7B1113' },
  qrHint: { fontSize: 13, fontFamily: fonts.body, color: '#AAA', marginBottom: 12 },
  activateBtn: { backgroundColor: '#7B1113', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  activateBtnDark: { backgroundColor: '#F5A800' },
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700', fontFamily: fonts.bodyBold },
  summaryLabel: { fontSize: 11, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  filterRow: { marginBottom: 12, flexDirection: 'row' },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#DDD', marginRight: 8 },
  filterTabActive: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  filterTabDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  filterTabActiveDark: { backgroundColor: '#F5A800', borderColor: '#F5A800' },
  filterTabText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#888' },
  filterTabTextActive: { color: '#FFFFFF' },
  filterTabTextActiveDark: { color: '#4A0A0B' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 24, color: '#AAA' },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  recordRowDark: { borderBottomColor: '#222' },
  recordLeft: { flex: 1 },
  recordName: { fontSize: 14, fontFamily: fonts.body, color: '#333' },
  recordTime: { fontSize: 11, fontFamily: fonts.body, color: '#888', marginTop: 1 },
})
