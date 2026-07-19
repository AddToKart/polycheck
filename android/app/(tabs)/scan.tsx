import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera'
import { router, useFocusEffect } from 'expo-router'
import { decodeTokenPayload } from '@polycheck/shared/utils'
import type { ScanInputChannel, Session } from '@polycheck/shared'
import * as Crypto from 'expo-crypto'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusIconButton } from '../../components/CampusPrimitives'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const scanSize = Math.min(SCREEN_WIDTH * 0.82, 340)
const allowQrFallbacks = process.env.EXPO_PUBLIC_ALLOW_QR_FALLBACKS === 'true'

type ScanResult = {
  status: 'present' | 'late' | 'absent' | 'disputed'
  message: string
} | null

const resultPresentation = {
  present: { icon: 'check-circle' as const, title: 'ATTENDANCE VERIFIED', classes: 'border-emerald-500 bg-emerald-950/95 text-emerald-300' },
  late: { icon: 'schedule' as const, title: 'MARKED LATE', classes: 'border-amber-500 bg-amber-950/95 text-amber-300' },
  absent: { icon: 'location-off' as const, title: 'CHECK-IN REJECTED', classes: 'border-red-500 bg-red-950/95 text-red-300' },
  disputed: { icon: 'gavel' as const, title: 'FLAGGED FOR REVIEW', classes: 'border-golden bg-black/95 text-golden' },
}

