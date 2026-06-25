import { useEffect } from 'react'
import { Platform, View } from 'react-native'
import { router, Tabs } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  dashboard: 'dashboard',
  schedule: 'calendar-today',
  scan: 'qr-code-scanner',
  'id-card': 'badge',
  history: 'history',
}

export default function TabLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || user.role !== 'student') {
      router.replace('/')
    }
  }, [])

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#4A0A0B' : '#7B1113',
        tabBarInactiveTintColor: isDark ? 'rgba(74, 10, 11, 0.4)' : 'rgba(123, 17, 19, 0.4)',
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom + 12,
          left: 24,
          right: 24,
          backgroundColor: '#FFDF00',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(74, 10, 11, 0.15)' : 'rgba(123, 17, 19, 0.15)',
          borderRadius: 28,
          height: 64,
          paddingBottom: 0,
          paddingTop: 0,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'DMSans_700Bold',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: -4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color }) => {
          const iconName = iconMap[route.name]
          if (!iconName) return null
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={iconName}
                size={24}
                color={color}
              />
            </View>
          )
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarLabel: 'Schedule' }} />
      <Tabs.Screen name="enroll" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarLabel: 'Scan' }} />
      <Tabs.Screen name="id-card" options={{ title: 'ID Card', tabBarLabel: 'ID Card' }} />
      <Tabs.Screen name="history" options={{ title: 'Audit', tabBarLabel: 'Audit' }} />
      <Tabs.Screen name="subject-info/[id]" options={{ href: null }} />
      <Tabs.Screen name="subjects" options={{ href: null }} />
    </Tabs>
  )
}
