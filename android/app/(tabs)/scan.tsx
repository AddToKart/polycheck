import { useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, Dimensions, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { decodeTokenPayload, haversineDistance } from '@polycheck/shared/utils'
import type { Session } from '@polycheck/shared'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SCAN_SIZE = SCREEN_WIDTH * 0.7

type ScanResult = {
  status: 'present' | 'late' | 'absent'
  message: string
} | null

export default function ScanScreen() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [result, setResult] = useState<ScanResult>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [decodingImage, setDecodingImage] = useState(false)
  const [cameraPermission, requestPermission] = useCameraPermissions()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)

  const [activeSession, setActiveSession] = useState<Session | null>(null)

  // Refresh active session whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      api.getSessions().then((sessions) => {
        const activeSessions = sessions.filter((session) => session.isActive)
        setActiveSession(activeSessions.length === 1 ? activeSessions[0] : null)
      }).catch(() => setActiveSession(null))
    }, [])
  )

  const showResult = useCallback((status: 'present' | 'late' | 'absent', message: string) => {
    setResult({ status, message })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { setResult(null); scannedRef.current = false }, 5000)
  }, [])

  const handleScanResult = useCallback(async (token: string) => {
    if (scannedRef.current || !token) return
    scannedRef.current = true

    try {
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

      const session = await api.getSession(payload.sessionId)
      if (!session) {
        showResult('absent', 'Session not found')
        return
      }
      setActiveSession(session)

      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        showResult('absent', 'Location permission is required to check in')
        return
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
      const accuracy = loc.coords.accuracy ?? Number.POSITIVE_INFINITY
      const distance = haversineDistance(
        loc.coords.latitude,
        loc.coords.longitude,
        session.geofence.latitude,
        session.geofence.longitude,
      )
      if (accuracy > Math.max(session.geofence.radiusMeters, 50)) {
        showResult('absent', `GPS accuracy is only ±${Math.round(accuracy)}m. Wait for a more accurate fix and try again.`)
        return
      }
      if (distance > session.geofence.radiusMeters) {
        showResult(
          'absent',
          `Device GPS is ${Math.round(distance)}m from class; allowed radius is ${session.geofence.radiusMeters}m. If testing in an emulator, set its Location to ${session.geofence.latitude.toFixed(6)}, ${session.geofence.longitude.toFixed(6)}.`,
        )
        return
      }
      const scannedAt = await api.getTrustedTimestamp()
      const result = await api.checkAttendance(session.id, user.id, loc.coords.latitude, loc.coords.longitude, token, scannedAt)
      if (!result.success) {
        showResult('absent', result.message ?? 'Check-in rejected')
        return
      }

      const submitted = await api.submitScan(session.id, user.id, user.fullName, loc.coords.latitude, loc.coords.longitude, 'device-mobile', token, scannedAt)
      if ('error' in submitted) showResult('absent', submitted.error)
      else showResult(result.status === 'late' ? 'late' : 'present', submitted.isSynced ? (result.message ?? 'Check-in successful!') : 'Check-in saved offline and queued for sync.')
    } catch (error) {
      showResult('absent', error instanceof Error ? error.message : 'Unable to verify your location')
    }
  }, [showResult])

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    handleScanResult(data)
  }, [handleScanResult])

  const handleUploadQr = useCallback(async () => {
    if (decodingImage || scannedRef.current) return
    setDecodingImage(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        showResult('absent', 'Photo access is required to select a QR image')
        return
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      })
      if (selection.canceled) return

      const codes = await scanFromURLAsync(selection.assets[0].uri, ['qr'])
      const qrCode = codes.find((code) => code.type === 'qr') ?? codes[0]
      if (!qrCode?.data) {
        showResult('absent', 'No QR code was found in that image')
        return
      }
      await handleScanResult(qrCode.data)
    } catch (error) {
      showResult('absent', error instanceof Error ? error.message : 'Unable to read the QR image')
    } finally {
      setDecodingImage(false)
    }
  }, [decodingImage, handleScanResult, showResult])

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.scannerViewport}>
        {cameraPermission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={showManual || decodingImage || result ? undefined : handleBarCodeScanned}
          >
            <View style={styles.scanArea}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.scanHint}>Align the QR code inside the frame</Text>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionPanel}>
            <View style={styles.permissionIcon}>
              <MaterialIcons name="camera-alt" size={32} color="#FFDF00" />
            </View>
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionText}>Enable the camera for live scanning, or use a saved QR image below.</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Enable camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {result && (
          <View style={[styles.resultCard, result.status === 'present' ? styles.resultSuccess : result.status === 'late' ? styles.resultLate : styles.resultFail]}>
            <MaterialIcons
              name={result.status === 'present' ? 'check-circle' : result.status === 'late' ? 'schedule' : 'location-off'}
              size={28}
              color={result.status === 'absent' ? '#FCA5A5' : '#FFDF00'}
            />
            <View style={styles.resultCopy}>
              <Text style={styles.resultTitle}>{result.status === 'present' ? 'Attendance verified' : result.status === 'late' ? 'Marked late' : 'Check-in rejected'}</Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.bottomPanel, isDark && styles.bottomPanelDark, { paddingBottom: insets.bottom + 88 }]}>
        {activeSession && (
          <View style={[styles.sessionCard, isDark && styles.sessionCardDark]}>
            <View style={styles.liveDot} />
            <View style={styles.sessionCopy}>
              <Text numberOfLines={1} style={[styles.sessionName, isDark && styles.textWhite]}>{activeSession.subjectName}</Text>
              <Text style={[styles.sessionMeta, isDark && styles.textMuted]}>{activeSession.startTime}–{activeSession.endTime} · {activeSession.geofence.radiusMeters}m geofence</Text>
            </View>
            <MaterialIcons name="verified-user" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={handleUploadQr} disabled={decodingImage}>
            {decodingImage ? <ActivityIndicator size="small" color={isDark ? '#FFDF00' : '#7B1113'} /> : <MaterialIcons name="image" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />}
            <Text style={[styles.actionText, isDark && styles.textGolden]}>{decodingImage ? 'Reading...' : 'QR image'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={() => setShowManual(true)}>
            <MaterialIcons name="keyboard" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.actionText, isDark && styles.textGolden]}>Enter code</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)/dashboard')}>
          <MaterialIcons name="arrow-back" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showManual} transparent animationType="fade" onRequestClose={() => setShowManual(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.manualCard, isDark && styles.manualCardDark]}>
            <View style={styles.manualHeader}>
              <View>
                <Text style={[styles.manualEyebrow, isDark && styles.textGolden]}>Fallback check-in</Text>
                <Text style={[styles.manualTitle, isDark && styles.textWhite]}>Enter QR token</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManual(false)} accessibilityLabel="Close manual entry">
                <MaterialIcons name="close" size={24} color={isDark ? '#FFF' : '#4A0A0B'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.manualHelp, isDark && styles.textMuted]}>Paste the token shared by your instructor. Your live location is still verified.</Text>
            <TextInput
              style={[styles.manualInput, isDark && styles.manualInputDark]}
              placeholder="Paste token here"
              placeholderTextColor="#999"
              autoFocus
              multiline
              value={manualToken}
              onChangeText={setManualToken}
            />
            <TouchableOpacity
              style={[styles.manualSubmit, !manualToken.trim() && styles.disabledButton]}
              disabled={!manualToken.trim()}
              onPress={() => {
                const token = manualToken.trim()
                setShowManual(false)
                setManualToken('')
                void handleScanResult(token)
              }}
            >
              <Text style={styles.manualSubmitText}>Verify and check in</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scannerViewport: { flex: 1, minHeight: 280, overflow: 'hidden', backgroundColor: '#050509' },
  scanArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: Math.min(SCAN_SIZE, 260), height: Math.min(SCAN_SIZE, 260), position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#FFDF00' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginTop: 18, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7 },
  permissionPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,223,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Lora_700Bold', marginTop: 16 },
  permissionText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 19, maxWidth: 300 },
  permissionButton: { marginTop: 20, backgroundColor: '#FFDF00', paddingHorizontal: 20, paddingVertical: 12 },
  permissionButtonText: { color: '#4A0A0B', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  bottomPanel: { backgroundColor: '#FFFFFF', borderTopWidth: 3, borderTopColor: '#7B1113', paddingHorizontal: 18, paddingTop: 14 },
  bottomPanelDark: { backgroundColor: '#0A0A0C', borderTopColor: '#FFDF00' },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F1F1', borderLeftWidth: 3, borderLeftColor: '#7B1113', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  sessionCardDark: { backgroundColor: '#170B0C', borderLeftColor: '#FFDF00' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  sessionCopy: { flex: 1 },
  sessionName: { color: '#4A0A0B', fontSize: 13, fontWeight: '800' },
  sessionMeta: { color: '#71717A', fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 52, borderWidth: 1.5, borderColor: '#7B1113', alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionButtonDark: { borderColor: '#FFDF00', backgroundColor: '#110B0B' },
  actionText: { color: '#7B1113', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10 },
  cancelText: { color: '#71717A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  cancelTextDark: { color: '#A1A1AA' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.72)' },
  manualCard: { backgroundColor: '#FFF', padding: 20, borderTopWidth: 4, borderTopColor: '#7B1113' },
  manualCardDark: { backgroundColor: '#121215', borderTopColor: '#FFDF00' },
  manualHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  manualEyebrow: { color: '#7B1113', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  manualTitle: { color: '#4A0A0B', fontSize: 22, fontFamily: 'Lora_700Bold', marginTop: 2 },
  manualHelp: { color: '#71717A', fontSize: 12, lineHeight: 18, marginTop: 12 },
  manualInput: { minHeight: 110, borderWidth: 1, borderColor: '#D4D4D8', padding: 12, marginTop: 14, fontSize: 13, color: '#333', textAlignVertical: 'top' },
  manualInputDark: { color: '#FFF', backgroundColor: '#0A0A0C', borderColor: '#3F3F46' },
  manualSubmit: { backgroundColor: '#7B1113', alignItems: 'center', paddingVertical: 14, marginTop: 12 },
  manualSubmitText: { color: '#FFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  disabledButton: { opacity: 0.4 },
  resultCard: { position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderWidth: 1 },
  resultSuccess: { backgroundColor: 'rgba(74,10,11,0.96)', borderColor: '#FFDF00' },
  resultLate: { backgroundColor: 'rgba(74,10,11,0.96)', borderColor: '#F59E0B' },
  resultFail: { backgroundColor: 'rgba(24,24,27,0.97)', borderColor: '#EF4444' },
  resultCopy: { flex: 1 },
  resultTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  resultMessage: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.78)', marginTop: 3 },
  textWhite: { color: '#FFF' },
  textMuted: { color: 'rgba(255,255,255,0.55)' },
  textGolden: { color: '#FFDF00' },
})
