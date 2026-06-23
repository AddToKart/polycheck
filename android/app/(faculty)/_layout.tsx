import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import { Tabs, router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'

function TabIcon({ name, focused, isDark }: { name: keyof typeof MaterialIcons.glyphMap; focused: boolean; isDark: boolean }) {
  const activeColor = isDark ? '#4A0A0B' : '#FFDF00'
  const inactiveColor = isDark ? 'rgba(74, 10, 11, 0.5)' : 'rgba(255, 255, 255, 0.5)'
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <MaterialIcons
        name={name}
        size={22}
        color={focused ? activeColor : inactiveColor}
      />
    </View>
  )
}

export default function FacultyLayout() {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [isSuper, setIsSuper] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const user = api.getCurrentUser()
    if (!user || (user.role !== 'teacher' && user.role !== 'super_admin')) {
      router.replace('/')
      return
    }
    setIsSuper(user.role === 'super_admin')
    setReady(true)
  }, [])

  if (!ready) return null

  const tabStyle = {
    position: 'absolute' as const,
    bottom: insets.bottom + 12,
    left: 24,
    right: 24,
    backgroundColor: isDark ? '#FFDF00' : '#7B1113',
    borderTopWidth: 0,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? 'rgba(74, 10, 11, 0.2)' : 'transparent',
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
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: '600' as const,
    fontFamily: fonts.bodySemiBold,
    marginTop: -4,
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#4A0A0B' : '#FFDF00',
        tabBarInactiveTintColor: isDark ? 'rgba(74, 10, 11, 0.5)' : 'rgba(255, 255, 255, 0.5)',
        tabBarStyle: route.name === 'sessions/create' || route.name === 'sessions/[id]' || route.name === 'subjects/create' || route.name === 'subjects/[id]' || route.name === 'subjects/[id]/sessions' || route.name === 'sections/create' || route.name === 'sections/[id]' || route.name === 'student/[id]' ? { display: 'none' } : tabStyle,
        tabBarLabelStyle: labelStyle,
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap | undefined
          switch (route.name) {
            case 'dashboard': iconName = 'dashboard'; break
            case 'subjects': iconName = 'menu-book'; break
            case 'sessions':
            case 'sessions/index': iconName = 'event'; break
            case 'attendance': iconName = 'assignment'; break
            case 'disputes': iconName = 'gavel'; break
            case 'users': iconName = 'people'; break
            case 'reports': iconName = 'assessment'; break
          }
          if (!iconName) return null
          return <TabIcon name={iconName} focused={focused} isDark={isDark} />
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }} />
      <Tabs.Screen name="subjects" options={{ title: 'Subjects', tabBarLabel: 'Subjects' }} />
      <Tabs.Screen name="subjects/create" options={{ href: null }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarLabel: 'Sessions' }} />
      <Tabs.Screen name="sessions/create" options={{ href: null }} />
      <Tabs.Screen name="sessions/[id]" options={{ href: null }} />
      <Tabs.Screen name="subjects/[id]" options={{ href: null }} />
      <Tabs.Screen name="subjects/[id]/sessions" options={{ href: null }} />
      <Tabs.Screen name="sections/create" options={{ href: null }} />
      <Tabs.Screen name="sections/[id]" options={{ href: null }} />
      <Tabs.Screen name="student/[id]" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarLabel: 'Attendance' }} />
      <Tabs.Screen name="disputes" options={{ title: 'Disputes', tabBarLabel: 'Disputes' }} />
      <Tabs.Screen 
        name="users" 
        options={{ 
          title: 'Users', 
          tabBarLabel: 'Users',
          href: isSuper ? undefined : null
        }} 
      />
      <Tabs.Screen 
        name="reports" 
        options={{ 
          title: 'Reports', 
          tabBarLabel: 'Reports',
          href: isSuper ? undefined : null
        }} 
      />
    </Tabs>
  )
}
