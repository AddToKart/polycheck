import { useState, useRef, useMemo, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, Dimensions, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'
import MapView from '../../components/MapView'
import { decodeTokenPayload } from '@polycheck/shared/utils'
import * as Location from 'expo-location'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SCAN_SIZE = SCREEN_WIDTH * 0.7

type ScanResult = {
  status: 'present' | 'late' | 'absent'
  message: string
} | null

export default function ScanScreen() {
  const { isDark } = useTheme()
  const [result, setResult] = useState<ScanResult>(null)
  const [showManual, setShowManual] = useState(false)
  const [cameraPermission, requestPermission] = useCameraPermissions()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)

  const activeSession = useMemo(() => api.getSessions().find((s) => s.isActive), [])

  const showResult = useCallback((status: 'present' | 'late' | 'absent', message: string) => {
    setResult({ status, message })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { setResult(null); scannedRef.current = false }, 3000)
  }, [])

  const handleScanResult = useCallback(async (token: string) => {
    if (scannedRef.current || !token) return
    scannedRef.current = true

    const payload = decodeTokenPayload(token)
    if (!payload) {
      showResult('absent', 'Invalid QR code')
      return
    }

    const user = api.getCurrentUser()
    if (!user || !('studentId' in user)) {
      showResult('absent', 'Not logged in as student')
      return
    }

    const session = api.getSession(payload.sessionId)
    if (!session) {
      showResult('absent', 'Session not found')
      return
    }

    let lat = session.geofence.latitude
    let lon = session.geofence.longitude
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      lat = loc.coords.latitude
      lon = loc.coords.longitude
    } catch {
      // fallback to session center
    }

    const result = api.checkAttendance(session.id, user.studentId ?? user.id, lat, lon)
    if (result.success) {
      api.submitScan(session.id, user.studentId ?? user.id, user.fullName, lat, lon, 'device-mobile')
      showResult(result.status === 'late' ? 'late' : 'present', result.message ?? 'Check-in successful!')
    } else {
      showResult('absent', result.message ?? 'Check-in rejected')
    }
  }, [showResult])

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    handleScanResult(data)
  }, [handleScanResult])

  const handleManualCode = useCallback(() => {
    setShowManual(false)
    const user = api.getCurrentUser()
    if (!user || !('studentId' in user)) return

    const sessions = api.getSessions().filter((s) => s.isActive)
    if (sessions.length === 0) {
      showResult('absent', 'No active sessions available')
      return
    }

    const session = sessions[0]
    let lat = session.geofence.latitude
    let lon = session.geofence.longitude
    const res = api.checkAttendance(session.id, (user as any).studentId, lat, lon)
    if (res.success) {
      api.submitScan(session.id, (user as any).studentId, user.fullName, lat, lon, 'device-mobile')
      showResult(res.status === 'late' ? 'late' : 'present', res.message ?? 'Check-in successful!')
    } else {
      showResult('absent', res.message ?? 'Check-in rejected')
    }
  }, [showResult])

  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <MaterialIcons name="camera-alt" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 16, fontSize: 14 }}>
            Camera permission is required to scan QR codes.
          </Text>
          <TouchableOpacity style={[styles.checkInBtn, { marginTop: 24 }]} onPress={requestPermission}>
            <Text style={styles.checkInText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setShowManual(true)}>
            <Text style={{ color: '#FFDF00', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
              Enter Code Manually
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      >
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
      </CameraView>

      <View style={[styles.bottomPanel, isDark && styles.bottomPanelDark]}>
        {activeSession && (
          <View style={styles.sessionInfo}>
            <View style={styles.sessionRow}>
              <MaterialIcons name="location-on" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
              <Text style={[styles.sessionText, isDark && styles.textGolden]}>
                {activeSession.subjectName} · {activeSession.startTime}-{activeSession.endTime}
              </Text>
            </View>
            <View style={[styles.mapBorder, isDark && styles.mapBorderDark]}>
              <MapView latitude={activeSession.geofence.latitude} longitude={activeSession.geofence.longitude} radius={activeSession.geofence.radiusMeters} />
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.checkInBtn, isDark && styles.checkInBtnDark]} onPress={() => setShowManual(true)}>
          <MaterialIcons name="keyboard" size={20} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          <Text style={[styles.checkInText, isDark && styles.checkInTextDark]}>Enter Code Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {showManual && (
        <View style={[styles.manualOverlay, isDark && styles.manualOverlayDark]}>
          <Text style={[styles.manualTitle, isDark && styles.textGolden]}>Enter QR Token</Text>
          <View style={[styles.manualInputRow, isDark && styles.manualInputRowDark]}>
            <TextInput
              style={[styles.manualInput, isDark && styles.manualInputDark]}
              placeholder="Paste or type token..."
              placeholderTextColor="#AAA"
              autoFocus
              onSubmitEditing={(e) => { handleScanResult(e.nativeEvent.text); setShowManual(false) }}
              returnKeyType="go"
            />
          </View>
          <TouchableOpacity style={[styles.manualCloseBtn, isDark && styles.manualCloseBtnDark]} onPress={() => setShowManual(false)}>
            <Text style={[styles.manualCloseText, isDark && styles.manualCloseTextDark]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={[styles.resultOverlay, result.status === 'present' ? (isDark ? styles.resultSuccessDark : styles.resultSuccess) : styles.resultFail]}>
          <MaterialIcons name={result.status === 'present' ? 'check-circle' : 'cancel'} size={36} color={result.status === 'present' ? '#FFDF00' : '#EF4444'} />
          <Text style={[styles.resultTitle, { color: result.status === 'present' ? '#FFDF00' : '#EF4444' }]}>
            {result.status === 'present' ? 'Verified' : result.status === 'late' ? 'Late' : 'Rejected'}
          </Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scanArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#FFDF00' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 16 },
  bottomPanel: { backgroundColor: '#FFFFFF', borderTopWidth: 4, borderTopColor: '#7B1113', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  bottomPanelDark: { backgroundColor: '#0A0A0C', borderTopColor: '#FFDF00' },
  sessionInfo: { marginBottom: 16 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sessionText: { fontSize: 10, fontWeight: '700', color: '#7B1113', textTransform: 'uppercase', letterSpacing: 2 },
  mapBorder: { borderWidth: 2, borderColor: '#D4D4D8' },
  mapBorderDark: { borderColor: 'rgba(245, 168, 0, 0.2)' },
  checkInBtn: { backgroundColor: '#7B1113', borderWidth: 2, borderColor: '#7B1113', paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  checkInBtnDark: { backgroundColor: '#FFDF00', borderColor: '#FFDF00' },
  checkInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  checkInTextDark: { color: '#4A0A0B' },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 8 },
  cancelText: { color: '#71717A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  cancelTextDark: { color: '#A1A1AA' },
  manualOverlay: { position: 'absolute', bottom: 128, left: 20, right: 20, backgroundColor: '#FFFFFF', padding: 20, borderWidth: 2, borderColor: '#7B1113' },
  manualOverlayDark: { backgroundColor: '#121215', borderColor: '#FFDF00' },
  manualTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#4A0A0B', marginBottom: 12, textAlign: 'center' },
  manualInputRow: { borderWidth: 1, borderColor: '#DDD', marginBottom: 12 },
  manualInputRowDark: { borderColor: 'rgba(245, 168, 0, 0.3)' },
  manualInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333' },
  manualInputDark: { color: '#FFF', backgroundColor: '#0A0A0C' },
  manualCloseBtn: { alignItems: 'center', paddingVertical: 8 },
  manualCloseBtnDark: {},
  manualCloseText: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  manualCloseTextDark: { color: 'rgba(255,255,255,0.5)' },
  resultOverlay: { position: 'absolute', bottom: 128, left: 32, right: 32, padding: 20, alignItems: 'center', gap: 8, borderWidth: 2 },
  resultSuccess: { backgroundColor: '#7B1113', borderColor: '#FFDF00' },
  resultSuccessDark: { backgroundColor: '#1E0405', borderColor: '#FFDF00' },
  resultFail: { backgroundColor: '#18181B', borderColor: '#EF4444' },
  resultTitle: { fontSize: 20, fontWeight: '700', fontFamily: 'Lora_400Regular', textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 },
  resultMessage: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF', textAlign: 'center' },
  textGolden: { color: '#FFDF00' },
})
