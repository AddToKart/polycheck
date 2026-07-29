import { Image, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../theme/ThemeContext'
import { CampusIconButton } from '../components/CampusPrimitives'

export default function LandingScreen() {
  const { isDark, toggle } = useTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#171316' : '#7B1113' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <CampusIconButton
            icon={isDark ? 'light-mode' : 'dark-mode'}
            label="Toggle color theme"
            onPress={toggle}
            inverse
          />
        </View>

        {/* Main Branding */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* Standalone Large PUP Seal Logo - No container box */}
          <Image
            source={require('../assets/pup-logo.png')}
            style={{ width: 110, height: 110, marginBottom: 16 }}
            resizeMode="contain"
            accessibilityLabel="PUP Seal Logo"
          />

          {/* Wordmark */}
          <Text
            style={{
              fontFamily: 'Lora_400Regular',
              fontSize: 40,
              color: '#FFFFFF',
              letterSpacing: 0.5,
            }}
          >
            Polycheck
          </Text>

          {/* Golden accent line */}
          <View
            style={{
              width: 44,
              height: 4,
              backgroundColor: '#FFDF00',
              marginTop: 12,
              marginBottom: 12,
            }}
          />

          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.75)',
              textAlign: 'center',
              maxWidth: 290,
            }}
          >
            Unified Attendance Management for the Polytechnic University of the Philippines
          </Text>

          {/* Role Cards - Solid PUP Maroon styling */}
          <View style={{ width: '100%', marginTop: 40, gap: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in as student"
              onPress={() => router.push('/(auth)/student-login')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                borderRadius: 0,
                borderWidth: 1,
                borderLeftWidth: 5,
                borderLeftColor: '#FFDF00',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                backgroundColor: pressed ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)',
                paddingHorizontal: 20,
                paddingVertical: 18,
                minHeight: 80,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 223, 0, 0.40)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="school" size={24} color="#FFDF00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'DMSans_700Bold',
                    fontSize: 15,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    color: '#FFFFFF',
                  }}
                >
                  Student Portal
                </Text>
                <Text
                  style={{
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.75)',
                    marginTop: 3,
                  }}
                >
                  Scan attendance, view classes, and digital ID.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="rgba(255, 255, 255, 0.50)" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in as faculty"
              onPress={() => router.push('/(auth)/faculty-login')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                borderRadius: 0,
                borderWidth: 1,
                borderLeftWidth: 5,
                borderLeftColor: '#FFDF00',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                backgroundColor: pressed ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)',
                paddingHorizontal: 20,
                paddingVertical: 18,
                minHeight: 80,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 223, 0, 0.40)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="badge" size={24} color="#FFDF00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'DMSans_700Bold',
                    fontSize: 15,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    color: '#FFFFFF',
                  }}
                >
                  Faculty Portal
                </Text>
                <Text
                  style={{
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.75)',
                    marginTop: 3,
                  }}
                >
                  Manage sessions, subjects, and attendance.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="rgba(255, 255, 255, 0.50)" />
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: 'rgba(255, 255, 255, 0.45)',
            }}
          >
            Polytechnic University of the Philippines
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
