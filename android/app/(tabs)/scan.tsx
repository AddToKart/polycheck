import { useState, useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'
import MapView from '../../components/MapView'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SCAN_SIZE = SCREEN_WIDTH * 0.7

type ScanResult = {
  status: 'present' | 'late' | 'absent'
  message: string
} | null

export default function ScanScreen() {
  const { isDark } = useTheme()
  const [result, setResult] = useState<ScanResult>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeSession = useMemo(() => api.getSessions().find((s) => s.isActive), [])

  const handleManualCheckIn = () => {
    const user = api.getCurrentUser()
    if (!user || !('studentId' in user)) return

    const student = user as typeof user & { studentId: string }
    const sessions = api.getSessions().filter((s) => s.isActive)

    if (sessions.length === 0) {
      setResult({ status: 'absent', message: 'No active sessions available' })
    } else {
      const session = sessions[0]
      const res = api.checkAttendance(
        session.id,
        student.studentId,
        session.geofence.latitude,
        session.geofence.longitude,
      )
      setResult({
        status: res.success ? 'present' : 'absent',
        message: res.message ?? '',
      })
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setResult(null), 3000)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scanArea}>
        <View style={{ width: SCAN_SIZE, height: SCAN_SIZE, position: 'relative' }}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <MaterialIcons name="qr-code-scanner" size={24} color="rgba(255,255,255,0.6)" style={{ marginTop: 24 }} />
        <Text style={styles.scanHint}>Point camera at QR code</Text>
      </View>

      <View style={[styles.bottomPanel, isDark && styles.bottomPanelDark]}>
        {activeSession && (
          <View style={styles.sessionInfo}>
            <View style={styles.sessionRow}>
              <MaterialIcons name="location-on" size={16} color={isDark ? '#F5A800' : '#7B1113'} />
              <Text style={[styles.sessionText, isDark && styles.textGolden]}>
                {activeSession.subjectName} · {activeSession.startTime}-{activeSession.endTime}
              </Text>
            </View>
            <View style={[styles.mapBorder, isDark && styles.mapBorderDark]}>
              <MapView
                latitude={activeSession.geofence.latitude}
                longitude={activeSession.geofence.longitude}
                radius={activeSession.geofence.radiusMeters}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.checkInBtn, isDark && styles.checkInBtnDark]}
          onPress={handleManualCheckIn}
          accessibilityRole="button"
          accessibilityLabel="Check in manually"
        >
          <MaterialIcons name="near-me" size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          <Text style={[styles.checkInText, isDark && styles.checkInTextDark]}>Acknowledge Presence</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={[styles.resultOverlay, result.status === 'present' ? styles.resultSuccess : styles.resultFail]}>
          <MaterialIcons
            name={result.status === 'present' ? 'check-circle' : 'cancel'}
            size={36}
            color={result.status === 'present' ? '#F5A800' : '#EF4444'}
          />
          <Text style={[styles.resultTitle, { color: result.status === 'present' ? '#F5A800' : '#EF4444' }]}>
            {result.status === 'present' ? 'Verified' : 'Rejected'}
          </Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  scanArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#F5A800' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 16 },

  bottomPanel: { backgroundColor: '#FFFFFF', borderTopWidth: 4, borderTopColor: '#7B1113', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  bottomPanelDark: { backgroundColor: '#0A0A0A', borderTopColor: '#F5A800' },

  sessionInfo: { marginBottom: 16 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sessionText: { fontSize: 10, fontWeight: '700', color: '#7B1113', textTransform: 'uppercase', letterSpacing: 2 },
  mapBorder: { borderWidth: 2, borderColor: '#D4D4D8' },
  mapBorderDark: { borderColor: '#3F3F46' },

  checkInBtn: { backgroundColor: '#7B1113', borderWidth: 2, borderColor: '#7B1113', paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  checkInBtnDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  checkInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  checkInTextDark: { color: '#4A0A0B' },

  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 8 },
  cancelText: { color: '#71717A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  cancelTextDark: { color: '#A1A1AA' },

  resultOverlay: { position: 'absolute', bottom: 128, left: 32, right: 32, padding: 20, alignItems: 'center', gap: 8, borderWidth: 2 },
  resultSuccess: { backgroundColor: '#7B1113', borderColor: '#F5A800' },
  resultFail: { backgroundColor: '#18181B', borderColor: '#EF4444' },
  resultTitle: { fontSize: 20, fontWeight: '700', fontFamily: 'Lora_400Regular', textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 },
  resultMessage: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF', textAlign: 'center' },
})