export default function ScanScreen() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [result, setResult] = useState<ScanResult>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [decodingImage, setDecodingImage] = useState(false)
  const [cameraPermission, requestPermission] = useCameraPermissions()
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)

  // Scanning laser line animation
  const scanAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      )
      animation.start()
    })
    return () => animation?.stop()
  }, [scanAnim])

  useFocusEffect(
    useCallback(() => {
      let focused = true
      void api
        .getSessions()
        .then((sessions) => {
          if (!focused) return
          const active = sessions.filter((s) => s.isActive)
          setActiveSession(active.length === 1 ? active[0] : null)
        })
        .catch(() => {
          if (focused) setActiveSession(null)
        })
      return () => {
        focused = false
      }
    }, []),
  )

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const showResult = useCallback((status: NonNullable<ScanResult>['status'], message: string) => {
    setResult({ status, message })
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setResult(null)
      scannedRef.current = false
    }, 5000)
  }, [])

  const handleScanResult = useCallback(
    async (token: string, inputChannel: ScanInputChannel = 'camera') => {
      if (scannedRef.current || !token) return
      scannedRef.current = true

      try {
        const payload = decodeTokenPayload(token)
        if (!payload) {
          showResult('absent', 'This QR code is not a valid Polycheck attendance token.')
          return
        }

        const user = api.getCurrentUser()
        if (!user || !('studentId' in user)) {
          showResult('absent', 'Sign in with a student account before scanning.')
          return
        }

        const session = await api.getSession(payload.sessionId)
        if (!session) {
          showResult('absent', 'The class session could not be found.')
          return
        }
        setActiveSession(session)

        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status !== 'granted') {
          showResult('absent', 'Location access is required to verify that you are inside the class geofence.')
          return
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
        const scannedAt = await api.getTrustedTimestamp()
        const locationAgeMs = Math.max(0, Date.now() - location.timestamp)
        const locationCapturedAt = new Date(new Date(scannedAt).getTime() - locationAgeMs).toISOString()
        const submitted = await api.submitScan(
          session.id,
          user.id,
          user.fullName,
          location.coords.latitude,
          location.coords.longitude,
          'device-mobile',
          token,
          scannedAt,
          {
            clientAttemptId: Crypto.randomUUID(),
            accuracyMeters: location.coords.accuracy ?? undefined,
            locationCapturedAt,
            mocked: location.mocked,
            inputChannel,
          },
        )

        if ('error' in submitted) {
          showResult('absent', submitted.error)
          return
        }
        showResult(
          submitted.status === 'late' ? 'late' : submitted.status === 'disputed' ? 'disputed' : 'present',
          submitted.isSynced ? `Attendance recorded as ${submitted.status}.` : 'Check-in saved offline and queued for sync.',
        )
      } catch (error) {
        showResult('absent', error instanceof Error ? error.message : 'Your location could not be verified.')
      }
    },
    [showResult],
  )

  const handleUploadQr = useCallback(async () => {
    if (decodingImage || scannedRef.current) return
    setDecodingImage(true)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        showResult('absent', 'Photo access is required to select a QR image.')
        return
      }
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
      if (selection.canceled) return

      const codes = await scanFromURLAsync(selection.assets[0].uri, ['qr'])
      const qrCode = codes.find((code) => code.type === 'qr') ?? codes[0]
      if (!qrCode?.data) {
        showResult('absent', 'No QR code was found in that image.')
        return
      }
      await handleScanResult(qrCode.data, 'image')
    } catch (error) {
      showResult('absent', error instanceof Error ? error.message : 'The QR image could not be read.')
    } finally {
      setDecodingImage(false)
    }
  }, [decodingImage, handleScanResult, showResult])

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, scanSize - 4],
  })

  const presentation = result ? resultPresentation[result.status] : null

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0E' }}>
      {/* Full-bleed Camera Viewport */}
      {cameraPermission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={showManual || decodingImage || result ? undefined : ({ data }) => void handleScanResult(data, 'camera')}
        />
      ) : null}

      {/* Top Header Overlay - Explicit dark translucent inline style */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: 'rgba(10, 10, 14, 0.82)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.15)',
          zIndex: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 0, backgroundColor: '#34D399' }} />
            <View>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, color: '#FFDF00' }}>Polycheck Scanner</Text>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF' }}>
                {activeSession ? activeSession.subjectName : 'Live Attendance Check'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CampusIconButton
              icon={torchOn ? 'flash-on' : 'flash-off'}
              label="Toggle flash"
              onPress={() => setTorchOn((v) => !v)}
              inverse
            />
            <CampusIconButton
              icon="close"
              label="Close scanner"
              onPress={() => router.replace('/(tabs)/dashboard')}
              inverse
            />
          </View>
        </View>
      </View>

      {/* Main Scanner Center Overlay */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        {cameraPermission?.granted ? (
          <View style={{ alignItems: 'center' }}>
            {/* Maximized Target Frame */}
            <View
              style={{
                width: scanSize,
                height: scanSize,
                position: 'relative',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.20)',
                backgroundColor: 'rgba(0, 0, 0, 0.20)',
              }}
            >
              {/* Corner Bracket Guides */}
              <View style={{ position: 'absolute', left: 0, top: 0, width: 40, height: 40, borderLeftWidth: 4, borderTopWidth: 4, borderColor: '#FFDF00' }} />
              <View style={{ position: 'absolute', right: 0, top: 0, width: 40, height: 40, borderRightWidth: 4, borderTopWidth: 4, borderColor: '#FFDF00' }} />
              <View style={{ position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFDF00' }} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFDF00' }} />

              {/* Animated Laser Scanning Line */}
              <Animated.View
                style={{
                  transform: [{ translateY: laserTranslateY }],
                  height: 3,
                  backgroundColor: '#FFDF00',
                  shadowColor: '#FFDF00',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  elevation: 6,
                  marginHorizontal: 8,
                  width: '95%',
                }}
              />
            </View>

            <View style={{ marginTop: 24, borderRadius: 0, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', backgroundColor: 'rgba(0, 0, 0, 0.75)', paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: '#FFFFFF' }}>
                Center instructor's QR code inside the frame
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', borderRadius: 0, borderWidth: 1, borderColor: 'rgba(255, 223, 0, 0.30)', backgroundColor: 'rgba(0, 0, 0, 0.85)', padding: 32 }}>
            <View style={{ width: 64, height: 64, borderRadius: 0, borderWidth: 2, borderColor: '#FFDF00', backgroundColor: 'rgba(255, 223, 0, 0.10)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="camera-alt" size={32} color="#FFDF00" />
            </View>
            <Text style={{ marginTop: 20, fontFamily: 'DMSans_700Bold', fontSize: 20, textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF' }}>Camera Access Needed</Text>
            <Text style={{ marginTop: 8, maxWidth: 280, textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255, 255, 255, 0.70)' }}>
              Enable camera permissions to scan live class attendance codes.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enable camera access"
              onPress={requestPermission}
              style={{ marginTop: 24, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 0, backgroundColor: '#FFDF00', paddingHorizontal: 32 }}
            >
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: '#4A0A0B' }}>Enable Camera</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Feedback Banner Overlay */}
      {result && presentation ? (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 140,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            borderRadius: 0,
            borderWidth: 2,
            padding: 16,
            zIndex: 30,
          }}
          className={presentation.classes}
        >
          <MaterialIcons name={presentation.icon} size={24} color="#FFDF00" />
          <View style={{ flex: 1 }}>
            <Text accessibilityLiveRegion="assertive" style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF' }}>
              {presentation.title}
            </Text>
            <Text style={{ marginTop: 4, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 20, color: 'rgba(255, 255, 255, 0.90)' }}>{result.message}</Text>
          </View>
        </View>
      ) : null}

      {/* Floating Bottom Control Panel - Explicit dark translucent inline style */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Math.max(insets.bottom, 12) + 76,
          paddingHorizontal: 16,
          paddingTop: 16,
          backgroundColor: 'rgba(10, 10, 14, 0.88)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.15)',
          zIndex: 20,
        }}
      >
        {activeSession ? (
          <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 0, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', backgroundColor: 'rgba(255, 255, 255, 0.10)', padding: 12 }}>
            <View style={{ width: 12, height: 12, borderRadius: 0, backgroundColor: '#34D399' }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF' }}>
                {activeSession.subjectName}
              </Text>
              <Text style={{ marginTop: 2, fontFamily: 'DMSans_400Regular', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255, 255, 255, 0.70)' }}>
                {activeSession.startTime}–{activeSession.endTime} · {activeSession.geofence.radiusMeters}m Geofence
              </Text>
            </View>
            <MaterialIcons name="verified-user" size={20} color="#FFDF00" />
          </View>
        ) : (
          <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 0, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)', backgroundColor: 'rgba(255, 255, 255, 0.10)', padding: 12 }}>
            <MaterialIcons name="info-outline" size={20} color="#FFDF00" />
            <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 20, color: 'rgba(255, 255, 255, 0.85)' }}>
              Point your camera at your instructor’s QR code to verify attendance.
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a QR image"
            disabled={decodingImage}
            onPress={handleUploadQr}
            style={({ pressed }) => ({
              minHeight: 48,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 0,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.30)',
              backgroundColor: pressed ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)',
            })}
          >
            {decodingImage ? (
              <ActivityIndicator size="small" color="#FFDF00" />
            ) : (
              <MaterialIcons name="image" size={18} color="#FFDF00" />
            )}
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#FFFFFF' }}>
              {decodingImage ? 'Reading…' : 'Upload QR Image'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter a QR token manually"
            onPress={() => setShowManual(true)}
            style={({ pressed }) => ({
              minHeight: 48,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 0,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.30)',
              backgroundColor: pressed ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)',
            })}
          >
            <MaterialIcons name="keyboard" size={18} color="#FFDF00" />
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#FFFFFF' }}>Enter Code</Text>
          </Pressable>
        </View>
      </View>

      {/* Manual Entry Fallback Modal */}
      <Modal visible={showManual} transparent animationType="fade" onRequestClose={() => setShowManual(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.80)', padding: 20 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ borderRadius: 0, borderWidth: 1, borderTopWidth: 4, borderTopColor: '#FFDF00', borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#E8E2E3', backgroundColor: isDark ? '#171316' : '#FFFFFF', padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, color: isDark ? '#FFDF00' : '#7B1113' }}>Fallback Check-in</Text>
                <Text style={{ marginTop: 4, fontFamily: 'DMSans_700Bold', fontSize: 22, color: isDark ? '#FFFFFF' : '#211A1B' }}>Enter QR Token</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close manual entry"
                onPress={() => setShowManual(false)}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 0, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E8E2E3', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F4F5' }}
              >
                <MaterialIcons name="close" size={20} color={isDark ? '#FFFFFF' : '#4A0A0B'} />
              </Pressable>
            </View>
            <Text style={{ marginTop: 8, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, color: isDark ? 'rgba(255,255,255,0.65)' : '#746C6E' }}>
              Paste the token from your instructor. Live location will still be verified.
            </Text>
            <TextInput
              style={{
                marginTop: 16,
                minHeight: 100,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#E8E2E3',
                backgroundColor: isDark ? '#0B0B0E' : '#F9F8F8',
                padding: 16,
                fontFamily: 'monospace',
                fontSize: 12,
                color: isDark ? '#FFFFFF' : '#211A1B',
                textAlignVertical: 'top',
              }}
              placeholder="Paste token here"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.40)' : '#A39B9D'}
              autoFocus
              multiline
              value={manualToken}
              onChangeText={setManualToken}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!manualToken.trim()}
              style={{
                marginTop: 16,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0,
                backgroundColor: '#7B1113',
                opacity: manualToken.trim() ? 1 : 0.4,
              }}
              onPress={() => {
                const token = manualToken.trim()
                setShowManual(false)
                setManualToken('')
                void handleScanResult(token, 'manual')
              }}
            >
              <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: '#FFFFFF' }}>Verify & Check In</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
