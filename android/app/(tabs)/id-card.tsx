import { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Animated, Image, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

export default function IdCardScreen() {
  const { isDark, toggle } = useTheme()
  const user = api.getCurrentUser()
  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string; program: string; yearLevel: number })
    : null

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const [isFlipped, setIsFlipped] = useState(false)
  const flipAnim = useRef(new Animated.Value(0)).current

  const handleFlip = () => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      duration: 500,
      useNativeDriver: true,
    }).start()
    setIsFlipped(!isFlipped)
  }

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] })

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.textWhite]}>ID Card</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.cardWrapper}>
          {/* Front Face */}
          <Animated.View
            style={[styles.cardFace, styles.cardFront, isDark && styles.cardDark, { transform: [{ rotateY: frontInterpolate }], backfaceVisibility: 'hidden' }]}
          >
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Image source={require('../../assets/icon.png')} style={styles.cardLogo} />
              <View>
                <Text style={styles.cardHeaderSub}>Republic of the Philippines</Text>
                <Text style={styles.cardHeaderTitle}>Polytechnic University of the Philippines</Text>
              </View>
            </View>

            {/* Card Body */}
            <View style={[styles.cardBody, isDark && styles.cardBodyDark]}>
              {/* Left: Photo */}
              <View style={[styles.photoCol, isDark && styles.photoColDark]}>
                <View style={[styles.photoBox, isDark && styles.photoBoxDark]}>
                  <MaterialIcons name="person" size={48} color={isDark ? '#555' : '#CCC'} />
                </View>
                <View style={styles.signatureArea}>
                  <View style={styles.signatureLine}>
                    <Text style={styles.signatureLabel}>SIGNATURE</Text>
                  </View>
                </View>
              </View>

              {/* Right: Details */}
              <View style={styles.detailsCol}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Student Number</Text>
                  <Text style={[styles.detailValueLarge, isDark && styles.textGolden]}>{student?.studentId ?? 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Name</Text>
                  <Text style={[styles.detailValueName, isDark && styles.textWhite]}>{student?.fullName ?? 'N/A'}</Text>
                </View>
                <View style={styles.detailRowSplit}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Program</Text>
                    <Text style={[styles.detailValueSm, isDark && styles.textWhite]}>{student?.program ?? 'N/A'}</Text>
                  </View>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Validity</Text>
                    <Text style={[styles.detailValueSm, isDark && styles.textWhite]}>2026-2027</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Back Face */}
          <Animated.View
            style={[styles.cardFace, styles.cardBack, isDark && styles.cardDark, { transform: [{ rotateY: backInterpolate }], backfaceVisibility: 'hidden', position: 'absolute', top: 0 }]}
          >
            <View style={styles.magneticStripe} />
            <View style={styles.backBody}>
              <View style={styles.backLeft}>
                <View>
                  <Text style={styles.conditionsTitle}>Conditions of Use</Text>
                  <Text style={styles.conditionsText}>
                    This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.
                  </Text>
                </View>
                <View style={styles.emergencyArea}>
                  <Text style={styles.emergencyLabel}>In case of emergency, contact:</Text>
                  <View style={styles.emergencyLine} />
                  <View style={[styles.emergencyLine, { marginTop: 4 }]} />
                </View>
              </View>
              <View style={styles.backRight}>
                <View style={styles.qrBox}>
                  <MaterialIcons name="qr-code" size={48} color="#000" />
                </View>
                <Text style={styles.qrLabel}>SCAN TO VERIFY</Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Text style={[styles.flipHint, isDark && styles.textWhite50]}>Tap card to flip</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  headerDark: { backgroundColor: '#0A0A0A', borderBottomColor: '#27272A' },
  headerTitle: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8 },

  cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 80 },
  cardWrapper: { width: '100%', maxWidth: 384, aspectRatio: 1.586 },
  cardFace: { width: '100%', height: '100%', borderWidth: 2, borderColor: '#D4D4D8', flexDirection: 'column', overflow: 'hidden' },
  cardFront: { backgroundColor: '#FFFFFF' },
  cardBack: { backgroundColor: '#FFFFFF' },
  cardDark: { borderColor: '#3F3F46' },

  cardHeader: { backgroundColor: '#7B1113', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLogo: { width: 32, height: 32 },
  cardHeaderSub: { fontSize: 8, fontWeight: '700', color: '#F5A800', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 10, marginBottom: 2 },
  cardHeaderTitle: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 12 },

  cardBody: { flex: 1, flexDirection: 'row', backgroundColor: '#FDFBF7' },
  cardBodyDark: { backgroundColor: '#1A1A1A' },

  photoCol: { width: '33%', borderRightWidth: 2, borderRightColor: '#D4D4D8', padding: 12, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  photoColDark: { borderRightColor: '#3F3F46' },
  photoBox: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D4D4D8', marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  photoBoxDark: { backgroundColor: '#27272A', borderColor: '#3F3F46' },

  signatureArea: { width: '100%', marginTop: 'auto' },
  signatureLine: { borderBottomWidth: 2, borderBottomColor: '#27272A', height: 20, justifyContent: 'flex-end', alignItems: 'center' },
  signatureLabel: { fontSize: 7, fontFamily: 'DMSans_400Regular', color: 'rgba(0,0,0,0.5)' },

  detailsCol: { flex: 1, padding: 16, justifyContent: 'center' },
  detailRow: { marginBottom: 16 },
  detailLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: '#71717A', fontWeight: '700', marginBottom: 2 },
  detailValueLarge: { fontSize: 20, fontFamily: 'DMSans_400Regular', fontWeight: '700', color: '#7B1113' },
  detailValueName: { fontSize: 16, fontFamily: 'Lora_400Regular', fontWeight: '700', color: '#18181B', textTransform: 'uppercase', lineHeight: 20 },
  detailRowSplit: { flexDirection: 'row', gap: 16 },
  detailHalf: { flex: 1 },
  detailValueSm: { fontSize: 11, fontWeight: '700', color: '#18181B' },

  magneticStripe: { backgroundColor: '#18181B', height: 48, width: '100%', marginTop: 16 },
  backBody: { flex: 1, flexDirection: 'row', padding: 16 },
  backLeft: { flex: 2, paddingRight: 16, justifyContent: 'space-between' },
  conditionsTitle: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: '#7B1113', marginBottom: 4 },
  conditionsText: { fontSize: 8, lineHeight: 11, color: '#52525B', textAlign: 'justify' },
  emergencyArea: { marginTop: 'auto' },
  emergencyLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, color: '#71717A', fontWeight: '700', marginBottom: 4 },
  emergencyLine: { borderBottomWidth: 1, borderBottomColor: '#A1A1AA', height: 20 },
  backRight: { flex: 1, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderLeftColor: '#D4D4D8', borderStyle: 'dashed', paddingLeft: 16 },
  qrBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F4F4F5', borderWidth: 2, borderColor: '#D4D4D8', alignItems: 'center', justifyContent: 'center', padding: 4 },
  qrLabel: { fontSize: 6, fontFamily: 'DMSans_400Regular', marginTop: 8, color: '#71717A', textAlign: 'center', letterSpacing: 2 },

  flipHint: { textAlign: 'center', fontSize: 11, color: '#71717A', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 32 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },
})