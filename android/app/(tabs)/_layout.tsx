import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'

const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  dashboard: 'grid-view',
  schedule: 'calendar-month',
  scan: 'qr-code-scanner',
  history: 'history',
}

export default function TabLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomMargin = Math.max(insets.bottom, 12)

  return (
    <Tabs
      key={isDark ? 'dark' : 'light'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FFDF00',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.70)',
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomMargin,
          left: 16,
          right: 16,
          backgroundColor: isDark ? '#1F0B0E' : '#7B1113',
          borderRadius: 32,
          borderWidth: 0,
          height: 64,
          paddingTop: 6,
          paddingBottom: 6,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: 'DMSans_700Bold',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIcon: ({ color }) => {
          const iconName = iconMap[route.name]
          if (!iconName) return null
          return (
            <MaterialIcons
              name={iconName}
              size={22}
              color={color}
            />
          )
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarLabel: 'Schedule' }} />
      <Tabs.Screen name="enroll" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarLabel: 'Scan' }} />
      <Tabs.Screen name="id-card" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ title: 'Audit', tabBarLabel: 'Audit' }} />
      <Tabs.Screen name="subject-info/[id]" options={{ href: null }} />
      <Tabs.Screen name="subject-info/[id]/create-session" options={{ href: null }} />
      <Tabs.Screen name="subject-info/[id]/sessions/[sessionId]" options={{ href: null }} />
      <Tabs.Screen name="subjects" options={{ href: null }} />
    </Tabs>
  )
}
