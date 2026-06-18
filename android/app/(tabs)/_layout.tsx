import { useEffect } from 'react'
import { Platform, View } from 'react-native'
import { router, Tabs } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  dashboard: 'dashboard',
  scan: 'qr-code-scanner',
  'id-card': 'badge',
  history: 'history',
}

export default function TabLayout() {
  const { isDark } = useTheme()

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
        tabBarActiveTintColor: isDark ? '#F5A800' : '#7B1113',
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
        tabBarStyle: {
          backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
          borderTopWidth: 2,
          borderTopColor: isDark ? '#27272a' : '#d4d4d8', // zinc-800 or zinc-300
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'DMSans_700Bold',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: -4,
        },
        tabBarIcon: ({ focused }) => {
          const iconName = iconMap[route.name]
          if (!iconName) return null
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={iconName}
                size={24}
                color={focused ? (isDark ? '#F5A800' : '#7B1113') : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')}
              />
            </View>
          )
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarLabel: 'Scan' }} />
      <Tabs.Screen name="id-card" options={{ title: 'ID Card', tabBarLabel: 'ID Card' }} />
      <Tabs.Screen name="history" options={{ title: 'Audit', tabBarLabel: 'Audit' }} />
    </Tabs>
  )
}