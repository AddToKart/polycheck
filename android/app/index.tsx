import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'

export default function LandingScreen() {
  const { isDark, toggle } = useTheme()

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <TouchableOpacity
        style={[styles.themeBtn, isDark && styles.themeBtnDark]}
        onPress={toggle}
        accessibilityLabel="Toggle theme"
      >
        <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={20} color={isDark ? '#F5A800' : '#7B1113'} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={[styles.subtitle, isDark && styles.textWhite50]}>PUP Attendance Management System</Text>
        <Text style={[styles.title, isDark && styles.titleDark]}>Polycheck.</Text>

        <View style={styles.cards}>
          <TouchableOpacity
            style={[styles.card, isDark && styles.cardDark]}
            onPress={() => router.push('/(auth)/student-login')}
            accessibilityRole="button"
            accessibilityLabel="Student sign in"
          >
            <View style={[styles.iconBox, isDark ? styles.iconBoxGolden : styles.iconBoxMaroon]}>
              <MaterialIcons name="school" size={24} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Student Portal</Text>
              <Text style={[styles.cardSub, isDark && styles.textWhite50]}>Access ID & Scan QR</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, isDark && styles.cardDark]}
            onPress={() => router.push('/(auth)/faculty-login')}
            accessibilityRole="button"
            accessibilityLabel="Faculty sign in"
          >
            <View style={[styles.iconBox, isDark ? styles.iconBoxDark : styles.iconBoxLight, isDark ? styles.iconBorderGolden : styles.iconBorderMaroon]}>
              <MaterialIcons name="menu-book" size={24} color={isDark ? '#F5A800' : '#7B1113'} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, isDark && styles.textWhite]}>Faculty Portal</Text>
              <Text style={[styles.cardSub, isDark && styles.textWhite50]}>Manage Sessions</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, isDark && styles.footerDark]}>
        <Text style={[styles.footerText, isDark && styles.textWhite50]}>
          Est. 1904 \ Polytechnic University of the Philippines
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#0A0A0A' },
  themeBtn: {
    position: 'absolute', top: 16, right: 20, zIndex: 10,
    padding: 8, borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
  },
  themeBtnDark: { borderColor: '#3F3F46', backgroundColor: '#18181B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 64, height: 64, marginBottom: 16 },
  subtitle: { fontSize: 10, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 48, fontWeight: '800', fontFamily: 'Lora_400Regular', color: '#7B1113', marginBottom: 48, letterSpacing: -1, textAlign: 'center' },
  titleDark: { color: '#FFFFFF' },
  cards: { width: '100%', maxWidth: 384, gap: 16 },
  card: {
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FAFAFA',
    padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  cardDark: { borderColor: '#3F3F46', backgroundColor: '#111113' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  iconBoxMaroon: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  iconBoxGolden: { backgroundColor: '#F5A800', borderColor: '#F5A800' },
  iconBoxLight: { backgroundColor: '#FFFFFF' },
  iconBoxDark: { backgroundColor: '#18181B' },
  iconBorderMaroon: { borderColor: '#7B1113' },
  iconBorderGolden: { borderColor: '#F5A800' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', textTransform: 'uppercase', letterSpacing: 2 },
  cardSub: { fontSize: 10, fontWeight: '700', fontFamily: 'DMSans_400Regular', color: '#71717A', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5 },
  footer: { padding: 24, borderTopWidth: 2, borderTopColor: '#D4D4D8', backgroundColor: '#FAFAFA', alignItems: 'center' },
  footerDark: { borderTopColor: '#3F3F46', backgroundColor: '#111113' },
  footerText: { fontSize: 10, fontWeight: '700', fontFamily: 'DMSans_400Regular', color: '#71717A', textTransform: 'uppercase', letterSpacing: 2 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
})